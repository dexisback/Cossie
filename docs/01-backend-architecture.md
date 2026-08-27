# 01-backend-architecture.md (Part 1)

# Backend Architecture

This document explains the backend from an engineering perspective.

Unlike `00-project-overview.md`, which focuses on philosophy and high-level architecture, this document explains the actual implementation architecture.

By the end of this document, a reader should understand:

* every backend package
* every service
* every runtime flow
* why every folder exists
* how every subsystem communicates
* why each architectural decision was made

This document intentionally avoids frontend concerns.

Those are covered separately.

---

# Backend Objectives

The backend has one responsibility.

Accept user intent.

Safely execute external tools.

Everything else supports that objective.

The backend is intentionally not:

* a chatbot
* a dashboard backend
* an MCP client

Instead it is an orchestration platform that coordinates multiple independent systems.

---

# Core Backend Responsibilities

The backend currently owns:

* HTTP APIs
* LLM communication
* MCP communication
* policy enforcement
* tool discovery
* tool execution
* runtime synchronization
* approvals
* audit logs
* risk evaluation
* prompt inspection
* persistence

Notice that these are all orchestration responsibilities.

Actual decision making is delegated into dedicated packages.

---

# Backend Layering

The backend follows a layered architecture.

```text
                Presentation Layer
                       │
                  Express Routes
                       │
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

Every layer only communicates downward.

Infrastructure never calls application logic.

The policy engine never knows Express exists.

Routes never directly talk to MCP.

---

# Repository Walkthrough

The repository intentionally separates applications from reusable packages.

```text
apps/

packages/

generated/
```

Each directory has a very different purpose.

---

# apps/

Applications are executable programs.

Each application has an entrypoint.

Examples:

Agent

Dashboard

Custom MCP Server

Applications own:

* bootstrapping
* configuration
* dependency wiring

Applications should never become libraries.

---

# packages/

Packages contain reusable logic.

Packages are framework-independent whenever possible.

Examples:

Policy Engine

Registry

Database

Shared Types

Logger

Packages should never contain application startup logic.

---

# generated/

Contains generated artifacts.

Examples:

Prisma Client.

Nothing inside this directory should ever be edited manually.

Treat generated code as read-only.

---

# Agent Application

The Agent is the runtime of the system.

It does not contain all business logic.

Instead it wires together multiple independent services.

Responsibilities:

Receive HTTP requests.

Start background subscribers.

Register MCP servers.

Initialize caches.

Expose APIs.

Coordinate execution.

The Agent is essentially the runtime container.

---

# Startup Sequence

When the Agent starts:

```text
Load Environment

↓

Create Express

↓

Initialize Prisma

↓

Register MCP Servers

↓

Discover Tools

↓

Persist Tool Catalog

↓

Load Rules

↓

Populate Rule Cache

↓

Start Redis Subscriber

↓

Expose HTTP APIs

↓

Ready
```

Notice that runtime initialization happens before the first request is accepted.

This guarantees:

* rules already loaded
* registry already populated
* tools already discovered

---

# Environment Configuration

Environment variables are intentionally centralized.

Examples include:

DATABASE_URL

REDIS_URL

GEMINI_API_KEY

GROQ_API_KEY

Applications should never hardcode infrastructure endpoints.

---

# Express Layer

Express acts purely as a transport layer.

Responsibilities:

Parse HTTP.

Validate requests.

Delegate to services.

Return responses.

Nothing more.

Business logic belongs elsewhere.

---

# Why Thin Routes?

Consider two approaches.

Approach A

```text
Route

↓

200 lines

↓

Database

↓

Policy

↓

Registry

↓

Logging
```

Approach B

```text
Route

↓

Service

↓

Return
```

Approach B is significantly easier to maintain.

Every route in the project therefore delegates immediately into services.

---

# Route Organization

Routes are grouped by feature.

Examples:

```text
chat.routes.ts

approval.routes.ts

rule.routes.ts

tool.routes.ts

health.routes.ts

log.routes.ts
```

Each route owns one API surface.

Routes should never communicate with each other.

---

# Service Layer

The service layer contains nearly all orchestration logic.

This became one of the most important architectural decisions.

Instead of:

Controllers performing work.

Controllers coordinate services.

Services own behaviour.

---

# Service Philosophy

Every service should answer one question.

"What responsibility do I own?"

If the answer becomes:

"Several unrelated responsibilities"

the service should be split.

---

# Current Services

The backend currently contains services similar to:

ToolLoopService

ChatService

ApprovalService

ApprovalExecutionService

PromptSecurityService

RuleLoaderService

RuleSubscriber

RuleCacheService

LogService

RiskResolver

ToolAdapterService

Each exists because it owns a distinct responsibility.

---

# ToolLoopService

Arguably the most important service.

Responsibilities:

Coordinate execution.

Nothing else.

It does not:

Store rules.

Evaluate policies.

Discover tools.

Talk to Redis.

It simply orchestrates.

Its runtime looks roughly like:

```text
Prompt

↓

Prompt Security

↓

LLM

↓

Function Call?

↓

Policy Engine

↓

Decision

↓

Registry

↓

LLM

↓

Return
```

Everything else happens through delegation.

---

# ChatService

Owns communication with language models.

Responsibilities:

Generate responses.

Retry.

Fallback.

Provider abstraction.

The rest of the application never imports Gemini directly.

Future providers could be added without changing ToolLoopService.

---

# ToolAdapterService

Different LLMs expect different tool formats.

Gemini expects one schema.

Future providers may expect another.

ToolAdapterService transforms:

DiscoveredTool

↓

Gemini Tool Definition

This keeps registry objects provider-independent.

---

# RuleLoaderService

Responsible for exactly one thing.

Loading policies from the database.

Runtime:

Prisma

↓

Read Rules

↓

Validate

↓

Convert

↓

Cache

The loader owns the boundary between persistence and runtime.

---

# Why Validation Happens Here

The database stores JSON.

JSON cannot be trusted.

The loader therefore performs:

Database JSON

↓

Zod

↓

Runtime Rule

↓

Cache

Everything after this point receives validated objects.

This dramatically reduces runtime failures.

---

# RuleCacheService

Rules are evaluated constantly.

Reading PostgreSQL every request would be inefficient.

Instead:

Validated rules remain in memory.

Redis refreshes them when necessary.

Cache ownership belongs entirely to RuleCacheService.

Nothing else mutates cached rules.

---

# Redis Subscriber

The subscriber exists solely for synchronization.

Responsibilities:

Subscribe.

Receive event.

Reload rules.

It does not:

Interpret rules.

Execute policies.

Touch the registry.

It simply keeps runtime state synchronized.

---

# ApprovalService

ApprovalService owns approval state.

Responsibilities:

Create approvals.

Approve.

Reject.

Read pending approvals.

It intentionally does not execute tools.

That responsibility belongs elsewhere.

---

# ApprovalExecutionService

A subtle but important separation.

ApprovalService manages approval records.

ApprovalExecutionService manages what happens after approval.

Separating these prevents approval persistence from becoming coupled to tool execution.

This distinction becomes increasingly valuable as the system grows.

---

# PromptSecurityService

PromptSecurityService operates before the LLM.

Responsibilities:

Scan prompt.

Detect suspicious patterns.

Return structured findings.

It never blocks execution itself.

Instead it informs the rest of the system.

This separation allows future policy-driven responses.

---

# LogService

Logging is centralized.

Every subsystem produces logs through one abstraction.

Benefits:

Consistency.

Future integrations.

Reduced duplication.

Logs become structured rather than arbitrary console output.

---

# End of Part 1

The next section will continue with:

* MCP Registry internals
* Package-by-package architecture
* Complete request lifecycle
* Policy engine internals
* Database model architecture
* Redis architecture
* Tool discovery architecture
* Runtime object lifecycle
* API lifecycle
* Sequence diagrams

---

# 01-backend-architecture.md (Part 2)

# Package Architecture

The backend intentionally moves as much reusable logic as possible into packages.

The applications (`apps/`) should primarily wire together dependencies, while packages (`packages/`) contain reusable domain logic.

This separation ensures that the architecture remains modular as the project grows.

---

# Package Dependency Graph

At a high level, package relationships look like:

```text
                           shared-types
                           /    |      \
                          /     |       \
                         /      |        \
                        /       |         \
               policy-engine   registry    db
                      |            |         |
                      |            |         |
                      +------------+---------+
                                   |
                                apps/agent
