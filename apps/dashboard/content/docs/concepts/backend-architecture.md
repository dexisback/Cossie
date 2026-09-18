---
title: Backend Architecture
description: >-
  Every backend package, service, runtime flow, and the reasoning behind each architectural decision.
---

# Backend Architecture

This document explains the Cossie backend from an engineering perspective: the packages, the services, the runtime flows, and the reasoning behind each decision.

## Objective

The backend has one responsibility: **accept user intent and safely execute external tools**. It owns HTTP APIs, LLM communication (Gemini primary, Groq fallback), MCP communication, policy enforcement, tool discovery and execution, runtime synchronization, approvals, audit logs, risk evaluation, and prompt inspection.

Actual decision-making is delegated to dedicated packages; the application layer orchestrates.

## Layering

```text
                Presentation Layer
                       │
                  Express Routes
──────────────────────────────────────────────
                 Application Layer
                 Services / Orchestration
──────────────────────────────────────────────
                   Domain Layer
       Policy Engine + Registry + Types
──────────────────────────────────────────────
              Infrastructure Layer
  Prisma • Redis • MCP • Gemini • Groq
```

Each layer communicates only downward: infrastructure never calls application logic, the Policy Engine never knows Express exists, and routes never talk to MCP directly.

## Repository layout

| Directory | Purpose | Rules |
| --- | --- | --- |
| `apps/` | Executable programs (agent, dashboard, custom MCP server) | Owns bootstrapping and wiring; never becomes a library |
| `packages/` | Reusable logic (`policy-engine`, `mcp-registry`, `db`, `shared-types`, `logger`) | Framework-independent where possible; no startup logic |
| `generated/` | Generated artifacts (Prisma Client) | Read-only; never edited manually |

## The Agent

The Agent is the runtime container. It contains no business logic — it wires independent services together: receiving HTTP requests, starting subscribers, registering MCP servers, initializing caches, and coordinating execution.

### Startup sequence

```text
Load Environment → Create Express → Initialize Prisma → Register MCP Servers
→ Discover Tools → Persist Tool Catalog → Load Rules → Populate Rule Cache
→ Start Redis Subscriber → Expose HTTP APIs → Ready
```

All initialization happens **before** the first request is accepted, so rules are loaded and tools discovered by the time traffic arrives. No lazy initialization on the first request.

### Environment configuration

Environment variables are centralized — `DATABASE_URL`, `REDIS_URL`, `GEMINI_API_KEY`, `GROQ_API_KEY` (or `GROK_API_KEY`), `CONTEXT7_API_KEY`, `PORT`. Applications never hardcode infrastructure endpoints. The Agent listens on port 4000; the dashboard runs on 3000.

## Express layer

Express is transport only: parse HTTP, validate requests, delegate to services, return responses.

Routes are grouped by feature (`chat.routes.ts`, `approval.routes.ts`, `rule.routes.ts`, `tool.routes.ts`, `health.routes.ts`, `log.routes.ts`). Each route owns one API surface and delegates immediately to services — thin routes over fat controllers, so services can be reused, composed, mocked, and tested independently.

## Service layer

Services own nearly all orchestration logic. Each service answers one question: *"what responsibility do I own?"*

| Service | Responsibility |
| --- | --- |
| `ToolLoopService` | Central orchestrator: prompt → scan → LLM → tool call → Policy Engine → execute → log → respond. Coordinates through delegation; never queries Prisma directly. |
| `ChatService` | All LLM communication: provider selection, Gemini→Groq fallback, Groq retries with backoff. |
| `ToolAdapterService` | Converts `DiscoveredTool` into provider-specific tool definitions, keeping the registry provider-independent. |
| `RuleLoaderService` | Loads policies via Prisma, validates with Zod, sorts by priority, populates the cache. Owns the persistence→runtime boundary. |
| `RuleCacheService` | Holds validated rules in memory; only the loader mutates it. |
| Redis subscriber | Subscribes to `policy:updated` and triggers rule reload. Synchronization only — never interprets rules. |
| `ApprovalService` | Manages approval state: create, approve, reject, read pending, expire. Never executes tools. |
| `ApprovalExecutionService` | Verifies `APPROVED` status, then executes via the Registry — keeping persistence decoupled from execution. |
| `PromptSecurityService` | Scans prompts for suspicious patterns and logs `PROMPT_INJECTION` events. Detects but never blocks. |
| `LogService` | Single logging abstraction; every subsystem writes `ToolExecutionLog` records through it. |
| `RiskResolver` (registry package) | Resolves final risk: inferred risk → database override → final risk. |

