# 05-system-design.md

# System Design

## Design Philosophy

Cossie is built around a simple architectural principle:

> AI should be responsible for reasoning. Infrastructure should remain responsible for authorization and execution.

Rather than allowing a language model to directly invoke external systems, Cossie inserts an independent policy layer between AI reasoning and tool execution.

This creates a clear separation between *intent* and *permission*.

The language model determines what it wants to do.

The Policy Engine determines whether it is allowed to do it.

Execution only occurs after authorization has been completed.

This separation forms the foundation of the entire platform.

---

# Separation of Responsibilities

The platform is intentionally divided into independent runtime components.

Each component owns exactly one responsibility.

Rather than building a single monolithic agent responsible for reasoning, authorization, discovery, execution and administration simultaneously, those concerns are isolated into dedicated services.

This produces several advantages:

* lower coupling
* easier testing
* simpler reasoning
* independent evolution of components
* improved maintainability

The major runtime components are:

* AI Agent
* Policy Engine
* MCP Registry
* Dashboard
* MCP Servers

Each communicates through well-defined interfaces without relying on implementation details from neighboring components.

---

# The Policy Engine as the Core

Many AI agents treat security as a collection of conditional statements scattered throughout execution code.

Cossie intentionally avoids this approach.

Instead, all authorization decisions originate from a single Policy Engine.

This means:

* execution logic never decides permissions
* MCP servers never authorize requests
* the dashboard never participates in runtime decisions
* the language model never grants itself permissions

Every tool request is evaluated through exactly one authorization pipeline.

Centralizing authorization in this way makes policy behavior deterministic, observable and significantly easier to extend.

---

# Configuration over Code

Authorization behavior is driven entirely by runtime configuration.

Administrators define security policies through the dashboard.

The running system consumes those policies dynamically.

Adding, modifying or removing guardrails therefore requires no application redeployment.

This approach provides several benefits:

* operational flexibility
* faster incident response
* simpler experimentation
* reduced deployment risk

Security evolves independently from application releases.

---

# Runtime Extensibility

Cossie is designed around runtime discovery rather than compile-time knowledge.

Neither the AI Agent nor the Policy Engine maintains a hardcoded list of available tools.

Instead:

* MCP servers expose tools
* the registry discovers them
* the dashboard visualizes them
* the Policy Engine evaluates them

Because discovery is dynamic, new MCP servers can be introduced without modifying the surrounding runtime.

This architecture scales naturally as additional tool providers are connected.

---

# Composition over Specialization

Rather than building separate execution paths for every type of MCP server, Cossie introduces an abstraction layer through the MCP Registry.

The registry presents a single interface regardless of:

* transport protocol
* tool provider
* implementation language
* execution environment

The remainder of the platform therefore interacts with tools rather than server implementations.

This significantly reduces coupling between the runtime and external integrations.

---

# Long-Running Runtime

The AI Agent is implemented as a continuously running service rather than a request-scoped application.

Several runtime components maintain in-memory state throughout execution, including:

* discovered tools
* rule cache
* MCP connections
* language model clients

Keeping these services alive avoids repeated initialization and allows the platform to react immediately to runtime changes.

This design also simplifies synchronization through Redis Pub/Sub and enables immediate policy updates without restarting the application.

---

# System Boundaries

Cossie intentionally separates operational responsibilities into two independent planes.

The first is the execution plane.

It contains:

* AI Agent
* Policy Engine
* MCP Registry
* MCP Servers

Its responsibility is processing AI requests safely.

The second is the management plane.

It contains:

* Dashboard
* Policy Management
* Approval Queue
* Audit Viewer
* Runtime Monitoring

Its responsibility is administration and observability.

Neither plane depends on the internal implementation of the other.

The dashboard manages runtime behavior but never participates in authorization or execution.

Likewise, the execution runtime continues operating independently of dashboard availability.

---

# Design Goals

Several principles guided the overall system architecture throughout development.

The platform should remain:

* deterministic
* modular
* runtime configurable
* observable
* extensible
* transport agnostic
* provider agnostic

Every architectural decision throughout the project attempts to reinforce one or more of these characteristics rather than optimizing for short-term implementation convenience.


---
# Architectural Decisions

The following sections describe the major architectural decisions made throughout the project, along with the reasoning behind each choice and the associated tradeoffs.

These decisions prioritize maintainability, extensibility and runtime flexibility over minimizing initial implementation effort.

---

# Why an Independent Backend Instead of Next.js API Routes

Although Next.js supports server-side API routes, Cossie intentionally keeps the AI runtime as a separate Express application.

