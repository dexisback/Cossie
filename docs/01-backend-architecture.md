# Backend Architecture

This document explains the Cossie backend from an engineering perspective: every package, every service, every runtime flow, and the reasoning behind each architectural decision. It focuses on implementation — frontend concerns are covered separately.

## Objectives and Responsibilities

The backend has one responsibility: **accept user intent and safely execute external tools**. Everything else supports that objective. It is intentionally not a chatbot, a dashboard backend, or an MCP client — it is an orchestration platform that coordinates independent systems.

The backend currently owns:

- HTTP APIs
- LLM communication (Gemini primary, Groq fallback)
- MCP communication
- policy enforcement
- tool discovery
- tool execution
- runtime synchronization (Redis pub/sub)
- approvals
- audit logs
- risk evaluation
- prompt inspection
- persistence

Actual decision-making is delegated into dedicated packages; the application layer orchestrates.

## Backend Layering

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

Every layer communicates only downward: infrastructure never calls application logic, the policy engine never knows Express exists, and routes never talk to MCP directly.

## Repository Layout

```text
apps/
packages/
generated/
```

| Directory | Purpose | Rules |
|---|---|---|
| `apps/` | Executable programs (Agent, Dashboard, custom MCP servers) | Owns bootstrapping, configuration, dependency wiring. Should never become libraries. |
| `packages/` | Reusable logic (policy-engine, registry, db, shared-types, logger) | Framework-independent where possible. Never contain startup logic. |
| `generated/` | Generated artifacts (Prisma Client) | Read-only; never edit manually. |

## Agent Application

The Agent is the system's runtime container. It does not contain business logic — it wires together independent services. Its responsibilities are to receive HTTP requests, start background subscribers, register MCP servers, initialize caches, expose APIs, and coordinate execution.

### Startup Sequence

```text
Load Environment → Create Express → Initialize Prisma → Register MCP Servers
→ Discover Tools → Persist Tool Catalog → Load Rules → Populate Rule Cache
→ Start Redis Subscriber → Expose HTTP APIs → Ready
```

All runtime initialization happens **before** the first request is accepted, guaranteeing that rules are loaded, the registry is populated, and tools are discovered by the time traffic arrives. No lazy initialization occurs during the first user request.

### Environment Configuration

Environment variables are centralized — `DATABASE_URL`, `REDIS_URL`, `GEMINI_API_KEY`, `GROQ_API_KEY` (or `GROK_API_KEY`), `CONTEXT7_API_KEY`, `PORT`. Applications never hardcode infrastructure endpoints. The Agent listens on port 4000 by default; the dashboard runs on 3000.

## Express Layer

Express acts purely as transport: parse HTTP, validate requests, delegate to services, return responses. Nothing more.

Routes are grouped by feature (`chat.routes.ts`, `approval.routes.ts`, `rule.routes.ts`, `tool.routes.ts`, `health.routes.ts`, `log.routes.ts`). Each route owns one API surface and routes never communicate with each other. Every route delegates immediately into services (thin routes over fat controllers): controllers become hard to test, while services can be reused, composed, mocked, and independently tested — future CLI tools could reuse them directly.

## Service Layer

Services own nearly all orchestration logic and are application-specific (unlike packages). Each service answers one question — "what responsibility do I own?" If the answer becomes "several unrelated responsibilities," it should be split.

Current services:

