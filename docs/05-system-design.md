# System Design

Cossie's architecture follows one principle: **AI is responsible for reasoning; infrastructure remains responsible for authorization and execution.** Rather than allowing a language model to directly invoke external systems, Cossie inserts an independent policy layer between AI reasoning and tool execution. This creates a clear separation between *intent* and *permission*:

- The language model determines what it wants to do.
- The Policy Engine determines whether it is allowed.
- Execution occurs only after authorization completes.

## Core Principles

- **Separation of responsibilities.** Reasoning, authorization, discovery, execution and administration are isolated into independent runtime components instead of one monolithic agent handling everything. Benefits: lower coupling, easier testing, simpler reasoning, independent component evolution, improved maintainability.
- **Centralized authorization.** Many AI agents scatter security as conditional statements throughout execution code; Cossie avoids this. All authorization originates from a single Policy Engine:
  - execution logic never decides permissions
  - MCP servers never authorize requests
  - the dashboard never participates in runtime decisions
  - the language model never grants itself permissions

  Every tool request is evaluated through exactly one authorization pipeline, making behavior deterministic, observable and easy to extend.
- **Configuration over code.** Administrators define policies through the dashboard; the running system consumes them dynamically. Adding, modifying or removing guardrails requires no redeployment — operational flexibility, faster incident response, simpler experimentation, reduced deployment risk. Security evolves independently from application releases.
- **Runtime extensibility.** Neither the AI Agent nor the Policy Engine hardcodes a tool list. MCP servers expose tools, the registry discovers them, the dashboard visualizes them, the Policy Engine evaluates them. New MCP servers require no runtime changes.
- **Composition over specialization.** Instead of separate execution paths per server type, the MCP Registry presents a single interface regardless of transport protocol, tool provider, implementation language or execution environment. The platform interacts with tools, not server implementations, reducing coupling to integrations.
- **Long-running runtime.** The AI Agent is a continuously running service, not request-scoped. It keeps in-memory state across execution: discovered tools, rule cache, MCP connections and language model clients. This avoids repeated initialization, reacts immediately to runtime changes, simplifies Redis Pub/Sub synchronization, and enables policy updates without restarts.

## System Boundaries

Operational responsibilities are deliberately split into two planes:

| Plane | Components | Responsibility |
|---|---|---|
| Execution | AI Agent, Policy Engine, MCP Registry, MCP Servers | Processing AI requests safely |
| Management | Dashboard: policy management, approval queue, audit viewer, runtime monitoring | Administration and observability |

Neither plane depends on the other's internal implementation. The dashboard manages runtime behavior but never participates in authorization or execution; the runtime continues operating independently of dashboard availability.

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
 │                                                        │
 │   Tool Loop ──► Policy Engine ──► ALLOW/DENY/APPROVAL  │
 │       │              ▲                                 │
 │       ▼              │ loads                           │
 │  MCP Registry ──► Rule Cache (in-memory)               │
 │    ├─ local MCP servers                                │
 │    └─ remote MCP servers                               │
 └────────────────────────────────────────────────────────┘