```

Notice that almost everything depends on `shared-types`.

Nothing should redefine interfaces independently.

---

# shared-types

This package is arguably the foundation of the repository.

Its purpose is not convenience.

Its purpose is correctness.

Without a shared contract package, each application begins redefining interfaces.

Eventually those definitions drift apart.

shared-types prevents this.

---

## Responsibilities

Defines:

* Rule schemas
* Policy requests
* Policy decisions
* MCP interfaces
* Tool definitions
* Risk types
* Approval types
* Audit types
* Runtime enums

Every package imports these definitions.

No package should redefine them.

---

## Why Zod?

The project intentionally uses Zod instead of TypeScript interfaces alone.

Reason:

TypeScript disappears at runtime.

Database JSON does not.

Runtime validation therefore becomes necessary.

Pipeline:

```text
Database JSON

↓

Zod

↓

Trusted Runtime Object
```

Without runtime validation the engine could crash due to malformed database data.

---

# db Package

The database package owns persistence.

Nothing else.

Responsibilities:

* Prisma initialization
* Neon adapter
* connection management
* exported Prisma instance

Every application imports the same instance.

---

## Why One Prisma Client?

Creating multiple Prisma clients increases unnecessary connections and complicates lifecycle management.

Instead:

```text
packages/db

↓

export prisma

↓

Everyone imports it
```

This also makes future instrumentation easier.

---

# logger Package

Logging is intentionally centralized.

Instead of:

Every service writing its own log format.

Everything passes through a common logger.

Benefits:

Consistent formatting.

Future transports.

Structured logging.

Cloud integration.

OpenTelemetry compatibility.

---

# policy-engine Package

The policy engine represents the core domain.

It is intentionally the most isolated package.

Dependencies are kept minimal.

It does not know:

* Express
* Redis
* Prisma
* Gemini
* Groq
* MCP

It only understands policies.

---

## Inputs

The engine consumes:

```text
PolicyRequest

Rule[]

Runtime Context
```

---

## Output

The engine produces:

```text
PolicyDecision
```

Nothing more.

---

## Why This Is Important

The engine can therefore be reused:

CLI

Worker

REST

Tests

Cron jobs

Another application

without modification.

---

# MCP Registry Package

The Registry abstracts the Model Context Protocol.

Without it:

Every application would implement:

Connection.

Discovery.

Execution.

Caching.

Separately.

Instead:

Registry becomes the single abstraction.

---

## Responsibilities

Register Server

↓

Discover Tools

↓

Cache Tools

↓

Refresh Tools

↓

Execute Tool

↓

Return Result

Everything MCP-related stays inside this package.

---

# Registry Design Philosophy

The Registry does **not** make security decisions.

It assumes:

"If execution reaches me, authorization has already happened."

This separation is extremely important.

---

# Internal Registry Structure

Conceptually:

```text
Registry

├── Server Cache

├── Tool Cache

├── Discovery

├── Execution

└── Refresh
```

Each concern remains independent.

---

# Registry Cache

Each connected server stores:

* configuration
* connection state
* discovered tools
* synchronization timestamp

The cache exists purely for performance.

Persistent storage belongs to the Tool Catalog.

---

# Discovery Lifecycle

When a server registers:

```text
Server Config

↓

Transport Created

↓

Connect

↓

tools/list

↓

Schemas Returned

↓

Risk Classification

↓

Risk Override Resolution

↓

Persist Tool Catalog

↓

Registry Cache
```

This pipeline happens automatically.

---

# Tool Execution Lifecycle

When execution is requested:

```text
Registry

↓

Find Tool

↓

Find Server

↓

Transport

↓

callTool()

↓

Result

↓

Return
```

Registry never knows why execution occurred.

It simply performs execution.

---

# Why Registry Doesn't Talk To Policies

Doing so would create circular responsibilities.

Registry should never ask:

"Am I allowed?"

Registry should only ask:

"How do I execute?"

---

# Runtime Object Architecture

Several runtime objects exist purely in memory.

Understanding them is essential.

---

# RegistryEntry

Represents one connected MCP server.

Contains:

* server config
* tool list
* connection status
* last synchronization

This is not persisted.

It is runtime state.

---

# DiscoveredTool

Represents one MCP capability.

Contains:

* name
* description
* schema
* server id
* inferred risk
* final risk

This object flows throughout the system.

---

# PolicyRequest

Represents an attempted action.

Contains:

Conversation.

Tool.

Arguments.

Context.

This is what enters the Policy Engine.

---

# PolicyDecision

Represents authorization.

Possible outcomes:

ALLOW

DENY

REQUIRE_APPROVAL

The engine never returns anything else.

---

# Rule Object

Rule objects are runtime representations.

They are **not** database rows.

Database rows:

Contain metadata.

Contain JSON.

Runtime rules:

Contain validated typed structures.

This distinction was introduced after discovering runtime mismatches.

---

# Why Runtime Rules Exist

Initially the engine consumed raw Prisma objects.

Problems emerged:

JSON.

Unknown shapes.

Type mismatches.

The architecture evolved.

Current flow:

```text
Database

↓

Validation

↓

Runtime Rule

↓

Engine
```

This became significantly safer.

---

# Backend Runtime Lifecycle

Every request follows a deterministic sequence.

```text
HTTP

↓

Route

↓

Service

↓

Policy

↓

Registry

↓

MCP

↓

Result

↓

LLM

↓