| Service | Responsibility |
|---|---|
| **ToolLoopService** | Central orchestrator: receive prompt → scan prompt → call LLM → detect tool calls → invoke Policy Engine → execute approved tools → log events → generate final response. Never queries Prisma directly, evaluates policies, discovers tools, or touches Redis — it only coordinates through delegation. |
| **ChatService** | Owns all LLM communication: provider selection, response generation, Groq retries with exponential backoff, Gemini→Groq fallback, provider abstraction. Nothing else imports Gemini directly. |
| **ToolAdapterService** | Converts `DiscoveredTool` objects into provider-specific tool definitions (currently Gemini tool format). Keeps registry objects provider-independent; new providers add adapters without modifying discovery or the tool loop. |
| **RuleLoaderService** | Loads policies from the database via Prisma, validates them with Zod, sorts by priority, converts DB rows into runtime Rules, and populates the cache. Owns the persistence→runtime boundary. |
| **RuleCacheService** | Holds validated rules in memory for fast access during evaluation. Solely owned by the loader; nothing else mutates cached rules. |
| **Redis subscriber** | Subscribes to the `policy:updated` channel and triggers rule reload on any message. Exists solely for synchronization — it never interprets rules, executes policies, or touches the registry. |
| **ApprovalService** | Manages approval *state*: create approvals, approve, reject, read pending approvals. Also expires pending approvals older than 30 minutes (run once during bootstrap). Intentionally never executes tools. |
| **ApprovalExecutionService** | Manages what happens *after* an approval: verifies status is `APPROVED`, then executes via the Registry. Separating this keeps approval persistence decoupled from tool execution. |
| **PromptSecurityService** | Runs before the LLM: scans prompts for suspicious patterns (~40 hardcoded phrases covering injection, privilege escalation, destructive commands, and secret exfiltration — e.g. "ignore previous instructions", "act as root", "bypass security", "override policy", "disable guardrails"), returns structured findings, and logs them as `PROMPT_INJECTION` events. It detects but never blocks execution itself — enforcement remains policy-driven so future responses (warn, block, escalate, require approval) fit without redesign. |
| **LogService** | Single logging abstraction; every subsystem writes `ToolExecutionLog` records through it. Provides consistent formatting, structured records, easier testing, and future integrations (cloud, OpenTelemetry). |
| **RiskResolver** (in the registry package) | Resolves final runtime risk: inferred risk → database override lookup → final risk. The Policy Engine always consumes the resolved value; the tool loop also re-resolves at call time so overrides apply immediately. |

Background components (Redis subscriber, rule loader, registry cache) maintain runtime state continuously, independently of requests.

### Service Dependency Graph

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

Service design rules: own exactly one responsibility; delegate specialized work; avoid duplicating infrastructure or business logic; be independently testable; avoid calling sibling services unless orchestration requires it.

## Package Architecture

Reusable logic lives in packages; applications mostly wire dependencies together.

```text
                           shared-types
                           /    |      \
                          /     |       \
                         /      |        \
                policy-engine   registry    db
                      |            |         |
                      +------------+---------+
                                   |
                                apps/agent
```

Almost everything depends on `shared-types`; no package redefines interfaces independently.

### shared-types

Foundation of the repository — its purpose is correctness, not convenience. Without a shared contract package, applications redefine interfaces that eventually drift apart. It defines: rule schemas, policy requests and decisions, MCP interfaces, tool definitions, risk types, approval types, audit types, and runtime enums. Every package imports these definitions.

Zod is used instead of TypeScript interfaces alone because TypeScript types disappear at runtime while database JSON does not — pipeline: database JSON → Zod validation → trusted runtime object. This prevents engine crashes from malformed database data.

### db

Owns persistence and nothing else: Prisma initialization, Neon adapter, connection management, and the exported singleton Prisma instance that every application imports. A single client avoids unnecessary connections, simplifies lifecycle management, and makes future instrumentation easier.

### logger

Centralized structured logging (Pino-based) — consistent formatting, pluggable future transports, cloud integration, OpenTelemetry compatibility — instead of each service inventing its own format. Note: the audit trail in `ToolExecutionLog` goes through LogService; much of the application's internal diagnostics still use raw console output today.

### policy-engine

The core domain package, intentionally the most isolated. Minimal dependencies: it knows nothing about Express, Redis, Prisma, Gemini, Groq, or MCP — only rules, requests, and decisions.

- **Inputs:** `PolicyRequest` (`conversationId`, `toolName`, `args`), `Rule[]`, and a runtime context containing the tool's risk level and current token usage
- **Output:** `PolicyDecision` — nothing more, no side effects

Because it is pure, deterministic, stateless, and infrastructure-independent, it can be reused unchanged in a CLI, worker, REST service, tests, cron jobs, or another application. Design goals:

- **Deterministic** — same request always produces the same decision; no randomness, no hidden state.
- **Stateless** — stores nothing internally; every evaluation is independent.
- **Infrastructure independent** — sees only the rules passed to `evaluate()`.
- **Pure business logic** — the engine never reads the database directly (`Database → Rule Loader → Policy Engine`).