The backend is not a collection of CRUD endpoints.

It is a continuously running system containing:

* the Tool Loop
* Policy Engine
* MCP Registry
* Redis subscribers
* Rule Cache
* long-lived LLM clients
* runtime synchronization

These services maintain state across requests and continuously react to changes in the environment.

Separating them from the frontend produces a cleaner architecture where the dashboard acts purely as a client rather than hosting runtime infrastructure.

This also allows additional clients—such as command-line tools, mobile applications or future dashboards—to interact with the same backend without modification.

---

# Why Express

Express was selected because the project primarily required a lightweight HTTP interface around an existing runtime.

The framework introduces very little abstraction while remaining familiar and well-supported.

Most of the engineering complexity exists inside the runtime itself rather than the web framework.

As a result, introducing a heavier backend framework would have provided little architectural benefit while increasing implementation complexity.

---

# Why a Monorepo

The project is organized as a monorepo containing multiple independent applications and shared packages.

This allows:

* shared TypeScript types
* shared validation schemas
* reusable policy engine
* reusable MCP registry
* unified dependency management

Rather than copying interfaces between services, every application imports shared contracts directly from common packages.

This significantly reduces duplication while ensuring compile-time consistency across the entire platform.

---

# Why Shared Packages

Certain functionality naturally belongs outside any individual application.

Examples include:

* shared types
* policy engine
* MCP registry

Separating these concerns into independent packages produces clearer boundaries and improves long-term maintainability.

The Policy Engine, for example, has no knowledge of Express, Prisma, Redis or React.

It simply accepts structured requests and returns authorization decisions.

This makes it portable, independently testable and reusable in different environments.

---

# Why Dynamic Tool Discovery

One of the project requirements was avoiding hardcoded tool definitions.

Rather than maintaining a static list of supported tools, Cossie discovers tools directly from connected MCP servers at runtime.

This provides several advantages.

New tools become immediately available without code changes.

The dashboard automatically reflects newly discovered capabilities.

The AI Agent can begin using those tools without requiring recompilation.

The Policy Engine continues operating because it evaluates structured requests rather than specific implementations.

Discovery therefore becomes a runtime concern rather than a development concern.

---

# Why an MCP Registry

Instead of allowing the Tool Loop to communicate directly with MCP servers, Cossie introduces a dedicated Registry layer.

The registry serves several purposes:

* server discovery
* tool discovery
* tool lookup
* execution routing
* transport abstraction

The remainder of the platform therefore interacts only with the registry rather than individual servers.

This allows local and remote MCP providers to coexist behind a consistent interface.

Adding a new server requires registration rather than changes throughout the runtime.

---

# Why Runtime Discovery Instead of Static Configuration

Static configuration tightly couples the application to a predefined infrastructure layout.

Cossie instead treats connected MCP servers as runtime dependencies.

The platform discovers available capabilities after startup rather than assuming their existence beforehand.

This makes the architecture significantly more adaptable while remaining compatible with future MCP ecosystems where servers may appear or disappear dynamically.

The resulting system is considerably closer to how production AI infrastructure is expected to evolve.


---


# Runtime Design Decisions

The runtime architecture emphasizes responsiveness and operational flexibility.

Several design decisions were made to ensure that policy updates, tool discovery and execution remain independent while minimizing downtime and unnecessary coupling.

---

# Why Redis Pub/Sub Instead of Polling

Policy changes should become effective immediately after an administrator modifies them.

One possible approach would be for every running agent to periodically poll the database for updates.

Cossie intentionally avoids this approach.

Instead, policy updates follow an event-driven model.

When a policy changes:

Dashboard

↓

Database

↓

Redis Publish

↓

Running Agent

↓

Rule Cache Reload

This provides several advantages:

* near real-time synchronization
* lower database load
* reduced latency
* support for multiple running agent instances
* cleaner separation between configuration storage and runtime synchronization

Redis therefore functions purely as a synchronization mechanism.

It is not involved in runtime authorization.

---

# Why a Rule Cache

Evaluating policies requires access to the active rule set.

Loading these rules from the database during every tool execution would introduce unnecessary latency while increasing database traffic.

Instead, Cossie maintains an in-memory Rule Cache.

The cache is refreshed whenever policy updates occur.

This provides:

* constant-time access during evaluation
* lower database utilization
* deterministic performance
* immediate runtime updates

The database remains the source of truth.

The cache exists purely as an execution optimization.

---

# Why the Dashboard Uses Polling

Unlike backend services, browsers cannot directly participate in Redis Pub/Sub.