Response
```

Every layer has a single responsibility.

---

# API Layer Philosophy

Routes are intentionally tiny.

Responsibilities:

Receive.

Delegate.

Return.

Everything else belongs to services.

This keeps transport logic independent from business logic.

---

# Why Services Instead Of Fat Controllers

Controllers become difficult to test.

Services:

Can be reused.

Can be composed.

Can be mocked.

Can be independently tested.

Future CLI tools could reuse services directly.

---

# Background Services

Not every component responds to HTTP.

Some run continuously.

Examples:

Redis Subscriber.

Rule Loader.

Registry Cache.

These maintain runtime state independently of requests.

---

# Runtime State vs Persistent State

An important distinction.

Persistent:

Rules.

Approvals.

Logs.

Tool Catalog.

Risk Overrides.

Runtime:

Registry.

Rule Cache.

Active Connections.

These should never be confused.

Runtime state can always be rebuilt from persistence.

---

# Boot Sequence Philosophy

When the backend starts, it should immediately become operational.

That means:

Rules loaded.

Registry ready.

Tools discovered.

Redis subscribed.

Database connected.

No lazy initialization should occur during the first user request.

This improves predictability and startup correctness.

---

# End of Part 2

The next section will cover:

* Complete request lifecycle (line by line)
* ToolLoopService internals
* ChatService internals
* Policy Engine evaluation pipeline
* Rule evaluation flow
* Prompt security flow
* Approval flow
* Audit logging flow
* Database interaction lifecycle
* Complete runtime sequence diagrams

---

# 01-backend-architecture.md (Part 3)

# Complete Runtime Lifecycle

This chapter walks through exactly what happens inside the backend from the moment an HTTP request reaches the application until a response is returned.

Unlike previous sections, this chapter is chronological.

Every component is explained in the order in which it executes.

Think of this as following one request through the entire system.

---

# Complete Request Journey

A typical request looks like:

```text
Client

↓

Express

↓

Route

↓

ToolLoopService

↓

Prompt Security

↓

ChatService

↓

Gemini

↓

Function Call?

↓

Policy Engine

↓

ALLOW
DENY
REQUIRE_APPROVAL

↓

Registry

↓

MCP Server

↓

Tool Result

↓

LLM Summary

↓

HTTP Response
```

Every request follows this pipeline.

---

# Step 1

Incoming HTTP Request

Example:

```
POST /chat

{
    "message":"restart server srv-1"
}
```

The request first reaches Express.

Nothing interesting happens yet.

The transport layer simply parses JSON.

---

# Step 2

Route

Current responsibility:

Receive request.

Extract prompt.

Delegate immediately.

Routes intentionally contain almost no logic.

Example:

```
Request

↓

ToolLoopService.run(prompt)
```

This separation keeps routing concerns isolated from application behaviour.

---

# Step 3

ToolLoopService

This is the true runtime coordinator.

It owns the conversation loop.

It does NOT own:

* policy logic
* MCP execution
* discovery
* logging implementation
* Gemini implementation

Instead it coordinates these systems.

Think of ToolLoopService as the conductor of an orchestra.

---

# Step 4

Prompt Security

Before contacting the LLM:

```
Prompt

↓

PromptSecurity.scan()
```

The service searches for suspicious patterns.

Examples:

ignore previous instructions

act as root

bypass security

override policy

disable guardrails

Current behaviour:

Detection

↓

Audit Log

↓

Continue

Future versions could optionally:

Warn.

Block.

Escalate.

Require approval.

The design intentionally separates detection from enforcement.

---

# Step 5

Audit Event

If suspicious content exists:

```
Prompt Security

↓

LogService

↓

ToolExecutionLog

↓

eventType

PROMPT_INJECTION
```

This creates a permanent audit trail.

The user experience remains uninterrupted.

---

# Step 6

LLM Invocation

ToolLoopService now calls:

```
ChatService.generate(...)
```

ChatService performs:

Provider selection.

Retries.

Fallback.

Response parsing.

Tool definitions are supplied alongside the prompt.

The LLM therefore knows which MCP capabilities exist.

---

# Step 7

Gemini

Primary provider.

Configured using:

Gemini Flash.

The model receives:

System instructions.

User prompt.

Discovered tools.

Conversation context.

Gemini either:

Returns text.

Or requests a function call.

---

# Step 8

Retry Strategy

If Gemini fails:

```
Attempt 1

↓

Wait

↓

Attempt 2

↓

Wait

↓

Attempt 3

↓

Fallback
```

Exponential backoff reduces unnecessary retries.

---

# Step 9

Groq

If Gemini remains unavailable:

ChatService transparently switches providers.

The rest of the backend never knows.

This abstraction keeps ToolLoopService extremely clean.

---

# Step 10

Response Inspection

ToolLoopService inspects Gemini's response.

Two possibilities exist.

Normal response:

```
Return immediately.
```

Function call:

```
Continue Tool Loop.
```

---

# Step 11

Tool Lookup

Example:

```
restart_server
```

Registry performs:

```
registry.getTool()
```

The returned object contains:

Description.

Schema.

Server.

Risk.

Metadata.

---

# Step 12

Policy Request Construction

ToolLoopService builds:

```
PolicyRequest
```

Containing:

Conversation.

Tool.

Arguments.

Runtime context.

This object enters the Policy Engine.

---

# Step 13

Policy Engine

The request now reaches the heart of the system.

Inputs:

PolicyRequest.

Rules.

Risk.

Outputs:

PolicyDecision.

Nothing else.

No databases.

No Redis.

No Express.

Pure business logic.

---

# Step 14

Rule Iteration

The engine walks rules sequentially.

Priority:

Ascending.

Example:

Priority 1.

Priority 10.

Priority 100.

First matching rule wins.

This guarantees deterministic behaviour.

---

# Step 15

Rule Matching

Each rule type owns its own evaluator.

Examples:

Block.

Approval.

Risk.

Budget.

Validation.

Each evaluator answers:

"Does this rule apply?"

Nothing more.

---

# Step 16

Policy Decision

Possible outcomes:

ALLOW.

DENY.

REQUIRE_APPROVAL.

Every evaluator returns exactly one of:

Decision.

Or:

null.

No exceptions.

No side effects.

---

# Step 17

Policy Trace

Every evaluation produces trace information.

Example:

```
Rule

Matched?

Reason
```

These traces become extremely useful.

They enable:

Future dashboard visualization.

Debugging.

Audit explanations.

Policy simulation.

---

# Step 18

Decision Handling

ToolLoopService receives:

PolicyDecision.

Three execution paths now exist.

ALLOW.

DENY.

REQUIRE_APPROVAL.

Everything else diverges from here.

---

# ALLOW Path

```
Policy Engine

↓

ALLOW

↓

Registry.executeTool()

↓

Tool Result

↓

LLM Summary

↓

Return
```

The tool executes immediately.

Execution is logged.

---

# DENY Path

```
Policy Engine

↓

DENY

↓

Audit Log

↓

HTTP Response
```

Registry never executes.

MCP never receives the request.

---

# REQUIRE_APPROVAL Path

```
Policy Engine

↓

ApprovalService