Internal structure: `evaluate()` entry point, per-type rule evaluators, matchers (`rule-matcher/`), and decision construction.

**Evaluation lifecycle:** receive request + rules (already validated and sorted by the loader — sorting is data preparation, not evaluation) → iterate sequentially in the order given (ascending priority) → each evaluator answers "does this rule apply?" → return decision on first match → default to `ALLOW` ("No policy violations detected") if nothing matches. No asynchronous work.

**Evaluators** (one per rule type, rather than one giant switch):

- `evaluateBlockRule()`
- `evaluateApprovalRule()`
- `evaluateBudgetRule()`
- `evaluateRiskRule()`
- `evaluateValidationRule()`

Each evaluator delegates matching to a matcher (e.g. `matchesApprovalRule()`). Matchers answer only "does this rule apply?" and never build decisions; once matched, the evaluator constructs reason, decision, trace, and matched rule.

**PolicyTrace:** every evaluated rule produces a trace entry (`{rule, matched, message}`) — e.g. `BLOCK_TOOL / Matched / Restart tool blocked`, or `INPUT_VALIDATION / Skipped / Different tool`. Traces explain *why* a decision occurred and enable debugging, dashboard visualization, auditing, and policy simulation.

Beyond the three headline outcomes, the engine can also return `VALIDATION_FAILED` (input validation rule violated), `BUDGET_EXCEEDED` (budget rule matched), and `ERROR` (evaluation failure). All non-`ALLOW` decisions are surfaced to the user as `"Tool blocked: <reason>"`.

**Failure philosophy:** invalid rules are rejected at load time, never during evaluation. The engine assumes any rule it receives is valid. It also intentionally returns structured decisions instead of throwing authorization errors, letting callers choose appropriate behavior.

**Extending:** adding a rule type requires four steps — new schema, matcher, evaluator, switch registration. Existing rules require no modification (Open/Closed Principle). Examples that could be added without architectural change: time-based, user-based, organization, geofencing, RBAC, API cost limits, secret access, compliance rules.

### mcp-registry

After the Policy Engine, the second most important package. If the Policy Engine answers *"should this tool execute?"*, the Registry answers *"how do I execute this tool?"*. It isolates all Model Context Protocol complexity behind one small abstraction — applications would otherwise each implement connection, discovery, execution, caching, and transports separately.

Design principles:

- **Transport agnostic** — callers don't know whether a server uses stdio or SSE.
- **Runtime discovery** — no hardcoded tool lists; everything comes from `tools/list` at runtime, supporting arbitrary MCP servers, third-party plugins, and hot-refresh.
- **Execution only** — performs no authorization, logging, approvals, or prompt inspection. Its operating assumption: "if execution reaches me, authorization has already happened." Asking "am I allowed?" inside the Registry would create circular responsibilities.
- **Cached state** — runtime cache only; persistent metadata belongs to the Tool Catalog.

Internal components: Server Manager, Discovery Engine, Runtime Cache, Execution Engine, Transport Factory, Refresh Logic.

**Server registration:** configuration contains id, transport type, command/url, args — only enough information to reconnect later; no connection objects persist. Discovery begins immediately after registration.

**Discovery lifecycle** (automatic):

```text
Server Config → Create Transport → Connect Client → tools/list → Receive Schemas
→ Transform → Risk Classification → Risk Override Resolution
→ Persist Tool Catalog → Registry Cache
```

Output is `DiscoveredTool[]`. Caching avoids running `tools/list` per request; execution reuses cached metadata.

**Registry cache:** internally a `Map<ServerId, RegistryEntry>`. Two servers ship configured: `infra-mcp` (the custom infrastructure server) and `context7` (`@upstash/context7-mcp`, a documentation-lookup server run locally via stdio with `CONTEXT7_API_KEY`). Multiple servers are supported simultaneously and appear as one unified inventory — the LLM doesn't care which server owns which tool.

**Tool execution lifecycle:** find tool → find owning server → create execution request → transport `callTool()` → return result. The Registry never knows *why* execution occurred and retries nothing: automatic retry of destructive operations (e.g. restarting a server twice) would be dangerous, and retries belong to business logic anyway. It executes exactly once.