While technologies such as WebSockets or Server-Sent Events could provide live updates, they introduce additional infrastructure and connection management.

For the scope of this project, the dashboard periodically polls backend endpoints for changing operational data such as:

* approvals
* audit logs
* health information

This approach provides a significantly simpler implementation while remaining entirely adequate for an administrative dashboard where updates occur relatively infrequently.

Backend synchronization remains event-driven.

Frontend synchronization remains polling-based.

The two mechanisms solve different problems.

---

# Why Human Approval Instead of Automatic Blocking

Not every sensitive operation should be permanently prohibited.

Some actions are operationally necessary but sufficiently impactful that they require explicit authorization.

Instead of treating every high-risk request as a denial, Cossie introduces a third authorization state:

REQUIRE_APPROVAL

This allows the platform to pause execution while waiting for administrator intervention.

Examples include:

* infrastructure changes
* production deployments
* server restarts
* destructive operations

Separating approval from denial provides greater operational flexibility while maintaining administrative oversight.

---

# Why Prompt Injection Is Logged Instead of Blocked

Prompt injection detection intentionally favors observability over aggressive prevention.

Many legitimate users may discuss prompt injection techniques for:

* security research
* education
* debugging
* documentation

Automatically blocking these requests would generate unnecessary false positives.

Instead, suspicious prompts are:

* detected
* classified
* logged
* surfaced to administrators

Execution then proceeds normally.

This approach transforms prompt injection into an observable security signal rather than an automatic execution failure.

Administrators retain visibility without unnecessarily restricting legitimate use cases.

---

# Why Audit Logging Is Centralized

Every significant runtime event is recorded through a common audit logging layer.

Rather than allowing each subsystem to implement its own logging strategy, Cossie centralizes audit generation.

This produces a consistent security history regardless of event type.

Examples include:

* tool execution
* blocked requests
* approval creation
* approval resolution
* prompt injection detection
* policy enforcement

Centralization simplifies debugging while providing a unified operational history for administrators.

---

# Why Risk Is Metadata Instead of Authorization

Risk classifications describe the operational impact of a tool.

They do not independently authorize or deny execution.

Instead, risk serves as additional context available to policy evaluation.

This separation provides several advantages.

Risk assessments can evolve independently of authorization logic.

Administrators may create different policies for the same risk level.

Multiple policies may consume the same risk metadata without duplicating logic.

This distinction keeps the Policy Engine flexible while avoiding implicit authorization behavior tied directly to risk labels.

---

# Why Decisions Are Returned Instead of Executed

The Policy Engine deliberately returns decisions rather than performing actions.

It never:

* executes tools
* creates approvals
* writes database records
* communicates with MCP servers

Instead, it returns one of three outcomes:

* ALLOW
* DENY
* REQUIRE_APPROVAL

The Tool Loop is responsible for interpreting and enforcing those decisions.

Separating evaluation from execution keeps the authorization layer deterministic, stateless and independently testable.

It also allows different runtimes to consume the same Policy Engine without modification.


---

# Architectural Tradeoffs

Every architectural decision introduces tradeoffs.

Cossie intentionally favors modularity, runtime flexibility and clear separation of responsibilities over minimizing implementation complexity.

The following sections describe some of the most significant design tradeoffs made during development.

---

# Event-Driven Backend vs Simpler Polling

Runtime synchronization between the dashboard and the running agent is handled using Redis Pub/Sub.

An alternative approach would have been periodic polling from every agent instance.

Polling would have simplified the implementation but introduced unnecessary database load, slower propagation of policy updates and reduced scalability.

Using an event-driven synchronization model increases operational complexity slightly but allows runtime policy changes to become effective almost immediately.

---

# Polling Dashboard vs WebSockets

The frontend intentionally relies on polling for operational data such as:

* audit logs
* approvals
* runtime health

A WebSocket-based dashboard would provide lower latency and true real-time updates.

However, it would also introduce persistent connection management, reconnection logic and additional deployment complexity.

For an administrative interface where updates occur relatively infrequently, periodic polling provides a simpler and sufficiently responsive solution.

---

# Runtime Discovery vs Static Configuration

Dynamic MCP discovery introduces additional initialization complexity compared to maintaining a static list of available tools.

However, this approach significantly improves extensibility.

New MCP servers can be connected without modifying application code.

The runtime automatically adapts to newly discovered capabilities, making the platform substantially more flexible than a statically configured architecture.

---

# Configuration vs Hardcoded Authorization

Policies are stored as runtime configuration rather than application logic.

This requires additional infrastructure such as:

* rule loading
* validation
* caching
* synchronization