↓

Database

↓

Pending Approval

↓

HTTP Response
```

Execution pauses.

The tool is NOT executed.

---

# Step 19

Approval Storage

Pending approvals persist.

Fields include:

Tool.

Arguments.

Status.

Requested time.

Resolution.

Reason.

Execution can therefore resume hours later.

---

# Step 20

Approval Execution

When an administrator approves:

```
Approval API

↓

ApprovalService

↓

ApprovalExecutionService

↓

Registry

↓

Tool

↓

Audit Log
```

Notice:

Approval persistence.

Tool execution.

Are intentionally separated.

---

# Step 21

Registry Execution

Registry locates:

Server.

Transport.

Tool.

Arguments.

Then:

```
callTool(...)
```

No policy decisions occur here.

Registry assumes authorization already happened.

---

# Step 22

MCP Server

Tool executes.

Possible outcomes:

Success.

Validation error.

Execution error.

Transport failure.

Registry simply forwards results.

---

# Step 23

Tool Result

Result returns to ToolLoopService.

The raw MCP response is NOT sent directly to users.

Instead:

LLM receives:

Original prompt.

Tool result.

Instruction:

Summarize.

No further tool calls.

---

# Step 24

Final LLM Pass

This final prompt intentionally disables additional tool execution.

The model now converts:

Structured tool output.

↓

Natural language.

This creates a much cleaner user experience.

---

# Step 25

HTTP Response

Final text returns.

Conversation ends.

No runtime state remains except:

Logs.

Approvals.

Database updates.

---

# Logging Lifecycle

Logging is woven throughout execution.

Events include:

Prompt injection.

Policy denial.

Approval creation.

Approval approval.

Approval rejection.

Tool execution.

Every log becomes an immutable historical record.

---

# Database Lifecycle

Persistent entities:

Rules.

Approvals.

Logs.

Tool Catalog.

Overrides.

These survive restarts.

Runtime state never does.

---

# Runtime State Lifecycle

Runtime-only objects:

Registry.

Rule Cache.

Connections.

Discovery Cache.

These rebuild automatically on startup.

Nothing important depends on runtime persistence.

---

# Failure Handling

Failures occur at multiple layers.

Examples:

Gemini unavailable.

↓

Fallback.

Redis unavailable.

↓

Existing cache continues.

Database unavailable.

↓

Requests fail safely.

MCP unavailable.

↓

Execution error returned.

The architecture intentionally fails conservatively.

---

# Why This Pipeline Works

Every stage has one responsibility.

Prompt Security inspects.

ChatService communicates.

Policy Engine authorizes.

Registry executes.

LogService records.

ApprovalService persists.

No component performs another component's job.

This dramatically reduces coupling and makes future extensions significantly easier.

---

# Summary

Every request entering the backend follows a deterministic sequence.

No component bypasses another.

No hidden execution paths exist.

The architecture is intentionally linear, observable, and explainable.

Every major decision—from prompt scanning to approval workflows—can be understood by following this single runtime pipeline.

---

**End of Part 3**

The next section will dive into:

* Complete Policy Engine internals
* Every rule type in depth
* Database schema architecture
* Prisma model walkthrough
* Redis event architecture
* MCP Registry internals
* Discovery internals
* Risk classification pipeline
* Approval pipeline internals
* Class-by-class and file-by-file architecture of the backend.

---

# 01-backend-architecture.md (Part 4)

# Policy Engine Architecture

The Policy Engine is the heart of the backend.

Everything else in the backend exists to either:

- prepare data for the policy engine,
- consume its decision,
- or persist its results.

Unlike the Agent, Registry, or Dashboard, the Policy Engine owns the business rules of the platform.

If the Policy Engine disappeared, the project would simply become another MCP client.

Because of this, the engine was intentionally designed to be completely independent from infrastructure.

---

# Design Goals

The engine was designed with several goals.

• Deterministic

The same request should always produce the same decision.

No randomness.

No hidden state.

---

• Stateless

The engine stores nothing internally.

Every evaluation is independent.

This allows:

- easier testing
- horizontal scaling
- predictability

---

• Infrastructure Independent

The engine knows nothing about:

- Express
- Prisma
- Redis
- Gemini
- Groq
- MCP

It only understands:

Rules.

Requests.

Decisions.

---

• Pure Business Logic

Instead of:

```text
Database

↓

Policy
```

the architecture is

```text
Database

↓

Rule Loader

↓

Policy Engine
```

This boundary dramatically simplifies the engine.

---

# Internal Structure

Conceptually:

```text
Policy Engine

│

├── evaluate()

│

├── Rule Evaluators

│

├── Matchers

│

└── Decision Builder
```

Every component has a very small responsibility.

---

# evaluate()

Everything begins here.

Input:

```ts
PolicyRequest

Rule[]

Context
```

Output:

```ts
PolicyDecision
```

Nothing else.

No side effects occur.

---

# Evaluation Lifecycle

Runtime:

```text
Receive Request

↓

Receive Rules

↓

Sort (already sorted)

↓

Iterate

↓

Evaluate Rule

↓

Decision?

↓

Return

↓

Continue

↓

No Match

↓

ALLOW
```

The engine performs no asynchronous work except what is explicitly required.

---

# Why Rules Are Already Sorted

The engine deliberately does **not** sort rules.

Sorting belongs to the Rule Loader.

Reason:

Sorting is a data preparation concern.

Evaluation is a business concern.

Separating these responsibilities keeps the engine extremely simple.

---

# Rule Loader Boundary

Flow:

```text
Prisma

↓

Rule Loader

↓

Validation

↓

Priority Ordering

↓

Rule Cache

↓

Policy Engine
```

The engine therefore receives trusted runtime objects.

---

# PolicyRequest

Represents a user's attempted action.

Current structure includes:

Conversation ID

Tool Name

Arguments

Runtime Context

Future versions could include:

User

Organization

Role

Session

Environment

IP Address

Without changing engine architecture.

---

# PolicyDecision

Every evaluation ends with exactly one decision.

Possible values:

ALLOW

DENY

REQUIRE_APPROVAL

The engine intentionally does not throw authorization errors.

Instead it returns structured decisions.

This allows callers to determine appropriate behaviour.

---

# PolicyTrace

One of the strongest internal features.

Each evaluated rule produces:

```text
Rule

Matched?

Message
```

Example:

```text
BLOCK_TOOL

Matched

Restart tool blocked
```

or

```text
INPUT_VALIDATION

Skipped

Different tool
```

The trace explains *why* a decision occurred.

---

# Why Traces Matter

Without traces:

```text
DENY
```

With traces:

```text
Checked Rule A

↓

Skipped

↓

Checked Rule B

↓

Matched

↓