**Transports:**

- **stdio** — spawn process, connect, exchange messages (local/dev MCP servers).
- **SSE** — HTTP persistent stream (remote/hosted providers).

A transport factory picks the right client; no other code branches on transport type.

**Refresh:** tools may appear, disappear, or change schema. Refresh runs `tools/list`, replaces the cache, updates the catalog — no restart needed. The API exposes `POST /tools/refresh` for forced rediscovery (new server deployed, new tools added, schemas changed). Refresh synchronizes both runtime state (registry cache) and persistence (Tool Catalog), preventing stale metadata.

**Failure handling:** transport, discovery, server-unavailable, malformed-schema, and execution failures are handled gracefully — the application continues operating where possible. On discovery failure the Registry marks the server disconnected; the persisted Tool Catalog remains so the dashboard can show stale state. Execution errors are simply returned; the Policy Engine is unaffected.

**Boundaries:** the Policy Engine never discovers tools; the Registry never evaluates policies. The Dashboard never talks to MCP directly — Dashboard → Agent API → Registry → MCP — keeping authentication, logging, policies, and consistency centralized.

Future possibilities: connection pooling, streaming execution, health monitoring, reconnect backoff, circuit breakers, metrics, latency tracking, concurrent execution, load balancing, multiple instances per server.

## Runtime Objects

Several objects exist purely in memory and are essential to understanding the flows.

| Object | Represents | Contents |
|---|---|---|
| **RegistryEntry** | One connected MCP server (not one tool) | server config, discovered tool list, connected status, `lastSyncedAt` |
| **DiscoveredTool** | One MCP capability; flows throughout the system | name, description, input schema, server id, inferred risk, final risk |
| **PolicyRequest** | An attempted action entering the Policy Engine | `conversationId`, `toolName`, `args` |
| **PolicyDecision** | Authorization outcome | decision ∈ {`ALLOW`, `DENY`, `REQUIRE_APPROVAL`, `VALIDATION_FAILED`, `BUDGET_EXCEEDED`, `ERROR`}, plus reason, matched rule, approval ID, and trace |
| **Rule** (runtime) | Validated, typed rule structure — **not** a database row | produced by Zod validation + conversion in the loader |

On the runtime `Rule`: the engine originally consumed raw Prisma rows, but their JSON, unknown shapes, and type mismatches caused problems. Current flow is `Database → Validation (Zod) → Runtime Rule → Engine`, which significantly reduced runtime failures. Everything downstream receives validated objects.

## Complete Request Lifecycle

Every request follows a deterministic sequence — linear, observable, explainable, with no hidden execution paths or component bypassing another.

```text
Client → Express Route → ToolLoopService → Prompt Security → ChatService (Gemini → Groq fallback)
→ Function Call? → Policy Engine (ALLOW / DENY / REQUIRE_APPROVAL / …)
→ Registry → MCP Server → Tool Result → LLM Summary → HTTP Response
```