### Service dependency graph

```text
HTTP Routes
      │
      ▼
Application Services
      │
      ├───────────────┐
      ▼               ▼
Policy Engine     MCP Registry
      │               │
      └──────┬────────┘
             ▼
     Prisma / Redis / LLM
```

## Package architecture

```text
                           shared-types
                           /    |      \
                          /     |       \
                 policy-engine  registry  db
                       |            |       |
                       +------------+-------+
                                    |
                                apps/agent
```

Almost everything depends on `shared-types`; no package redefines interfaces independently.

### `shared-types`

The foundation of the repository. Defines rule schemas, policy requests and decisions, MCP interfaces, tool definitions, risk types, approval types, and audit types. Zod is used alongside TypeScript because types disappear at runtime while database JSON does not: `database JSON → Zod validation → trusted runtime object`.

### `db`

Owns persistence: Prisma initialization, the Neon adapter, connection management, and the exported singleton client. A single client avoids redundant connections.

### `logger`

Centralized structured logging (Pino-based) with pluggable transports. The audit trail in `ToolExecutionLog` flows through `LogService`; much internal diagnostics still uses raw console output.

### `policy-engine`

The core domain package and the most isolated. It knows nothing about Express, Redis, Prisma, Gemini, Groq, or MCP — only rules, requests, and decisions.

- **Inputs:** `PolicyRequest` (`conversationId`, `toolName`, `args`), `Rule[]`, and a runtime context (risk level, token usage).
- **Output:** `PolicyDecision` — nothing more, no side effects.

Because it is pure, deterministic, and stateless, it can be reused unchanged in a CLI, worker, REST service, or tests. It never reads the database directly (`Database → Rule Loader → Policy Engine`).

Internal structure: an `evaluate()` entry point, per-type evaluators, and matchers in `rule-matcher/`. Each evaluator delegates matching to a matcher; on a match, the evaluator builds the reason, decision, trace, and matched rule. Traces explain why a decision occurred — e.g. `BLOCK_TOOL / Matched / Restart tool blocked`.

Beyond the three headline outcomes, the engine can return `VALIDATION_FAILED`, `BUDGET_EXCEEDED`, and `ERROR`. All non-`ALLOW` decisions surface as `"Tool blocked: <reason>"`.

Invalid rules are rejected at load time, never during evaluation. The engine returns structured decisions instead of throwing authorization errors.

### `mcp-registry`

If the Policy Engine answers *"should this tool execute?"*, the Registry answers *"how do I execute this tool?"* It isolates all MCP complexity behind one abstraction.

- **Transport agnostic** — callers don't know whether a server uses stdio or SSE.
- **Runtime discovery** — no hardcoded tool lists; everything comes from `tools/list`.
- **Execution only** — no authorization, logging, or approvals. Its assumption: *"if execution reaches me, authorization has already happened."*
- **Cached state** — runtime cache only; persistent metadata belongs to the Tool Catalog.

Two servers ship configured: `infra-mcp` (the custom infrastructure server) and `context7` (`@upstash/context7-mcp`, run locally over stdio). Multiple servers appear as one unified inventory.

**Discovery lifecycle:**

```text
Server Config → Create Transport → Connect → tools/list → Receive Schemas
→ Risk Classification → Risk Override Resolution → Persist Catalog → Registry Cache
```

**Tool execution lifecycle:** find tool → find owning server → create request → `callTool()` → return result. The Registry retries nothing — automatic retry of destructive operations (e.g. restarting a server twice) would be dangerous. It executes exactly once.

**Refresh:** `POST /api/tools/refresh` re-runs `tools/list`, replaces the cache, and updates the catalog — synchronizing runtime state and persistence.