Decision
```

This becomes invaluable for:

Debugging.

Dashboard visualization.

Policy simulation.

Support.

Auditing.

---

# Rule Evaluators

The engine does not contain one giant switch statement with hundreds of lines.

Instead each rule type owns its own evaluator.

Current evaluators:

evaluateBlockRule()

evaluateApprovalRule()

evaluateBudgetRule()

evaluateRiskRule()

evaluateValidationRule()

Each evaluator owns exactly one policy.

---

# Why Separate Evaluators?

Instead of:

```text
500-line evaluate()
```

the engine delegates.

Benefits:

Smaller files.

Independent testing.

Clear ownership.

Easy extension.

---

# Rule Matchers

Evaluators delegate again.

Example:

evaluateApprovalRule()

↓

matchesApprovalRule()

This separation distinguishes:

Matching

from

Decision building.

---

# Matching

Example:

```text
Rule

↓

Does it apply?

↓

true

↓

Evaluator
```

The matcher should never create decisions.

It simply answers:

"Does this rule apply?"

---

# Decision Construction

Once a matcher returns true:

Evaluator constructs:

Reason.

Decision.

Trace.

Matched Rule.

This separation keeps each layer extremely focused.

---

# Rule Types

The current engine supports five categories.

---

## BLOCK_TOOL

Purpose:

Completely prevent execution.

Example:

```text
restart_server

↓

DENY
```

Highest priority generally wins.

---

## REQUIRE_APPROVAL

Purpose:

Pause execution.

Flow:

```text
Tool

↓

Approval Required

↓

Pending

↓

Approve

↓

Execute
```

Unlike blocking, approval allows execution later.

---

## INPUT_VALIDATION

Purpose:

Validate tool arguments.

Example:

```text
Allowed Prefix

/sandbox/
```

Request:

```text
/etc/passwd
```

↓

DENY

Validation occurs before execution.

---

## RISK_BASED

Purpose:

Decide based on runtime risk.

Example:

```text
HIGH+

↓

Approval
```

Risk becomes another input into policy.

---

## BUDGET_LIMIT

Purpose:

Prevent excessive usage.

Current implementation evaluates runtime token context.

Future versions could integrate:

Provider billing.

Conversation budgets.

Monthly budgets.

Organization quotas.

---

# Rule Priority

Priority solves conflicting policies.

Example:

```text
Priority 1

Block Restart

Priority 10

Require Approval
```

Restart request.

↓

Blocked.

Approval never executes.

Deterministic behaviour is extremely important in authorization systems.

---

# Why Lowest Number Wins

Lower values represent stronger rules.

Benefits:

Easy to understand.

Easy to sort.

Easy to query.

Consistent with many scheduling systems.

---

# Rule Validation

Rules originate as database JSON.

They cannot be trusted.

Pipeline:

```text
Database

↓

Zod

↓

Runtime Rule

↓

Cache

↓

Policy Engine
```

Malformed rules never reach evaluation.

---

# Rule Cache

The engine never queries Prisma.

Instead:

```text
Rule Cache

↓

evaluate()
```

Cache ownership belongs outside the engine.

The engine simply consumes data.

---

# Why The Engine Never Talks To Redis

Redis exists for synchronization.

Policy evaluation exists for authorization.

Combining them would violate separation of concerns.

---

# Failure Philosophy

Invalid rules.

↓

Reject during loading.

Never during evaluation.

The engine should assume:

"If I received this rule, it is valid."

---

# Extending The Engine

Adding a new rule should require:

1.

New schema.

2.

Matcher.

3.

Evaluator.

4.

Switch registration.

Nothing else.

No existing rule should require modification.

This follows the Open/Closed Principle.

---

# Example Future Rules

Examples that could be added without changing architecture:

Time-based policies.

User-based policies.

Organization policies.

Geofencing.

RBAC.

API Cost limits.

Secret access.

Compliance rules.

Every new capability fits naturally into the existing evaluator architecture.

---

# Why This Architecture Works

The Policy Engine has become the most reusable part of the repository.

It is:

Pure.

Deterministic.

Framework-independent.

Transport-independent.

Database-independent.

LLM-independent.

Because of this, the engine could eventually become its own standalone library without requiring major architectural changes.

---

# 01-backend-architecture.md (Part 5)

# Database Architecture

The database is the persistent memory of the platform.

Everything that must survive application restarts ultimately ends up inside the database.

Unlike runtime state (registry cache, rule cache, active connections), the database represents the long-term source of truth.

This section explains every model, why it exists, how it participates in runtime execution, and how the different tables relate to each other.

---

# Database Philosophy

The backend follows a simple principle:

> Runtime should be rebuildable entirely from persistent state.

This means that after restarting the application, the backend should be able to reconstruct itself by reading the database.

Examples:

Rules

↓

Rule Loader

↓

Rule Cache

---

Tool Catalog

↓

Registry Metadata

---

Risk Overrides

↓

Risk Resolver

---

Approvals

↓

Pending Approval Queue

---

Logs

↓

Historical Audit Trail

---

Everything important survives restarts.

---

# Database Responsibilities

The database currently owns five major domains.

1.

Policies

2.

Approvals

3.

Tool Metadata

4.

Audit History

5.

Risk Configuration

Everything else exists only in memory.

---

# Schema Overview

Conceptually:

```text
                     Rule
                      │
                      │
          Policy Engine Runtime
                      │
                      │
      ──────────────────────────────────

Approval      ToolCatalog

ToolRiskOverride

ToolExecutionLog
```

Notice:

Most tables are independent.

The project intentionally avoids deeply coupled relational schemas.

---

# Rule Model

Purpose:

Persistent policy storage.

Without this table:

Policies would need to be hardcoded.

That would violate one of the project's primary requirements.

---

## Lifecycle

Dashboard

↓

POST /rules

↓

Prisma

↓

Rule Table

↓

Redis

↓

Rule Loader

↓

Rule Cache

↓

Policy Engine

---

## Fields

id

Globally unique identifier.

Never changes.

---

name

Human-readable name.

Used by:

Dashboard.

Logs.

Policy traces.

---

description

Optional explanation.

Purely informational.

Useful for administrators.

---

type

Defines which evaluator handles the rule.

Examples:

BLOCK_TOOL

INPUT_VALIDATION

REQUIRE_APPROVAL

RISK_BASED

BUDGET_LIMIT

The Policy Engine dispatches evaluation using this field.

---

priority

Deterministic ordering.

Lower value:

Higher precedence.

This solves conflicting policies.

---

enabled

Allows temporary disabling.

Rules remain stored.

They simply stop participating in evaluation.

No deletion required.

---

config

Arguably the most important field.

Contains rule-specific configuration.

Examples:

BLOCK_TOOL

```json
{
  "toolNames":[
    "restart_server"
  ]
}
```

INPUT_VALIDATION

```json
{
  "toolName":"write_file",
  "allowedPrefix":"/sandbox/"
}
```

Using JSON makes the schema extensible.

New rule types rarely require database migrations.

---

# Why JSON Instead Of Columns?

Alternative:

```text
toolName

allowedPrefix

riskLevel

budget

