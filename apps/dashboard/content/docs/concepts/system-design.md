---
title: System Design
description: >-
  The core architectural principles of Cossie: centralized authorization, configuration over code, runtime extensibility, and the trade-offs behind each decision.
---

# System Design

Cossie's architecture follows one principle: **AI is responsible for reasoning; infrastructure remains responsible for authorization and execution.** Instead of letting a language model invoke external systems directly, Cossie inserts an independent policy layer between AI reasoning and tool execution, creating a clean separation between *intent* and *permission*:

- The language model determines what it wants to do.
- The Policy Engine determines whether it is allowed.
- Execution occurs only after authorization completes.

## Core principles

- **Separation of responsibilities.** Reasoning, authorization, discovery, execution, and administration are isolated into independent components rather than one monolithic agent. This lowers coupling, eases testing, and lets each component evolve independently.
- **Centralized authorization.** Many agents scatter security checks as conditional statements throughout execution code. Cossie avoids this — all authorization originates from a single Policy Engine:
  - execution logic never decides permissions
  - MCP servers never authorize requests
  - the dashboard never participates in runtime decisions
  - the language model never grants itself permissions
- **Configuration over code.** Administrators define policies through the dashboard; the running system consumes them dynamically. Adding, modifying, or removing guardrails requires no redeployment.
- **Runtime extensibility.** Neither the agent nor the Policy Engine hardcodes a tool list. MCP servers expose tools, the registry discovers them, the dashboard visualizes them, and the Policy Engine evaluates them.
- **Composition over specialization.** The MCP Registry presents a single interface regardless of transport protocol, provider, or implementation. The platform interacts with tools, not server implementations.
- **Long-running runtime.** The agent is a continuously running service that keeps in-memory state (discovered tools, rule cache, MCP connections) across requests, avoiding repeated initialization and enabling policy updates without restarts.

## System boundaries

Operational responsibilities are split into two planes:

| Plane | Components | Responsibility |
| --- | --- | --- |
| Execution | AI Agent, Policy Engine, MCP Registry, MCP Servers | Processing AI requests safely |
| Management | Dashboard: policy management, approval queue, audit viewer, monitoring | Administration and observability |

Neither plane depends on the other's internals. The dashboard manages runtime behavior but never participates in authorization or execution; the runtime keeps operating independently of dashboard availability.

### Architecture diagram

```
                       MANAGEMENT PLANE
 ┌────────────────────────────────────────────────────────┐
 │  Dashboard                                             │
 │  policies · approval queue · audit viewer · monitoring │
 └──────┬──────────────────────────────────▲──────────────┘
        │ write policies / resolve         │ poll REST
        │ approvals                        ▼
        ▼                            Backend REST API
   PostgreSQL  ◄──────────── persist rules/approvals/audits
        │
        │ on policy change
        ▼
   Redis Publish
        │ event-driven sync
        ▼
 ┌────────────────────────────────────────────────────────┐
 │                     EXECUTION PLANE                    │
 │                AI Agent (Express backend)              │
 │   Tool Loop ──► Policy Engine ──► ALLOW/DENY/APPROVAL  │
 │       │              ▲                                 │
 │       ▼              │ loads                           │
 │  MCP Registry ──► Rule Cache (in-memory)               │
 │    ├─ local MCP servers                                │
 │    └─ remote MCP servers                               │
 └────────────────────────────────────────────────────────┘
```

### Data flow

1. **Tool request** — the LLM proposes a tool call; the Tool Loop submits a structured request to the Policy Engine.
2. **Evaluation** — the engine evaluates the request against the in-memory Rule Cache and returns `ALLOW`, `DENY`, or `REQUIRE_APPROVAL`.
3. **Execution** — on `ALLOW`, the Tool Loop routes execution through the MCP Registry.
4. **Approval** — on `REQUIRE_APPROVAL`, execution pauses until an administrator resolves the request; every step is audited.
5. **Policy update** — dashboard change → database write → Redis publish → every agent reloads its Rule Cache.

Redis functions purely as a synchronization mechanism; it is never involved in authorization.

## Architectural decisions

### Independent backend instead of Next.js API routes

The backend is intentionally a separate Express application — not a collection of CRUD endpoints, but a continuously running system containing the Tool Loop, Policy Engine, MCP Registry, Redis subscribers, and long-lived LLM clients. It maintains state across requests and reacts continuously to environmental changes.