```

### Data flow

1. **Tool request:** the LLM proposes a tool call → the Tool Loop submits a structured request to the Policy Engine.
2. **Evaluation:** the Policy Engine evaluates the request against the in-memory Rule Cache and returns `ALLOW`, `DENY` or `REQUIRE_APPROVAL`.
3. **Execution:** on `ALLOW`, the Tool Loop routes execution through the MCP Registry to the appropriate server; results return through the same path.
4. **Approval:** on `REQUIRE_APPROVAL`, execution pauses until an administrator resolves the request in the dashboard's approval queue; every step is recorded in centralized audit logs.
5. **Policy update:** dashboard change → database write → Redis publish → every agent reloads its Rule Cache.

Redis functions purely as a synchronization mechanism; it is never involved in runtime authorization.

## Architectural Decisions

These choices prioritize maintainability, extensibility and runtime flexibility over minimizing initial implementation effort.

### Independent backend instead of Next.js API routes

Next.js supports server-side API routes, but the backend is intentionally a separate Express application. It is not a collection of CRUD endpoints — it is a continuously running system containing the Tool Loop, Policy Engine, MCP Registry, Redis subscribers, Rule Cache, long-lived LLM clients and runtime synchronization. These maintain state across requests and react continuously to environmental changes.

Separating them from the frontend makes the dashboard a pure client rather than hosting runtime infrastructure. Additional clients — CLI tools, mobile applications, future dashboards — can interact with the same backend without modification.

### Express

Express was selected because the project needed only a lightweight HTTP interface around an existing runtime. It introduces very little abstraction while remaining familiar and well-supported; most engineering complexity lives in the runtime itself. A heavier framework would have added implementation complexity with little architectural benefit.

### Monorepo and shared packages

The project is organized as a monorepo of multiple independent applications plus shared packages providing shared TypeScript types, shared validation schemas, a reusable Policy Engine, a reusable MCP Registry and unified dependency management. Applications import shared contracts directly from common packages rather than copying interfaces between services — significantly less duplication with compile-time consistency across the platform.

Certain functionality naturally belongs outside any single application. The Policy Engine, for example, has no knowledge of Express, Prisma, Redis or React: it accepts structured requests and returns authorization decisions. That isolation makes it portable, independently testable and reusable in different environments, and produces clearer boundaries that improve long-term maintainability.

### Dynamic tool discovery

A core requirement was avoiding hardcoded tool definitions. Cossie discovers tools directly from connected MCP servers at runtime instead of maintaining a static list. Consequences: new tools become available without code changes; the dashboard automatically reflects new capabilities; the AI Agent can use them without recompilation; the Policy Engine operates unchanged because it evaluates structured requests, not specific implementations. Discovery becomes a runtime concern rather than a development concern.

Static configuration would tightly couple the application to a predefined infrastructure layout. Treating connected MCP servers as runtime dependencies — discovering capabilities after startup rather than assuming their existence beforehand — is more adaptable and compatible with future MCP ecosystems where servers may appear or disappear dynamically, closer to how production AI infrastructure is expected to evolve.

### MCP Registry

Instead of letting the Tool Loop communicate directly with MCP servers, a dedicated Registry layer handles server discovery, tool discovery and lookup, execution routing and transport abstraction. Everything else interacts only with the registry. Local and remote providers coexist behind one consistent interface; adding a server requires registration rather than changes throughout the runtime.

## Runtime Design Decisions

The runtime emphasizes responsiveness and operational flexibility so that policy updates, tool discovery and execution remain independent.

- **Redis Pub/Sub instead of polling agents.** Policy changes should take effect immediately. Periodically polling the database from every agent was rejected in favor of event-driven sync: dashboard → database → Redis publish → running agent → rule cache reload. Advantages: near real-time synchronization, lower database load, reduced latency, support for multiple running agent instances, cleaner separation between configuration storage and runtime synchronization.
- **In-memory Rule Cache.** Loading the active rule set from the database on every tool execution would add latency and traffic. The cache is refreshed whenever policy updates occur, giving constant-time access during evaluation, lower database utilization, deterministic performance and immediate updates. The database remains the source of truth; the cache exists purely as an execution optimization.
- **Polling dashboard.** Browsers cannot participate directly in Redis Pub/Sub. WebSockets or Server-Sent Events could provide live updates but introduce extra infrastructure and connection management. For this project's scope, the dashboard periodically polls backend endpoints for changing operational data — approvals, audit logs, health information. Simple to implement and adequate for an administrative interface where updates are relatively infrequent. Backend synchronization stays event-driven; frontend stays polling-based; each solves a different problem.
- **Human approval as a third state.** Not every sensitive operation should be permanently prohibited — some are operationally necessary but impactful enough to require explicit authorization (infrastructure changes, production deployments, server restarts, destructive operations). Instead of denying every high-risk request, `REQUIRE_APPROVAL` pauses execution pending administrator intervention; approving via the API executes the stored tool and arguments immediately. Separating approval from denial adds operational flexibility at the cost of administrative latency, representing a balance between security and operational flexibility.
- **Prompt injection handled in tiers, not log-only.** The original design logged suspicious prompts and continued, reasoning that blocking causes false positives. That left detection without enforcement — a confirmed attack verdict had no behavioral consequence. The refined design keeps observability-first for the ambiguous middle band but adds consequences at the edges: suspicious prompts proceed with a security warning injected into the model's system instruction for that message, and critical verdicts (score ≥ 0.85) are hard-blocked before the model sees them. Legitimate security discussion still flows; confident attacks no longer do.
- **System instruction composed at the orchestration layer.** The agent's identity and disclosure policy lives in the tool loop, not inside a provider client, and is passed explicitly to every model call — including the Groq fallback path. Fallback paths commonly preserve functionality but silently drop security invariants; composing the instruction above the provider boundary prevents that. The soft layer (instruction) complements the hard layer (policy engine): instructions shape intent, policies constrain action, and neither substitutes for the other.
- **Conversation state owned by the application.** Messages persist in Postgres and are replayed into model context (last 20 USER/ASSISTANT messages) rather than trusting provider-side session state. This keeps history auditable, makes multi-turn attack trajectories visible, and lets cumulative token usage feed the policy engine's budget rules.
- **Output inspection as a first-class plane.** Model text is inspected before delivery: verbatim system-prompt sentinels and first-person identity disclosure are blocked, secret-shaped content is redacted. Deterministic patterns only — no LLM judge — keeping the output plane cheap and auditable. This catches what input scanning structurally cannot: injection succeeding through tool results (indirect prompt injection) and secrets echoed out of tool data.
- **Infrastructure owns the loop's termination.** The tool loop is capped at 5 iterations regardless of model behavior, and the final response-synthesis call has no tools attached — "do not call more tools" is enforced by capability removal. An LLM is an untrusted decision-maker not only in *what* it chooses but in *how long* it keeps choosing; bounds belong to the orchestrator, mirroring the circuit-breaker pattern from distributed systems.
- **Centralized audit logging.** Every significant runtime event — tool execution, blocked requests, approval creation/resolution, prompt-injection detection, policy enforcement — flows through a common audit logging layer instead of per-subsystem strategies. The result is a consistent security history regardless of event type, simplifying debugging and providing a unified operational history.
- **Risk as metadata, not authorization.** Risk classifications describe a tool's operational impact but never independently authorize or deny execution; they are additional context available to policy evaluation. Risk assessments can evolve independently of authorization logic, administrators can create different policies for the same risk level, and multiple policies can consume the same risk metadata without duplicating logic — avoiding implicit authorization tied to risk labels.
- **Decisions returned, not executed.** The Policy Engine deliberately performs no actions: it never executes tools, creates approvals, writes database records or communicates with MCP servers. It returns one of three outcomes — `ALLOW`, `DENY`, `REQUIRE_APPROVAL` — and the Tool Loop interprets and enforces them. Evaluation separated from execution keeps the layer deterministic, stateless and independently testable, and lets different runtimes consume the same engine unmodified.

## Trade-offs Summary

Every architectural decision introduces trade-offs; Cossie intentionally favors modularity, runtime flexibility and separation of responsibilities over minimizing implementation complexity.

| Decision | Cost | Benefit |
|---|---|---|
| Event-driven backend vs simple polling | Slightly higher operational complexity | Near-immediate policy propagation; less DB load; better scalability |
| Polling dashboard vs WebSockets | Higher update latency | No persistent connections, reconnection logic or deployment overhead |
| Runtime discovery vs static configuration | More initialization complexity | Extensibility; automatic adaptation to new capabilities |
| Config-driven policies vs hardcoded authorization | Extra infrastructure: loading, validation, caching, synchronization | Guardrail changes without redeploy; value grows with deployment size/policy churn |
| Modular packages vs monolithic codebase | Additional project structure and build config | Clear ownership boundaries; isolated testing; independent evolution |
| Prompt tiered response vs log-only | Block rules need calibrated thresholds; critical band requires trust in the scorer | Confident attacks are stopped; ambiguous prompts stay observable; false positives stay low |
| System instruction at orchestration layer | Every provider path must thread it through explicitly | Identity and disclosure policy survive provider failover |
| Output guard (patterns) vs no output check | Possible false positives tuned conservatively (first-person-anchored) | Catches prompt/identity leakage and secret egress the input plane cannot see |
| App-owned conversation history | History must be loaded and trimmed per request | Auditable memory; multi-turn attack visibility; budget rules see real usage |
| Iteration cap + capability scoping | Very long workflows need explicit re-entry | Runaway loops impossible; smaller attack surface per call |
| Human approval vs automatic enforcement | Added operational steps and latency | Human oversight for potentially destructive but necessary operations |

Across development, decisions were consistently evaluated against these priorities — modularity, runtime configurability, observability, extensibility, deterministic behavior, maintainability — even when they required additional implementation effort. The architecture is designed to accommodate future capabilities without significant structural changes to the core runtime.

## Future Evolution

Extensibility was established as a primary goal: the platform sets clear boundaries so future capabilities can be introduced with minimal impact on existing components. The isolated Policy Engine, MCP Registry abstraction and runtime rule synchronization were made specifically to support long-term evolution.

- **Scalability.** The current implementation targets a single AI agent instance, but the architecture extends naturally to multiple agents. Because authorization, policy synchronization and tool discovery are already independent services, additional instances subscribe to the same runtime policy updates with no Policy Engine changes — horizontal scaling with consistent authorization behavior across the platform.
- **Policy evolution.** The engine is built around independent rule evaluators; future types require no modification of existing logic. Potential additions: rate limiting, attribute-based access control (ABAC), role-based authorization, time-based execution windows, execution quotas, network restrictions, geographic restrictions, multi-stage approval workflows. The evaluation pipeline remains unchanged regardless of how many types are supported.
- **MCP ecosystem expansion.** Both local and remote servers are supported today via the common registry abstraction. As the ecosystem grows, additional providers integrate without changing the AI Agent, the Policy Engine, the dashboard or the tool execution model — keeping Cossie provider-agnostic as capabilities arrive through standard MCP interfaces.
- **Operational improvements** (out of current scope but complementary to the existing architecture): automatic execution continuation after approval, WebSocket-based live dashboard updates, distributed audit storage, policy versioning and rollback, execution replay, approval delegation, policy simulation before deployment, rule conflict visualization, signed audit records, cryptographically verified policies. These primarily extend existing components rather than replace them.

## Lessons Learned and Closing Remarks

Developing Cossie reinforced several principles: security is far easier to reason about when authorization is centralized rather than distributed across services; runtime configuration provides substantially greater operational flexibility than embedding authorization logic in code; dynamic discovery lets the platform evolve alongside the MCP ecosystem without continual application changes; and observability must be treated as first-class — Cossie records the complete lifecycle of every significant runtime decision rather than treating logging as an afterthought.

Cossie demonstrates that secure AI agent systems benefit from treating reasoning, authorization and execution as independent concerns. By isolating policy evaluation from tool execution and runtime administration, it remains modular, deterministic and extensible while supporting dynamic infrastructure and evolving security requirements. Though currently a focused proof of concept, its architecture provides a strong foundation for production-scale AI agent governance systems built on the Model Context Protocol.