...
```

Problems:

Mostly NULL columns.

Frequent migrations.

Poor flexibility.

JSON allows each rule to own its own configuration.

The Rule Loader converts JSON into strongly typed runtime objects.

---

# Approval Model

Purpose:

Represents paused tool execution.

The Approval table does **not** store completed executions.

It stores pending decisions.

---

## Lifecycle

Tool Request

↓

Policy Engine

↓

REQUIRE_APPROVAL

↓

Approval Record

↓

Dashboard

↓

Approve / Reject

↓

Execution

---

## Fields

toolName

The requested tool.

---

arguments

Original execution arguments.

Stored exactly as requested.

Execution later reuses them.

---

status

Examples:

PENDING

APPROVED

REJECTED

EXPIRED

Status drives dashboard behaviour.

---

requestedAt

Creation timestamp.

Useful for:

Sorting.

Timeouts.

Metrics.

---

resolvedAt

When approval finished.

Allows duration calculations.

---

resolutionReason

Optional administrator comment.

Useful for audit history.

---

# Why Store Arguments?

Without arguments:

Approval only stores intent.

Actual execution information disappears.

Example:

restart_server

Which server?

Impossible to know.

Persisting arguments allows execution to resume later.

---

# ToolCatalog Model

Purpose:

Persistent inventory of every discovered MCP tool.

Discovery alone is temporary.

Tool Catalog makes discovery durable.

---

## Lifecycle

MCP Discovery

↓

Risk Classification

↓

Risk Override

↓

Persist

↓

Dashboard

---

## Fields

toolName

Unique identifier.

---

description

Human-readable explanation.

---

serverId

Which MCP server owns the tool.

---

inferredRisk

Automatically generated.

---

finalRisk

Runtime risk.

May differ due to overrides.

---

lastSeenAt

When discovery most recently observed this tool.

Useful for stale detection.

---

createdAt

Initial discovery.

---

updatedAt

Latest synchronization.

---

# Why Persist Tool Catalog?

Several reasons.

Dashboard browsing.

Historical inventory.

Risk overrides.

Future analytics.

Without persistence, restarting the application would lose metadata.

---

# ToolRiskOverride Model

Purpose:

Allow administrators to override automatic classification.

---

## Lifecycle

Discovery

↓

Infer HIGH

↓

Administrator

↓

CRITICAL

↓

Database

↓

Risk Resolver

↓

Runtime

---

Fields:

toolName

riskLevel

timestamps

---

# Why Separate Overrides?

Alternative:

Modify Tool Catalog directly.

Problems:

Original inference disappears.

Cannot distinguish:

Automatic.

Manual.

Keeping overrides separate preserves both.

---

# ToolExecutionLog Model

Purpose:

Immutable audit history.

Every meaningful event produces one record.

---

## Event Sources

Prompt Injection

↓

Audit

---

Policy Decision

↓

Audit

---

Approval Created

↓

Audit

---

Approval Approved

↓

Audit

---

Approval Rejected

↓

Audit

---

Tool Executed

↓

Audit

---

Every important security event becomes searchable.

---

## Fields

toolName

Which capability was involved.

---

eventType

Describes what happened.

Examples:

TOOL_EXECUTION

PROMPT_INJECTION

APPROVAL_CREATED

APPROVAL_APPROVED

APPROVAL_REJECTED

---

decision

ALLOW

DENY

REQUIRE_APPROVAL

Separating eventType from decision creates richer analytics.

---

arguments

Stores execution arguments.

Allows later investigation.

---

reason

Human-readable explanation.

Often originates from Policy Engine.

---

matchedRule

Which rule produced the decision.

Very useful during debugging.

---

trace

Structured metadata.

Can contain:

Matched patterns.

Policy traces.

Risk metadata.

Future debugging information.

JSON was intentionally chosen here because trace structures evolve over time.

---

executed

Boolean.

Did execution actually happen?

Examples:

DENY

↓

false

ALLOW

↓

true

PROMPT_INJECTION

↓

false

---

conversationId

Allows future grouping.

Current implementation uses a placeholder.

Architecture already supports multi-conversation systems.

---

timestamps

Every audit event is timestamped.

This enables:

Chronological reconstruction.

---

# Why Immutable Logs?

Logs should never be edited.

Editing destroys trust.

Instead:

Create.

Read.

Never modify.

---

# Runtime Objects vs Database Rows

One important architectural distinction.

Database Rule

↓

JSON

↓

Rule Loader

↓

Runtime Rule

Database rows should never enter business logic directly.

The Rule Loader creates trusted runtime objects.

This separation significantly reduced runtime bugs during development.

---

# Read Patterns

Current read-heavy tables:

Rules

Tool Catalog

Approvals

Logs

These power the dashboard.

---

# Write Patterns

Writes occur during:

Rule creation.

Tool discovery.

Prompt detection.

Tool execution.

Approvals.

The workload is modest and well suited for PostgreSQL.

---

# Why PostgreSQL?

Reasons:

Strong consistency.

JSON support.

Excellent tooling.

Prisma compatibility.

Neon integration.

Future scalability.

---

# Why Prisma?

Prisma provides:

Type safety.

Migration tooling.

Developer productivity.

Excellent TypeScript integration.

The generated client also dramatically reduces query mistakes.

---

# Future Schema Evolution

Likely additions:

Conversation

User

Organization

PolicyVersion

Role

Session

Notification

MCPServer

ExecutionMetrics

These additions fit naturally without major redesign.

---

# Database Philosophy Summary

The database intentionally stores only durable state.

Runtime objects remain in memory.

Everything persistent is rebuildable.

Everything rebuildable is intentionally excluded from persistence.

This separation keeps the architecture predictable, resilient, and easy to reason about.

---
# 01-backend-architecture.md (Part 6)

# MCP Registry Architecture

After the Policy Engine, the MCP Registry is arguably the second most important package in the entire backend.

If the Policy Engine answers:

> "Should this tool execute?"

the Registry answers:

> "How do I execute this tool?"

These are intentionally different responsibilities.

The Registry owns everything related to the Model Context Protocol (MCP).

The rest of the backend should never directly interact with MCP transports or SDKs.

---

# Registry Philosophy

The Registry exists to isolate MCP-specific complexity.

Without the Registry, every service would need to understand:

- MCP Clients
- Tool Discovery
- Tool Execution
- Transport Types
- Connection Lifecycle

Instead:

```text
Application

↓

Registry

↓

MCP
```

The Registry becomes the single abstraction layer.

---

# Design Principles

The Registry follows several principles.

## Transport Agnostic

Whether the server uses:

- stdio
- SSE

should not matter to callers.

The Registry hides those differences.

---

## Runtime Discovery

The Registry never contains hardcoded tool definitions.

Everything originates from:

```text
tools/list
```

at runtime.

---

## Execution Only

The Registry does not perform:

Authorization.

Logging.

Approvals.

Prompt inspection.

Its responsibility begins only after execution has been approved.

---

## Cached State

Registry maintains runtime cache.

Not persistent storage.

Persistent metadata belongs inside ToolCatalog.

---

# Internal Components

Conceptually:

```text
Registry

