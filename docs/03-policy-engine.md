# 03-policy-engine.md (Part 1)

# Policy Engine

The Policy Engine is the core security component of Cossie.

Its responsibility is simple:

> Decide whether an AI agent is allowed to execute a requested action.

The engine sits between the LLM and the MCP Registry, ensuring that every tool invocation is evaluated against administrator-defined guardrails before execution.

It is intentionally designed as a standalone package so that it remains independent of Express, Prisma, Redis, Gemini, Groq, and MCP transports.

---

# Responsibilities

The Policy Engine is responsible for:

* Evaluating policy rules
* Producing authorization decisions
* Generating evaluation traces
* Applying deterministic rule precedence

It is **not** responsible for:

* Loading rules from the database
* Discovering MCP tools
* Executing tools
* Logging
* Persisting approvals
* HTTP handling

---

# Inputs

The engine evaluates three inputs.

### Policy Request

Represents the attempted action.

Example:

```text
Tool:
restart_server

Arguments:
{
  serverId: "srv-1"
}
```

---

### Active Rules

A validated, in-memory list of enabled rules supplied by the Rule Cache.

The engine assumes these rules have already been:

* Loaded
* Validated
* Sorted by priority

---

### Runtime Context

Additional contextual information that influences evaluation.

Current context includes:

* Tool risk level
* Token usage (budget rules)

Future versions could include:

* User identity
* Organization
* Environment
* Time of day
* Geographic region

---

# Outputs

Every evaluation produces exactly one `PolicyDecision`.

Current decision types:

```text
ALLOW

DENY

REQUIRE_APPROVAL
```

The engine never throws authorization exceptions.

Instead, callers receive a structured decision describing the outcome.

---

# Evaluation Philosophy

The engine follows a deterministic "first match wins" strategy.

Example:

```text
Priority 1

Block restart_server

↓

Priority 10

Require approval for restart_server
```

A restart request will always be denied because the higher-priority rule matches first.

This guarantees predictable behavior.

---

# Policy Trace

Every evaluation records a trace of rule processing.

Example:

```text
BLOCK_TOOL

Matched

↓

Decision: DENY
```

or

```text
BLOCK_TOOL

Skipped

↓

INPUT_VALIDATION

Matched

↓

Decision: DENY
```

These traces provide explainability for administrators and are intended to power future dashboard visualizations.

---

# Evaluation Pipeline

Every tool request follows the same sequence.

```text
Tool Request

↓

Policy Request

↓

Rule Iteration

↓

Rule Match

↓

Decision

↓

Trace

↓

Return
```

No external systems are contacted during evaluation.

This keeps the engine fast, deterministic, and easily testable.

---

# Design Principles

The Policy Engine follows several guiding principles.

* Stateless
* Deterministic
* Pure business logic
* Infrastructure independent
* Easily extensible

These principles make the engine reusable outside the current application and allow future rule types to be added with minimal changes.

---

The following sections explain how rules are evaluated internally, how each rule type works, and how new guardrails can be added to the engine.


---
# 03-policy-engine.md (Part 2)

# Rule Evaluation Pipeline

Every tool request entering the Policy Engine follows the same evaluation process.

The engine does not know where the request came from or how the decision will be used.

Its only responsibility is to evaluate the request against the active policy set.

---

# Evaluation Flow

The complete evaluation pipeline is:

```text id="9ckx6r"
PolicyRequest

↓

Rule Cache

↓

Rule 1

↓

Rule 2

↓

Rule 3

↓

Decision

↓

Return PolicyDecision
```

Rules are evaluated sequentially in ascending priority order.

---

# Rule Priority

Each rule contains a priority value.

Example:

| Priority | Rule                                |
| -------- | ----------------------------------- |
| 1        | Block restart_server                |
| 5        | Require approval for restart_server |
| 10       | Risk-based approval                 |

The engine always evaluates lower numbers first.

This guarantees deterministic conflict resolution.

---

# Rule Evaluation

Each rule follows the same lifecycle.

```text id="4t4vxf"
Receive Rule

↓

Does it Match?

↓

No

↓

Continue

↓

Yes

↓

Build Decision

↓

Return
```

If a rule does not match, evaluation continues.

If a rule matches, evaluation stops immediately.

---

# Matchers

Every rule type has its own matcher.

Examples:

```text id="9kkfyy"
matchesBlockToolRule()

matchesApprovalRule()

matchesRiskRule()

matchesBudgetRule()

matchesInputValidationRule()
```

Matchers answer one question:

> Does this rule apply to the current request?

They never create decisions.

---

# Evaluators

Each matcher is wrapped by an evaluator.

Example:

```text id="fjsl2z"
evaluateApprovalRule()

↓

matchesApprovalRule()

↓

Matched?

↓

Create PolicyDecision
```

Evaluators construct:

* Decision
* Reason
* Trace
* Matched Rule

---

# Decision Construction

Every successful evaluation returns a structured decision.

Example:

```text id="48p41u"
Decision

ALLOW

Reason

"No policy violations detected"

Matched Rule

null
```