1. **Incoming HTTP request** — e.g. `POST /api/chat {"message":"restart server srv-1"}`. Express parses JSON; the route creates or looks up the `Conversation` row so all messages and logs share a real `conversationId`.
2. **Route** — extract prompt, delegate immediately (`ToolLoopService.run(prompt, conversationId)`). Routes contain almost no logic.
3. **ToolLoopService** — owns the conversation loop and coordinates everything; it does not own policy logic, MCP execution, discovery, logging, or the Gemini implementation.
4. **Prompt security** — `PromptSecurityService.scan()` searches for suspicious patterns. Current behavior: detection → audit log → continue uninterrupted. The user message is persisted before the LLM call.
5. **Audit event** — suspicious content produces a `PROMPT_INJECTION` record via LogService (with the matched patterns in `reason`/`trace`).
6. **LLM invocation** — `ChatService.generate(...)` handles provider selection and parsing. Tool definitions accompany the prompt so the LLM knows which MCP capabilities exist.
7. **Gemini (primary)** — `gemini-2.5-flash` receives system instructions, user prompt, discovered tools, and conversation context; it either returns text or requests a function call. On failure, ChatService transparently falls back to Groq.
8. **Groq fallback** — `llama-3.3-70b-versatile`. Groq calls use `retryWithBackoff` (3 attempts, delay doubling from 1s). Gemini function declarations are converted to OpenAI-style tool schemas, and the completion is wrapped back into a Gemini-shaped response, so ToolLoopService is provider-agnostic.
9. **Response inspection** — normal text returns immediately; a function call continues the tool loop.
10. **Tool lookup** — `registry.getTool(toolName)` returns description, schema, owning server, risk, metadata.
11. **Risk resolution** — effective risk = database override if present, otherwise the registry's stored risk.
12. **PolicyRequest construction** — conversation ID, tool name, arguments enter the Policy Engine.
13. **Policy evaluation** — pure inputs (request, cached rules, risk, token usage) produce one `PolicyDecision`. No databases, Redis, or Express involved during evaluation.
14. **Decision handling** — three paths diverge:
    - **ALLOW** — `registry.executeTool()` runs the tool exactly once (no automatic retries — re-running destructive operations like restarting a server would be dangerous), result goes to the LLM for summarization, then returns. Execution is logged as `TOOL_EXECUTION`.
    - **DENY / VALIDATION_FAILED / BUDGET_EXCEEDED / ERROR** — audit logged with `executed: false`; the Registry never executes and MCP never receives the request. The user sees `"Tool blocked: <reason>"`.
    - **REQUIRE_APPROVAL** — ApprovalService persists a pending approval (tool + original arguments) and responds "Approval required. Approval ID: …"; execution pauses; the tool is NOT executed.
15. **Approval storage** — pending approvals store tool, original arguments, status (`PENDING` / `APPROVED` / `REJECTED` / `EXPIRED`), requested time, resolution time, and reason. Unresolved approvals expire after 30 minutes (expiry currently runs once at bootstrap).
16. **Approval execution** — on administrator approval: Approval API → ApprovalService marks `APPROVED` → ApprovalExecutionService immediately executes through the Registry → result returned in the approval response → audit log (`APPROVAL_APPROVED`, decision ALLOW). Rejections are logged (`APPROVAL_REJECTED`, decision DENY) and never execute.
17. **Registry execution** — locate server, transport, tool; run `callTool(...)`. Outcomes: success, validation error, execution error, transport failure — results are forwarded regardless.
18. **Final LLM pass** — raw MCP output is not sent to users. The LLM receives the original prompt plus tool result with instructions to summarize and make no further tool calls, converting structured output into natural language.
19. **Response** — final text plus `conversationId` return. The assistant message is persisted; no runtime state remains except logs, approvals, and database updates.

Component responsibilities within the pipeline: Prompt Security inspects, ChatService communicates, Policy Engine authorizes, Registry executes, LogService records, ApprovalService persists — no component performs another's job.

## Logging Lifecycle

Logging is woven throughout execution. Events recorded: prompt injection detections, policy denials, approval creation, approval approval, approval rejection, tool execution. Every meaningful security event becomes an immutable, timestamped, searchable audit record — created and read, never modified.

## State: Runtime vs Persistent

> Principle: runtime should be rebuildable entirely from persistent state.

| Persistent (survives restarts) | Runtime (rebuilt at startup) |
|---|---|
| Rules | Registry + RegistryEntries |
| Approvals | Rule Cache |
| Logs | Active connections |
| Tool Catalog | Discovery cache |
| Risk Overrides | |

Rebuild paths: Rules → Rule Loader → Rule Cache; Tool Catalog → Registry metadata; Risk Overrides → RiskResolver; Approvals → pending approval queue; Logs → historical audit trail. These two categories should never be confused — nothing important depends on runtime persistence.

## Database Architecture

PostgreSQL (via Neon) with Prisma. Chosen for strong consistency, JSON support, excellent tooling, Prisma compatibility, Neon integration, and future scalability; Prisma adds type safety, migrations, productivity, and fewer query mistakes.

Five domains: policies, approvals, tool metadata, audit history, risk configuration. Tables are mostly independent — the project avoids deeply coupled relational schemas.

### Schema Overview