├── Server Manager
├── Discovery Engine
├── Runtime Cache
├── Execution Engine
├── Transport Factory
└── Refresh Logic
```

Each subsystem has one responsibility.

---

# Server Registration

Everything begins with server registration.

During application startup:

```text
Startup

↓

registerServer(server)
```

Server configuration contains:

- id
- transport
- command/url
- args

The Registry stores configuration.

Discovery immediately begins.

---

# Server Configuration

The Registry intentionally stores only enough information to reconnect later.

Typical configuration:

```text
id

transport

command

args

url
```

No runtime connection objects are persisted.

Connections are rebuilt as needed.

---

# Discovery Lifecycle

Discovery occurs immediately after registration.

Flow:

```text
Server Config

↓

Create Transport

↓

Connect Client

↓

tools/list

↓

Receive Schemas

↓

Transform

↓

Risk Classification

↓

Risk Override

↓

Persist Catalog

↓

Registry Cache
```

This entire process is automatic.

---

# Why Runtime Discovery?

The project explicitly required:

> No hardcoded tool lists.

Runtime discovery satisfies this requirement.

Benefits:

Supports arbitrary MCP servers.

Supports future tools.

Supports third-party plugins.

Supports hot-refresh.

---

# Discovery Output

Discovery produces:

DiscoveredTool[]

Each object contains:

Tool name.

Description.

Input schema.

Server ownership.

Risk.

This array becomes the runtime inventory.

---

# Registry Cache

Internally the Registry maintains:

```text
Map<ServerId, RegistryEntry>
```

Each RegistryEntry stores:

Configuration.

Discovered tools.

Connection status.

Last synchronization.

This cache exists only during runtime.

---

# Why Cache?

Without caching:

Every request would execute:

```text
tools/list
```

This would be extremely inefficient.

Instead:

Discovery occurs once.

Execution reuses cached metadata.

---

# RegistryEntry

Conceptually:

```text
RegistryEntry

server

tools

connected

lastSyncedAt
```

The RegistryEntry represents one MCP server.

Not one tool.

---

# Multiple Servers

Registry supports multiple MCP servers simultaneously.

Example:

```text
infra-mcp

↓

restart_server

deploy_release

rollback_release

-------------------------

context7

↓

search_docs

resolve_library

fetch_page
```

Both appear as one unified tool inventory.

The LLM does not care which server owns which tool.

---

# Tool Lookup

When ToolLoop requests:

```text
restart_server
```

Registry performs:

```text
getTool(toolName)
```

Returns:

DiscoveredTool

including:

Server ownership.

Schema.

Risk.

Metadata.

---

# Why Lookup First?

Execution requires knowing:

Which server owns this tool?

Without lookup:

Execution would be impossible.

---

# Execution Pipeline

Once authorized:

```text
Tool Name

↓

Find Tool

↓

Find Server

↓

Create Execution Request

↓

callTool()

↓

Result
```

Notice:

Authorization has already completed.

Registry simply executes.

---

# Transport Abstraction

Registry supports multiple transports.

Currently:

stdio

SSE

Internally:

```text
Transport Factory

↓

Correct Client

↓

Connect
```

The rest of the application never branches on transport.

---

# stdio Transport

Typically used for:

Local MCP servers.

Flow:

```text
Spawn Process

↓

Connect

↓

Exchange Messages

↓

Execute Tools
```

Useful for:

Development.

Local integrations.

Custom servers.

---

# SSE Transport

Typically used for:

Remote servers.

Flow:

```text
HTTP

↓

SSE

↓

Persistent Stream

↓

Messages
```

Useful for:

Hosted MCP providers.

Cloud services.

---

# Why Abstract Transport?

Without abstraction:

Every execution path would require:

```text
if stdio...

else SSE...
```

Registry hides this complexity.

---

# Discovery Refresh

Tools may change.

Server may expose:

New tools.

Removed tools.

Updated schemas.

Refresh pipeline:

```text
Refresh

↓

tools/list

↓

Replace Cache

↓

Update Catalog

↓

Ready
```

No restart required.

---

# Tool Refresh Endpoint

Backend exposes:

```text
POST /tools/refresh
```

Purpose:

Force rediscovery.

Useful when:

New MCP server deployed.

New tools added.

Schemas changed.

---

# Runtime Synchronization

Refresh performs two updates.

Runtime:

Registry cache.

Persistence:

Tool Catalog.

Keeping both synchronized prevents stale metadata.

---

# Registry Failure Handling

Possible failures:

Transport failure.

Discovery failure.

Server unavailable.

Malformed schema.

Execution failure.

Registry should fail gracefully.

The application should continue operating whenever possible.

---

# Discovery Failure

If discovery fails:

Registry marks server disconnected.

Previously persisted Tool Catalog remains.

Dashboard can indicate stale state.

Future improvements:

Automatic retries.

Health checks.

Reconnect backoff.

---

# Execution Failure

Possible causes:

Tool exception.

Timeout.

Transport lost.

Server crash.

Registry simply returns the error.

Policy Engine is unaffected.

---

# Why Registry Doesn't Retry Tool Execution

Retries belong to business logic.

Not infrastructure.

Executing destructive operations twice may be dangerous.

Example:

restart_server

Retrying automatically may restart infrastructure multiple times.

Therefore Registry executes exactly once.

---

# Registry and Tool Catalog

Registry cache:

Runtime.

Tool Catalog:

Persistence.

The distinction is important.

Registry rebuilds itself from MCP.

Tool Catalog preserves historical metadata.

---

# Registry and Policy Engine

Relationship:

```text
Registry

↓

Discovery

↓

Risk

↓

Policy Engine
```

Policy Engine never discovers tools.

Registry never evaluates policies.

Each system owns one concern.

---

# Registry and Dashboard

Dashboard never communicates with MCP directly.

Instead:

Dashboard

↓

Agent API

↓

Registry

↓

MCP

This ensures:

Authentication.

Logging.

Policies.

Consistency.

---

# Future Improvements

Possible future capabilities:

Connection Pooling.

Streaming tool execution.

Health monitoring.

Reconnect strategies.

Circuit breakers.

Metrics.

Latency tracking.

Concurrent execution.

Load balancing.

Multiple instances of same MCP server.

---

# Why This Architecture Works

The Registry successfully isolates all MCP complexity behind a very small API.

The rest of the backend simply asks:

```text
Register Server

Get Tool

Get Tools

Refresh