or

```text id="nyc0lt"
Decision

DENY

Reason

"restart_server is blocked"

Matched Rule

"Block Restart"
```

This makes every authorization decision explainable.

---

# Evaluation Trace

The engine records every rule that was evaluated.

Example:

```text id="wdmgv8"
Rule

Block Restart

Matched

✓

----------

Rule

Approval Rule

Skipped
```

These traces are returned with the final decision and can later be displayed in the dashboard.

---

# Performance

The evaluation process is lightweight.

No:

* Database queries
* Redis calls
* Network requests
* LLM invocations

occur during evaluation.

Everything operates on in-memory data structures.

This keeps policy evaluation extremely fast.

---

# Failure Handling

The engine assumes all rules are valid.

Validation occurs before rules enter the cache.

If a malformed rule exists, it is rejected during loading rather than during evaluation.

This keeps the evaluation loop simple and predictable.

---

# Extending Evaluation

Adding a new rule requires only four steps:

1. Define a new rule schema.
2. Implement a matcher.
3. Implement an evaluator.
4. Register the evaluator in the engine.

Existing rule implementations remain unchanged.

This follows the Open/Closed Principle and keeps the engine easy to extend as new guardrails are introduced.

---

The next section covers every supported rule type, how it works, and when it should be used.

---
# 03-policy-engine.md (Part 3)

# Supported Rule Types

The current Policy Engine supports five rule categories.

Each rule addresses a different aspect of AI agent governance.

All rule types follow the same evaluation model while enforcing different security constraints.

---

# BLOCK_TOOL

Purpose:

Prevent specific tools from ever executing.

Example configuration:

```json
{
  "type": "BLOCK_TOOL",
  "toolNames": [
    "restart_server",
    "delete_server"
  ]
}
```

Evaluation:

```text
Tool Request

↓

Tool Name

↓

toolNames.includes(...)

↓

Match?

↓

DENY
```

Typical use cases:

* Dangerous administrative actions
* Disabled production tools
* Temporary operational restrictions

---

# REQUIRE_APPROVAL

Purpose:

Pause execution until a human approves the request.

Example configuration:

```json
{
  "type": "REQUIRE_APPROVAL",
  "toolNames": [
    "restart_server"
  ]
}
```

Evaluation:

```text
Tool Request

↓

Rule Match

↓

REQUIRE_APPROVAL

↓

Approval Record Created

↓

Execution Paused
```

Typical use cases:

* Infrastructure changes
* Production deployments
* High-risk operations
* Financial transactions

---

# INPUT_VALIDATION

Purpose:

Validate tool arguments before execution.

Example configuration:

```json
{
  "type": "INPUT_VALIDATION",
  "toolName": "write_file",
  "allowedPrefix": "/sandbox/"
}
```

Evaluation:

```text
Tool Request

↓

Inspect Arguments

↓

Valid?

↓

ALLOW

or

DENY
```

Typical use cases:

* File path restrictions
* Input sanitization
* Parameter validation
* Directory allowlists

---

# RISK_BASED

Purpose:

Apply policies based on a tool's runtime risk classification.

Example configuration:

```json
{
  "type": "RISK_BASED",
  "minimumRisk": "HIGH",
  "decision": "REQUIRE_APPROVAL"
}
```

Evaluation:

```text
Tool Risk

↓

Compare Threshold

↓

Decision
```

Because risk is stored separately from policy, administrators can change a tool's classification without modifying the policy itself.

---

# BUDGET_LIMIT

Purpose:

Prevent excessive resource consumption.

Example configuration:

```json
{
  "type": "BUDGET_LIMIT",
  "maxTokens": 50000
}
```

Evaluation:

```text
Current Usage

↓

Compare Budget

↓

ALLOW

or

DENY
```

The current implementation supports conversation-level token checks.

Future versions could extend this to:

* Daily quotas
* Monthly budgets
* Per-user limits
* Per-organization limits
* Cost-based budgets

---

# Rule Independence

Every rule is evaluated independently.

A Block rule never knows about Approval rules.

Approval rules never know about Budget rules.

This isolation keeps implementations simple and minimizes coupling.

---

# Conflict Resolution

Conflicting rules are resolved using priority.

Example:

| Priority | Rule             | Decision         |
| -------- | ---------------- | ---------------- |
| 1        | Block Restart    | DENY             |
| 10       | Require Approval | REQUIRE_APPROVAL |

Since the Block rule is evaluated first, the final decision is **DENY**.

No ambiguity exists.

---

# Rule Lifecycle

Every rule follows the same lifecycle.

```text
Dashboard

↓

Database

↓

Rule Loader

↓

Validation

↓

Rule Cache

↓

Policy Engine

↓

Evaluation

↓

Decision
```

This architecture separates persistence from runtime execution.

---

# Extending the Engine

The current architecture makes new rule types straightforward to implement.

A new rule typically requires:

* A new Zod schema
* A TypeScript type
* A matcher
* An evaluator
* Registration in the Policy Engine

No existing rule implementations need to change.