Separating it from the frontend makes the dashboard a pure client. Additional clients — CLIs, mobile apps, future dashboards — can use the same backend without modification.

### Monorepo and shared packages

The project is a monorepo of independent applications plus shared packages providing TypeScript types, validation schemas, a reusable Policy Engine, a reusable MCP Registry, and unified dependency management. Applications import shared contracts directly rather than copying interfaces, giving compile-time consistency with less duplication.

The Policy Engine has no knowledge of Express, Prisma, Redis, or React — it accepts structured requests and returns decisions. That isolation makes it portable, testable, and reusable.

### Dynamic tool discovery

Cossie discovers tools directly from connected MCP servers at runtime rather than maintaining a static list. New tools become available without code changes, and the dashboard reflects them automatically. Discovery is a runtime concern, not a development concern.

### MCP Registry

A dedicated Registry layer handles server discovery, tool lookup, execution routing, and transport abstraction. Local and remote providers coexist behind one interface; adding a server requires registration rather than changes throughout the runtime.

## Runtime design decisions

- **Redis Pub/Sub instead of polling.** Policy changes take effect immediately via event-driven sync — dashboard → database → Redis publish → rule cache reload — rather than every agent polling the database.
- **In-memory Rule Cache.** Loading rules from the database on every tool call would add latency and traffic. The cache is refreshed on policy updates, giving constant-time access during evaluation. The database remains the source of truth.
- **Polling dashboard.** Browsers cannot participate in Redis Pub/Sub. For this scope, the dashboard polls backend endpoints for operational data — simple and adequate for an administrative interface. Backend sync stays event-driven; the frontend stays polling-based.
- **Human approval as a third state.** Not every sensitive operation should be permanently prohibited. `REQUIRE_APPROVAL` pauses execution pending administrator intervention, balancing security with operational flexibility.
- **Prompt injection logged, not blocked.** Suspicious prompts are detected, classified, and surfaced to administrators — not automatically blocked — to avoid false positives for legitimate discussion of injection techniques.
- **Centralized audit logging.** Every significant event flows through a common audit layer, producing a consistent security history.
- **Risk as metadata, not authorization.** Risk describes a tool's impact but never independently authorizes or denies execution; it is context for policy evaluation.
- **Decisions returned, not executed.** The Policy Engine returns `ALLOW`, `DENY`, or `REQUIRE_APPROVAL` and performs no actions itself. The Tool Loop interprets and enforces the outcome.

## Trade-offs

| Decision | Cost | Benefit |
| --- | --- | --- |
| Event-driven backend vs polling | Higher operational complexity | Near-immediate policy propagation; less DB load |
| Polling dashboard vs WebSockets | Higher update latency | No persistent connections or reconnection logic |
| Runtime discovery vs static config | More initialization complexity | Automatic adaptation to new capabilities |
| Config-driven policies vs hardcoded auth | Extra loading/validation/caching/sync | Guardrails change without redeploy |
| Modular packages vs monolith | More project structure | Clear boundaries; isolated testing |
| Prompt logging vs blocking | Weaker preventative security | Fewer false positives |
| Human approval vs auto-enforcement | Added latency | Human oversight for destructive-but-necessary ops |

Across development, decisions favored modularity, runtime configurability, observability, extensibility, and determinism — even when they required extra effort.

## Future evolution

- **Scalability** — the current implementation targets a single agent instance, but authorization, policy sync, and tool discovery are already independent services; additional instances subscribe to the same policy updates with no Policy Engine changes.
- **Policy evolution** — the engine is built around independent evaluators; new types (rate limiting, ABAC, role-based authorization, execution windows) require no changes to existing logic.
- **MCP ecosystem expansion** — additional providers integrate through the registry without changing the agent, engine, or dashboard.

## Summary

Cossie demonstrates that secure AI agent systems benefit from treating reasoning, authorization, and execution as independent concerns. Though currently a focused proof of concept, its architecture provides a strong foundation for production-scale AI agent governance built on the Model Context Protocol.

## Where to next

- [Backend Architecture](/docs/concepts/backend-architecture) — the concrete implementation of these principles.
- [Security Model](/docs/security/security-model) — how the design translates into security guarantees.
- [Policy Engine](/docs/concepts/policy-engine) — the authorization core at the center of the design.