PostgreSQL models (Prisma): `Rule`, `Approval`, `ToolCatalog`, `ToolRiskOverride`, `ToolExecutionLog`, plus `Conversation` and `Message` (chat persistence: messages with roles USER / ASSISTANT / TOOL, per-conversation token totals). Tables are mostly independent — the project avoids deeply coupled relational schemas.

### Rule

Persistent policy storage — without it, policies would need to be hardcoded.

Lifecycle: Dashboard → `POST /rules` → Prisma → Rule table → Redis publish → reload → Rule Loader → Rule Cache → Policy Engine. No restart required for changes.

Fields:

| Field | Purpose |
|---|---|
| `id` | Globally unique identifier, never changes |
| `name` | Human-readable; used by dashboard, logs, traces |
| `description` | Optional informational explanation |
| `type` | Which evaluator handles the rule: `BLOCK_TOOL`, `INPUT_VALIDATION`, `REQUIRE_APPROVAL`, `RISK_BASED`, `BUDGET_LIMIT` |
| `priority` | Deterministic ordering; lower value = higher precedence |
| `enabled` | Temporarily disable without deletion |
| `config` | Rule-specific JSON configuration |

`config` examples:

```json
// BLOCK_TOOL
{ "toolNames": ["restart_server"] }
```

```json
// INPUT_VALIDATION
{ "toolName": "write_file", "allowedPrefix": "/sandbox/" }
```

JSON (rather than per-field columns like `toolName`, `allowedPrefix`, `riskLevel`, `budget`) avoids mostly-NULL schemas and frequent migrations, makes rules extensible so new rule types rarely require migrations, and lets the Rule Loader convert JSON into strongly typed runtime objects.

### Approval

Represents paused (pending-decision) tool execution — not completed executions.

Lifecycle: tool request → Policy Engine → REQUIRE_APPROVAL → approval record → dashboard → approve/reject → immediate execution on approve (the stored arguments are executed through the Registry at approval time — the agent does not resume the original chat turn).

Fields: `toolName`, `arguments` (stored exactly as requested so execution can happen later — without arguments only intent survives, e.g. "restart_server" with no idea which server), `status` (`PENDING` / `APPROVED` / `REJECTED` / `EXPIRED`; unresolved approvals expire after 30 minutes), `requestedAt` (sorting, expiry, metrics), `resolvedAt` (duration calculations), `resolutionReason` (optional admin comment for audit).

### ToolCatalog

Persistent inventory of every discovered MCP tool — discovery alone is temporary.

Lifecycle: MCP discovery → risk classification → risk override → persist → dashboard.

Fields: `toolName` (unique identifier), `description`, `serverId` (owning MCP server), `inferredRisk` (automatically generated), `finalRisk` (runtime risk, may differ due to overrides), `lastSeenAt` (stale detection), `createdAt` (initial discovery), `updatedAt` (latest sync).

Persistence enables dashboard browsing, historical inventory, risk overrides, and analytics; without it, restarts would lose metadata.

### ToolRiskOverride

Lets administrators override automatic risk classification (e.g. inference says HIGH, admin sets CRITICAL). Fields: `toolName`, `riskLevel`, timestamps. Overrides live in a separate table rather than mutating ToolCatalog, preserving both the original inference and distinguishing automatic from manual values. RiskResolver combines them into the final runtime risk consumed by the Policy Engine.

### ToolExecutionLog

Immutable audit history — one record per meaningful event. Event types (`AuditEventType` enum): `TOOL_EXECUTION`, `PROMPT_INJECTION`, `APPROVAL_CREATED`, `APPROVAL_APPROVED`, `APPROVAL_REJECTED`.

Fields:

| Field | Purpose |
|---|---|
| `eventType` | What happened (see enum above) |
| `decision` | Policy decision (`ALLOW`, `DENY`, `REQUIRE_APPROVAL`, …) — kept separate from eventType for richer analytics. Injection scans log `ALLOW` with `executed: false` since only detection occurred. |
| `toolName` | For injection events this is the sentinel value `PROMPT_SECURITY` |
| `riskLevel` | Optional risk of the tool involved |
| `executed` | Boolean — did execution actually happen? (DENY / PROMPT_INJECTION → false; ALLOW → true) |
| `arguments` | Execution arguments, enabling later investigation |
| `reason` | Human-readable explanation, often from the Policy Engine or joined matched patterns |
| `trace` | Structured JSON metadata: matched patterns, policy traces, approval IDs, risk metadata (JSON chosen because trace structures evolve) |
| `conversationId` | Real conversation identifier for chat-driven events (defaults to `"default"` when invoked without one; null for approval-route events) — enables grouping by conversation |
| timestamps | Chronological reconstruction |