**Boundaries:** the Policy Engine never discovers tools; the Registry never evaluates policies; the Dashboard never talks to MCP directly (`Dashboard → Agent API → Registry → MCP`).

## Runtime objects

| Object | Represents | Contents |
| --- | --- | --- |
| `RegistryEntry` | One connected MCP server | config, discovered tools, connected status, `lastSyncedAt` |
| `DiscoveredTool` | One MCP capability | name, description, schema, server id, inferred/final risk |
| `PolicyRequest` | An attempted action | `conversationId`, `toolName`, `args` |
| `PolicyDecision` | Authorization outcome | decision, reason, matched rule, approval ID, trace |
| `Rule` (runtime) | Validated, typed rule — **not** a DB row | produced by Zod validation + conversion |

The engine originally consumed raw Prisma rows, whose unknown shapes and type mismatches caused failures. The current flow is `Database → Validation (Zod) → Runtime Rule → Engine`.

## Request lifecycle

Every request follows a deterministic, linear sequence:

```text
Client → Express Route → ToolLoopService → Prompt Security → ChatService
→ Function Call? → Policy Engine → Registry → MCP Server → Tool Result
→ LLM Summary → HTTP Response
```

1. **Incoming request** — e.g. `POST /api/chat {"message":"restart server srv-1"}`. Express parses JSON; the route creates or looks up the `Conversation` row.
2. **Route** — delegates immediately (`ToolLoopService.run(prompt, conversationId)`).
3. **Tool loop** — coordinates everything; owns no policy, MCP, discovery, or logging logic.
4. **Prompt security** — `PromptSecurityService.scan()`; detection → audit log → continue.
5. **LLM invocation** — `ChatService.generate()` handles provider selection; tool definitions accompany the prompt.
6. **Gemini (primary)** — `gemini-2.5-flash` returns text or requests a function call; on failure, falls back to Groq.
7. **Groq (fallback)** — `llama-3.3-70b-versatile` with `retryWithBackoff` (3 attempts). Tool schemas are converted between formats so the loop stays provider-agnostic.
8. **Response inspection** — text returns immediately; a function call continues the loop.
9. **Tool lookup** — `registry.getTool(toolName)`.
10. **Risk resolution** — effective risk = database override if present, else the registry's stored risk.
11. **Policy evaluation** — pure inputs (request, cached rules, risk, token usage) → one `PolicyDecision`.
12. **Decision handling**:
    - `ALLOW` — `registry.executeTool()` runs the tool exactly once; logged as `TOOL_EXECUTION`.
    - `DENY` / `VALIDATION_FAILED` / `BUDGET_EXCEEDED` / `ERROR` — logged with `executed: false`; the Registry never runs; user sees `"Tool blocked: <reason>"`.
    - `REQUIRE_APPROVAL` — a pending approval is persisted; execution pauses.
13. **Approval execution** — on approval, `ApprovalExecutionService` executes the stored arguments immediately through the Registry; rejections never execute.
14. **Final LLM pass** — raw MCP output is summarized into natural language, not sent to users directly.
15. **Response** — final text plus `conversationId`; the assistant message is persisted.

## Logging lifecycle

Prompt injection detections, policy denials, approval creation/approval/rejection, and tool executions are recorded as immutable, timestamped, searchable audit records — created and read, never modified.

## State: runtime vs persistent

> Runtime state should be rebuildable entirely from persistent state.

| Persistent (survives restarts) | Runtime (rebuilt at startup) |
| --- | --- |
| Rules | Registry + `RegistryEntry`s |
| Approvals | Rule Cache |
| Logs | Active connections |
| Tool Catalog | Discovery cache |
| Risk Overrides | |

## Database

PostgreSQL (via Neon) with Prisma. Five domains: policies, approvals, tool metadata, audit history, and risk configuration.

### Schema overview

Models: `Rule`, `Approval`, `ToolCatalog`, `ToolRiskOverride`, `ToolExecutionLog`, plus `Conversation` and `Message` (chat persistence). Tables are mostly independent — the schema avoids deeply coupled relations.

### `Rule`