In exchange, administrators gain the ability to modify authorization behavior without redeploying the application.

This flexibility becomes increasingly valuable as deployments grow larger or policies evolve more frequently.

---

# Modular Packages vs Monolithic Codebase

Separating functionality into independent packages introduces additional project structure and build configuration.

However, this produces clearer ownership boundaries and significantly improves maintainability.

The Policy Engine, MCP Registry and shared contracts can evolve independently without becoming tightly coupled to the surrounding runtime.

This also simplifies testing by allowing individual components to be exercised in isolation.

---

# Prompt Logging vs Prompt Blocking

Automatically blocking suspicious prompts would provide stronger preventative security.

However, it would also increase false positives and interfere with legitimate educational or research-oriented conversations.

Cossie instead prioritizes visibility.

Suspicious prompts become observable security events while legitimate interactions continue uninterrupted.

This reflects the philosophy that administrators should be informed of potential misuse without unnecessarily restricting normal usage.

---

# Human Approval vs Automatic Enforcement

Requiring administrator approval introduces additional operational steps before sensitive actions can execute.

While this increases execution latency for certain requests, it also enables human oversight for operations that are potentially destructive but operationally necessary.

The approval workflow therefore represents a balance between security and operational flexibility.

---

# Design Priorities

Throughout development, architectural decisions were evaluated against a consistent set of priorities.

Preference was generally given to solutions that improved:

* modularity
* runtime configurability
* observability
* extensibility
* deterministic behavior
* maintainability

even when those solutions required additional implementation effort.

The resulting architecture is intentionally designed to accommodate future capabilities without requiring significant structural changes to the core runtime.


---

# Future Evolution

Cossie was intentionally designed with extensibility as a primary architectural goal.

Rather than optimizing solely for the current project requirements, the platform establishes clear boundaries that allow future capabilities to be introduced with minimal impact on existing components.

Several architectural decisions—including the isolated Policy Engine, MCP Registry abstraction and runtime rule synchronization—were made specifically to support long-term evolution.

---

# Scalability

The current implementation is designed around a single AI agent instance.

However, the architecture naturally extends to multiple agents.

Because authorization, policy synchronization and tool discovery are already independent services, additional agent instances can subscribe to the same runtime policy updates without requiring changes to the Policy Engine itself.

This enables horizontal scaling while maintaining consistent authorization behavior across the platform.

---

# Policy Evolution

The Policy Engine was intentionally implemented around independent rule evaluators.

Future policy types can be introduced without modifying existing evaluation logic.

Potential additions include:

* rate limiting
* attribute-based access control (ABAC)
* role-based authorization
* time-based execution windows
* execution quotas
* network restrictions
* geographic restrictions
* multi-stage approval workflows

The existing evaluation pipeline remains unchanged regardless of the number of supported policy types.

---

# MCP Ecosystem Expansion

The platform currently supports both local and remote MCP servers through a common registry abstraction.

As the MCP ecosystem grows, additional providers can be integrated without changing:

* the AI Agent
* the Policy Engine
* the dashboard
* the tool execution model

This keeps Cossie provider-agnostic while allowing new capabilities to be introduced through standard MCP interfaces.

---

# Operational Improvements

Several production-oriented enhancements remain outside the scope of the current implementation but naturally complement the existing architecture.

Examples include:

* automatic execution continuation after approval
* WebSocket-based live dashboard updates
* distributed audit storage
* policy versioning and rollback
* execution replay
* approval delegation
* policy simulation before deployment
* rule conflict visualization
* signed audit records
* cryptographically verified policies

These capabilities primarily extend existing components rather than replacing them.

---

# Lessons Learned

Developing Cossie reinforced several architectural principles.

Security is significantly easier to reason about when authorization is centralized rather than distributed across multiple services.

Runtime configuration provides substantially greater operational flexibility than embedding authorization logic directly into application code.

Dynamic discovery enables the platform to evolve alongside the MCP ecosystem without requiring continual application changes.

Finally, treating observability as a first-class concern greatly simplifies debugging, operational monitoring and security investigations.

Rather than viewing logging as an afterthought, Cossie records the complete lifecycle of every significant runtime decision.

---

# Closing Remarks

Cossie demonstrates that secure AI agent systems benefit from treating reasoning, authorization and execution as independent concerns.

By isolating policy evaluation from tool execution and runtime administration, the platform remains modular, deterministic and extensible while supporting dynamic infrastructure and evolving security requirements.

Although the current implementation represents a focused proof of concept, the underlying architecture provides a strong foundation for production-scale AI agent governance systems built on the Model Context Protocol.


---