Logs follow create/read-never-modify semantics: editing destroys trust.

### Read/Write Patterns

Read-heavy tables (Rules, Tool Catalog, Approvals, Logs) power the dashboard. Writes occur during rule creation, tool discovery, prompt detection, tool execution, and approvals — a modest workload well suited to PostgreSQL.

Future schema candidates (fitting naturally without major redesign): User, Organization, PolicyVersion, Role, Session, Notification, MCPServer, ExecutionMetrics.

## Redis Architecture

Redis exists solely for synchronization, and the Policy Engine never talks to it — Redis is for sync, policy evaluation is for authorization; combining them violates separation of concerns.

When a rule is created, updated, or deleted, the rules API publishes `{"event":"RULES_REFRESH"}` on the **`policy:updated`** channel:

```text
Database write → Redis publish → Subscriber receives message → Rule Loader reloads
→ Zod validation → Priority sort → Rule Cache updated
```

Only the agent's own subscriber consumes this channel today. Risk-override changes and tool refreshes do not publish events — overrides take effect at evaluation time (they are read from the database per call) and tool refresh is triggered explicitly via `POST /api/tools/refresh`. Future channels could cover these.

If Redis is unavailable, the existing cache continues serving; the architecture fails conservatively. Other failure modes: database unavailable → requests fail safely; Gemini unavailable → Groq fallback; MCP unavailable → execution error returned.

## REST API

The Agent's REST API is the single entry point into the platform — neither the Dashboard nor external clients touch the Policy Engine or Registry directly. All routes are mounted under `/api`; there is no authentication yet. Principles: REST-first, thin routes, service-oriented, stateless, JSON, no business logic in controllers.

Endpoint groups:

| Group | Endpoints | Behavior |
|---|---|---|
| Chat | `POST /api/chat` | Accept prompt, execute the tool loop, return final response + conversation ID. |
| Rules | `GET /api/rules`, `POST /api/rules` (201), `PATCH /api/rules/:id`, `DELETE /api/rules/:id` (204) | Every modification ends with DB write → Redis publish → rule reload; no restart required. |
| Tools | `GET /api/tools`, `POST /api/tools/refresh` | Tool Catalog (merged with overrides); forced rediscovery. |
| Tools | `PATCH /api/tools/:toolName/risk`, `GET /api/tools/:toolName/risk` | Create/read risk overrides. |
| Approvals | `GET /api/approvals`, `POST /api/approvals/:id/approve`, `POST /api/approvals/:id/reject` | List pending approvals; approve (executes immediately) or reject. |
| Logs | `GET /api/logs?approvalId=` | Latest 100 audit records (or filtered by approval trace). |
| Health | `GET /api/health` | Database status, uptime, registered MCP servers, discovered tools, provider status. |

Every endpoint follows the same flow: Client → Express Route → Validation → Service → Package(s) → Database/Registry → Response.

Errors propagate upward through services in categories: validation, database, MCP failures, LLM failures, policy denials. Endpoints return structured JSON — never raw stack traces. Note: error envelopes are inconsistent today — chat/tools use `{ "success": false, "error": ... }` while rules endpoints use bare `{ "error": ... }`. There is no central Express error-handling middleware; each route has its own try/catch.

Future evolution room (no major changes needed): authentication, OpenAPI generation, versioning, rate limiting, WebSockets, streaming responses, GraphQL gateway if ever required.

## Summary

The backend is intentionally layered:

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

Each layer has one responsibility; each package has one owner; each service orchestrates rather than implements domain logic. From prompt scanning to approval workflows, every major decision can be traced through the single runtime pipeline described above. See **02-api-reference.md** for endpoint-level documentation including request/response schemas, runtime behavior, edge cases, error conditions, and examples.