Execute Tool
```

It never needs to understand transports, discovery protocols, SDK details, or connection management.

This dramatically simplifies the Agent while making the Registry independently reusable.

---

# Summary

The Registry acts as the backend's gateway into the MCP ecosystem.

It owns:

- server management
- runtime discovery
- transport abstraction
- execution
- runtime caching

while deliberately avoiding:

- authorization
- logging
- approvals
- prompt security
- business rules

This separation keeps the overall architecture clean, modular, and faithful to the principle that every subsystem should own exactly one responsibility.

---
# 01-backend-architecture.md (Part 7)

# Service Architecture

The service layer contains the application's orchestration logic. Services coordinate packages and infrastructure while keeping routes thin and packages focused on a single responsibility.

Unlike packages, services are application-specific. They understand the runtime environment and compose lower-level modules together.

---

# Service Dependency Graph

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

---

# ToolLoopService

Purpose:

Central orchestrator of the AI agent.

Responsibilities:

* Receive user prompt
* Scan prompt
* Call LLM
* Detect tool calls
* Invoke Policy Engine
* Execute approved tools
* Log events
* Generate final response

Should never:

* Query Prisma directly
* Evaluate policies
* Discover tools

---

# ChatService

Purpose:

Abstract LLM providers.

Responsibilities:

* Generate completions
* Retry failed requests
* Perform provider fallback
* Hide provider-specific SDKs

Future providers can be added without modifying ToolLoopService.

---

# PromptSecurityService

Purpose:

Detect suspicious prompts before LLM execution.

Responsibilities:

* Pattern matching
* Return structured findings
* Never enforce policy directly

Output:

```text
Suspicious?

Matched Patterns

Reason
```

---

# RuleLoaderService

Purpose:

Load runtime policies.

Pipeline:

```text
Database

↓

Validate

↓

Sort

↓

Cache
```

This service owns the persistence → runtime boundary.

---

# RuleCacheService

Purpose:

Provide fast in-memory access to validated rules.

Only RuleLoaderService should modify this cache.

Every other component reads from it.

---

# ApprovalService

Owns approval records.

Responsibilities:

* Create approval
* Approve
* Reject
* List pending approvals

It never executes tools.

---

# ApprovalExecutionService

Purpose:

Resume execution after approval.

Separating execution from persistence prevents ApprovalService from accumulating unrelated responsibilities.

---

# LogService

Purpose:

Provide a single logging abstraction.

Every subsystem logs through this service.

Benefits:

* Consistent format
* Centralized future integrations
* Easier testing

---

# ToolAdapterService

Purpose:

Convert discovered MCP tools into provider-specific tool definitions.

Current implementation:

DiscoveredTool

↓

Gemini Tool

Future providers can introduce new adapters without modifying discovery.

---

# RiskResolver

Purpose:

Resolve final runtime risk.

Pipeline:

```text
Infer Risk

↓

Override Lookup

↓

Final Risk
```

The Policy Engine always consumes the resolved value.

---

# Service Collaboration

A typical tool execution looks like:

```text
ToolLoopService

↓

PromptSecurityService

↓

ChatService

↓

PolicyEngine

↓

Registry

↓

LogService
```

Every service performs one step before delegating to the next.

---

# Why Services Exist

Services prevent:

* Fat controllers
* Circular dependencies
* Duplicated orchestration
* Mixed responsibilities

They form the application's coordination layer while leaving reusable logic inside packages.

---

# Service Design Rules

Every new service should satisfy these principles:

* Own exactly one responsibility.
* Delegate specialized work.
* Avoid infrastructure duplication.
* Avoid business logic duplication.
* Be independently testable.
* Avoid calling sibling services unless orchestration requires it.

The service layer should remain the glue of the backend rather than becoming another domain layer.


---

# 01-backend-architecture.md (Part 8)

# API Architecture

The Agent exposes a REST API that acts as the single entry point into the platform.

Neither the Dashboard nor external clients communicate directly with internal packages such as the Policy Engine or the Registry. Every interaction flows through these APIs.

This keeps authorization, logging, validation, and orchestration centralized.

---

# API Philosophy

The API layer follows several principles.

* REST-first
* Thin routes
* Service-oriented
* Stateless
* JSON communication
* No business logic inside controllers

Each endpoint delegates almost immediately to the corresponding service.

---

# Endpoint Groups

The API is divided into feature-based modules.

```text
/chat

/rules

/tools

/approvals

/logs

/health
```

Each module owns a single domain.

---

# Chat APIs

Purpose:

Primary interaction point with the AI Agent.

Current endpoint:

```text
POST /chat
```

Responsibilities:

* Accept prompt
* Execute tool loop
* Return final response

Everything else happens internally.

---

# Rule APIs

Purpose:

Manage runtime policies.

Typical operations:

```text
GET    /rules

POST   /rules

PATCH  /rules/:id

DELETE /rules/:id
```

Every modification eventually results in:

```text
Database

↓

Redis Publish

↓

Rule Reload
```

No restart required.

---

# Tool APIs

Purpose:

Expose discovered MCP tools.

Examples:

```text
GET /tools
```

Returns:

Current Tool Catalog.

---

```text
POST /tools/refresh
```

Triggers:

Runtime rediscovery.

---

```text
PATCH /tools/:tool/risk
```

Creates or updates a risk override.

---

```text
GET /tools/:tool/risk
```

Returns the effective override for that tool.

---

# Approval APIs

Purpose:

Human approval workflow.

Examples:

```text
GET /approvals
```

Returns pending approvals.

---

```text
POST /approvals/:id/approve
```

Updates approval state and resumes execution.

---

```text
POST /approvals/:id/reject
```

Rejects execution permanently.

---

# Log APIs

Purpose:

Audit visibility.

Example:

```text
GET /logs
```

Returns immutable execution history.

Future improvements:

Filtering.

Pagination.

Search.

Time ranges.

---

# Health APIs

Purpose:

Operational monitoring.

Current endpoint:

```text
GET /health
```

Reports:

* Database status
* Uptime
* Registered MCP servers
* Discovered tools

Future improvements:

Redis health.

LLM provider health.

Latency metrics.

Version information.

---

# API Flow

Every endpoint follows the same structure.

```text
Client

↓

Express Route

↓

Validation

↓

Service

↓

Package(s)

↓

Database / Registry

↓

Response
```

This consistency keeps the backend predictable.

---

# Error Handling

Errors are propagated upward through services.

Typical categories:

* Validation errors
* Database errors
* MCP failures
* LLM failures
* Policy denials

Each endpoint should return structured JSON rather than raw stack traces.

---

# Response Philosophy

Responses should describe:

* What happened
* Whether it succeeded
* Why it failed (if applicable)

Avoid exposing implementation details.

---

# Future API Evolution

The current REST architecture leaves room for:

* Authentication
* OpenAPI generation
* Versioning
* Rate limiting
* WebSockets
* Streaming responses
* GraphQL gateway (if ever required)

No existing architecture would need major changes to support these additions.

---

# Backend Summary

The backend is intentionally layered.

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

Each layer has one responsibility.

Each package has one owner.

Each service orchestrates rather than implements domain logic.

The result is a backend that is modular, predictable, and straightforward to extend.

---

# End of Backend Architecture

This document has covered:

* Backend philosophy
* Repository organization
* Package architecture
* Runtime lifecycle
* Policy Engine
* Database architecture
* MCP Registry
* Service layer
* REST API

The next document, **02-api-reference.md**, will switch from architecture to implementation and document every endpoint in detail, including request/response schemas, runtime behavior, edge cases, error conditions, and examples.

----