Persistent policy storage. Lifecycle: `Dashboard → POST /api/rules → Prisma → Redis publish → Rule Loader → Rule Cache`.

| Field | Purpose |
| --- | --- |
| `id` | Unique identifier |
| `name` | Human-readable; used by dashboard, logs, traces |
| `description` | Optional explanation |
| `type` | Which evaluator handles it: `BLOCK_TOOL`, `REQUIRE_APPROVAL`, `INPUT_VALIDATION`, `RISK_BASED`, `BUDGET_LIMIT` |
| `priority` | Deterministic ordering; lower value = higher precedence |
| `enabled` | Temporarily disable without deletion |
| `config` | Rule-specific JSON configuration |

The `config` column is JSON rather than per-field columns to avoid mostly-NULL schemas and frequent migrations.

### `Approval`

Represents paused tool execution. Fields: `toolName`, `arguments` (stored exactly as requested so execution can happen later), `status` (`PENDING` / `APPROVED` / `REJECTED` / `EXPIRED`), `requestedAt`, `resolvedAt`, `resolutionReason`.

### `ToolCatalog`

Persistent inventory of every discovered MCP tool. Fields: `toolName`, `description`, `serverId`, `inferredRisk`, `finalRisk`, `lastSeenAt`, timestamps.

### `ToolRiskOverride`

Lets administrators override automatic classification. Lives in a separate table rather than mutating `ToolCatalog`, preserving the original inference. The `RiskResolver` combines them into the final runtime risk.

### `ToolExecutionLog`

Immutable audit history — one record per event. Event types: `TOOL_EXECUTION`, `PROMPT_INJECTION`, `APPROVAL_CREATED`, `APPROVAL_APPROVED`, `APPROVAL_REJECTED`.

| Field | Purpose |
| --- | --- |
| `eventType` | What happened |
| `decision` | Policy decision, kept separate from `eventType` for richer analytics |
| `toolName` | The tool involved (`PROMPT_SECURITY` for injection events) |
| `riskLevel` | Optional risk of the tool |
| `executed` | Whether execution actually happened |
| `arguments` | Execution arguments |
| `reason` | Human-readable explanation |
| `trace` | Structured JSON metadata (matched patterns, traces, approval IDs) |
| `conversationId` | Grouping by conversation |

## Redis

Redis exists solely for synchronization — the Policy Engine never talks to it. On rule create/update/delete, the rules API publishes `{"event":"RULES_REFRESH"}` on the `policy:updated` channel:

```text
Database write → Redis publish → Subscriber receives → Rule Loader reloads
→ Zod validation → Priority sort → Rule Cache updated
```

Only the agent's own subscriber consumes this channel today. If Redis is unavailable, the existing cache keeps serving.

## REST API

The Agent's REST API is the single entry point. All routes mount under `/api`; there is no authentication yet. Principles: REST-first, thin routes, service-oriented, stateless, JSON.

| Group | Endpoints |
| --- | --- |
| Chat | `POST /api/chat` |
| Rules | `GET /api/rules`, `POST /api/rules`, `PATCH /api/rules/:id`, `DELETE /api/rules/:id` |
| Tools | `GET /api/tools`, `POST /api/tools/refresh`, `PATCH /api/tools/:toolName/risk`, `GET /api/tools/:toolName/risk` |
| Approvals | `GET /api/approvals`, `POST /api/approvals/:id/approve`, `POST /api/approvals/:id/reject` |
| Logs | `GET /api/logs?approvalId=` |
| Health | `GET /api/health` |

Every endpoint follows the same flow: `Client → Express Route → Validation → Service → Package(s) → Database/Registry → Response`.

## Summary

```text
Dashboard / Client
      ↓
   REST API
      ↓
   Services
      ↓
   Packages
      ↓
Infrastructure
```

Each layer has one responsibility, each package one owner, and each service orchestrates rather than implements domain logic. Every major decision can be traced through the single runtime pipeline described above.

## Where to next

- [Policy Engine](/docs/concepts/policy-engine) — a deep dive into the authorization core.
- [Security Model](/docs/security/security-model) — the security reasoning behind this architecture.
- [API Reference](/docs/reference/api) — the HTTP surface documented in full.