This allows the engine to grow without becoming increasingly complex.

---

# Future Rule Types

The architecture can naturally support additional policies such as:

* Time-based restrictions
* User or role-based permissions
* Organization-specific policies
* IP or geographic restrictions
* Maximum execution time
* Tool rate limits
* Conversation allowlists
* Multi-stage approval workflows

Because the engine is modular, these additions fit into the existing evaluation pipeline without architectural changes.

---

The final section covers runtime caching, Redis synchronization, rule loading, and future improvements to the Policy Engine.


---
# 03-policy-engine.md (Part 4)

# Rule Loading & Runtime Synchronization

The Policy Engine never communicates directly with the database.

Instead, it evaluates an in-memory collection of validated rules.

This separation keeps policy evaluation fast, deterministic, and independent of persistence.

---

# Rule Loading Pipeline

Whenever the application starts, the Rule Loader performs the following sequence.

```text id="esij5n"
PostgreSQL

↓

Fetch Enabled Rules

↓

Sort By Priority

↓

Validate With Zod

↓

Convert To Runtime Rules

↓

Populate Rule Cache

↓

Ready
```

After this point, the Policy Engine only reads from memory.

---

# Rule Cache

The Rule Cache stores the active policy set.

Responsibilities:

* Hold validated runtime rules
* Provide fast access during evaluation
* Eliminate database reads from the request path

The cache is read-only during normal execution.

Only the Rule Loader updates it.

---

# Redis Synchronization

Policy changes should become effective immediately without restarting the agent.

To achieve this, the backend uses Redis Pub/Sub.

Flow:

```text id="2jol2h"
Dashboard

↓

Create / Update Rule

↓

Database

↓

Redis Publish

↓

Agent Subscriber

↓

Rule Loader

↓

Rule Cache Updated
```

The next request automatically uses the updated policy set.

---

# Why Pub/Sub?

Without synchronization:

```text id="8jodza"
Rule Updated

↓

Restart Backend

↓

New Rule Active
```

With Redis:

```text id="w1ahki"
Rule Updated

↓

Publish Event

↓

Reload Rules

↓

Done
```

This enables real-time policy management.

---

# Runtime Performance

Policy evaluation is intentionally lightweight.

For each tool request:

* No database queries
* No Redis communication
* No network requests

Only:

```text id="ez4s3x"
Policy Request

↓

Rule Cache

↓

Evaluation

↓

Decision
```

This makes the authorization layer extremely fast.

---

# Reliability

The engine is designed to fail safely.

Examples:

Invalid rule configuration

↓

Rejected during loading

↓

Never enters Rule Cache

---

Redis unavailable

↓

Existing cache continues operating

↓

No interruption to policy evaluation

---

Database temporarily unavailable

↓

Existing rules remain active

↓

Reload resumes once connectivity returns

This design favors stability over aggressive synchronization.

---

# Current Capabilities

The Policy Engine currently supports:

* Block tool execution
* Human approval workflows
* Input validation
* Risk-based policies
* Token budget enforcement
* Rule priority
* Evaluation traces
* Runtime rule reloads
* Prompt injection awareness (handled before evaluation)
* Risk overrides (resolved before evaluation)

Together, these features satisfy the project requirements while remaining modular and extensible.

---

# Future Improvements

Potential enhancements include:

### Policy Versioning

Track every policy change and allow rollback to previous versions.

---

### Policy Simulator

Test a request against policies without executing the tool.

Useful for administrators before deploying new guardrails.

---

### Rule Groups

Organize policies into logical collections.

Examples:

* Production
* Development
* Finance
* Infrastructure

---

### Conditional Rules

Support richer expressions.

Examples:

* Only after business hours
* Only for production servers
* Only for specific users
* Multiple conditions combined

---

### Approval Chains

Instead of a single approver:

```text id="6d5ym2"
Developer

↓

Team Lead

↓

Security

↓

Execute
```

---

### Metrics

Expose runtime statistics such as:

* Rules evaluated
* Average evaluation latency
* Most frequently matched rules
* Blocked requests
* Approval rate

These metrics would provide valuable operational insight.

---

# Summary

The Policy Engine is the authorization core of Cossie.

It operates entirely on validated in-memory rules, produces deterministic authorization decisions, and remains independent of infrastructure concerns.

By separating rule loading, caching, synchronization, and evaluation into distinct responsibilities, the engine remains:

* Fast
* Predictable
* Modular
* Easily testable
* Straightforward to extend

Its architecture allows new guardrails to be introduced with minimal changes while keeping existing behavior stable.

---

# Document Summary

This document covered:

* Policy Engine responsibilities
* Evaluation pipeline
* Rule matching
* Supported rule types
* Priority resolution
* Rule loading
* Runtime caching
* Redis synchronization
* Current capabilities
* Future enhancements

With this, the complete design and operation of the Policy Engine is documented.

The next document, **04-frontend-architecture.md**, will describe the dashboard architecture, page structure, component hierarchy, state management, API integration, UX philosophy, and how the frontend interacts with the backend in real time.


---

