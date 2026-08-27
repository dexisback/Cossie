# 04-security-model.md

# Security Model

## Overview

Cossie is designed around a simple principle:

> Every AI-initiated tool execution must be treated as an untrusted request until it has been evaluated by an independent policy layer.

Rather than allowing the language model to invoke external tools directly, every requested tool execution is intercepted and evaluated before reaching the underlying Model Context Protocol (MCP) server.

This separation ensures that reasoning and authorization remain independent concerns.

The language model decides *what* it wants to do.

The Policy Engine decides *whether it is allowed* to do it.

Only after a request has successfully passed policy evaluation is it permitted to reach an MCP server for execution.

This architecture allows security policies to evolve independently from application logic, model providers, and connected MCP servers.

---

# Core Security Principles

## Policy-First Execution

No MCP tool is executed directly from the language model.

Every tool request must first pass through the Policy Engine.

The Policy Engine acts as the single authorization boundary between AI reasoning and external side effects.

This guarantees that every tool invocation is evaluated consistently regardless of:

* LLM provider
* Prompt contents
* Connected MCP server
* Tool implementation

---

## Runtime Policy Enforcement

Security policies are external configuration rather than application code.

Administrators define guardrails through the dashboard.

Those policies are distributed to the running agent and evaluated at runtime without requiring service restarts.

This provides three important properties:

* security rules can evolve independently of deployments
* administrators can respond immediately to operational incidents
* authorization logic remains centralized and auditable

---

## Least Privilege by Default

The language model itself possesses no direct capability to interact with infrastructure.

Its only responsibility is selecting which tool it believes should be invoked.

Actual execution remains entirely under the control of the Policy Engine.

Even if a model requests a dangerous action, execution only occurs if an active policy explicitly permits it.

---

## Separation of Responsibilities

Cossie intentionally separates responsibilities into independent layers.

### Language Model

Responsible only for reasoning.

Produces structured tool requests.

Never authorizes execution.

---

### Policy Engine

Responsible only for authorization.

Evaluates administrator-defined policies.

Produces an execution decision.

Never executes tools.

---

### MCP Registry

Responsible only for discovery and execution.

Discovers available tools from connected MCP servers.

Executes tool calls only after receiving authorization.

Never evaluates policy.

---

### Dashboard

Responsible only for administration.

Allows operators to create, modify, inspect and audit security policies.

Never participates in runtime authorization decisions.

---

## Security Boundary

The primary security boundary exists immediately before tool execution.

```
User Prompt
        │
        ▼
Language Model
        │
        ▼
Tool Request
        │
        ▼
=============================
 Policy Enforcement Boundary
=============================
        │
        ▼
Policy Engine
        │
        ▼
ALLOW
DENY
REQUIRE_APPROVAL
        │
        ▼
MCP Registry
        │
        ▼
External Tool
```

No tool execution is permitted to bypass this boundary.

Every execution request must pass through the Policy Engine exactly once before reaching an MCP server.

This design keeps authorization centralized, deterministic and independently auditable.


---
# Policy Decisions

Every evaluation performed by the Policy Engine results in exactly one decision.

The Policy Engine does not execute tools or modify application state. Its only responsibility is to determine how an incoming tool request should be handled.

Current decisions are:

* ALLOW
* DENY
* REQUIRE_APPROVAL

The Tool Loop is responsible for enforcing whichever decision is returned.

---

## ALLOW

An ALLOW decision indicates that no active policy prevents execution of the requested tool.

Once returned, the Tool Loop forwards the request to the MCP Registry, where the appropriate MCP server executes the tool.

This represents the normal execution path.

```text
Tool Request
        │
        ▼
Policy Engine
        │
        ▼
ALLOW
        │
        ▼
MCP Registry
        │
        ▼
Tool Execution
```

The request, decision and execution outcome are recorded within the audit log.

---

## DENY

A DENY decision indicates that execution has been explicitly prohibited by one or more active policies.

The requested tool is never executed.

Instead, the Tool Loop immediately terminates the execution path and returns an appropriate response to the user.

Typical examples include:

* blocked tools
* failed input validation
* exceeded token budgets
* policy violations
* administrator-defined restrictions

```text
Tool Request
        │
        ▼
Policy Engine
        │
        ▼
DENY
        │
        ▼
Audit Log
        │
        ▼
Response Returned
```

The MCP Registry is never reached.

---

## REQUIRE_APPROVAL

Some operations are not inherently forbidden, but they may still require human oversight.

Instead of denying execution, the Policy Engine may return REQUIRE_APPROVAL.

When this occurs:

* execution is paused
* an Approval record is created
* an audit event is recorded
* the administrator is notified through the dashboard

```text
Tool Request
        │
        ▼
Policy Engine
        │
        ▼
REQUIRE_APPROVAL
        │
        ▼
Approval Queue
        │
        ▼
Administrator
```

This allows sensitive operations to remain available while introducing a human authorization step before execution.

---

# Human Approval Model

Cossie separates authorization from execution.

The Policy Engine determines that approval is required.

The Tool Loop creates the approval request.

The Dashboard presents the request to an administrator.

The administrator ultimately decides whether execution should proceed.

This keeps policy evaluation deterministic while allowing operational decisions to remain under human control.

The approval workflow currently consists of four states:

* Pending
* Approved
* Rejected
* Expired

Only pending requests are actionable.

Approved requests represent administrator authorization.

Rejected requests explicitly deny execution.

Expired requests represent requests that were never resolved within the configured time window.

---

# Prompt Injection Handling

Large Language Models are vulnerable to prompt injection attacks.

Examples include attempts such as:

* "Ignore previous instructions."
* "Act as the system administrator."
* "Reveal your hidden prompt."

Cossie performs prompt scanning before the request enters the normal tool execution loop.

If suspicious patterns are detected:

* the prompt is classified
* matching patterns are recorded
* an audit log is created

The request is intentionally not blocked.

Instead, execution continues normally.

This design choice reduces false positives.

Many legitimate users may discuss prompt injection techniques for educational, research or debugging purposes.

Blocking these requests would unnecessarily degrade usability.

Instead, Cossie treats prompt injection as an observable security signal rather than an automatic execution failure.

This allows administrators to monitor suspicious behavior while avoiding unnecessary interruptions to legitimate workflows.

---

# Auditability

Every security decision is designed to be observable.

Whenever possible, the platform records:

* requested tool
* policy decision
* matched rule
* execution status
* approval identifiers
* reasoning
* timestamps
* prompt security events

Rather than only recording failures, Cossie records the complete decision-making process.

This provides administrators with an end-to-end audit trail describing why every execution was allowed, denied or paused for approval.

The audit log therefore becomes both a debugging tool and a security artifact, enabling post-incident analysis without requiring access to application internals.


---

# Policy Evaluation Model

Cossie intentionally keeps policy evaluation deterministic.

The Policy Engine does not attempt to understand user intent, infer risk from natural language, or make subjective security decisions.

Instead, it evaluates structured tool requests against administrator-defined policies.

This approach makes every authorization decision predictable, explainable and reproducible.

---

# From Prompt to Policy Request

A user interacts with the system using natural language.

For example:

```text
Restart server srv-1.
```

The language model determines that the request requires a tool invocation and produces a structured function call.

Example:

```json
{
  "toolName": "restart_server",
  "arguments": {
    "serverId": "srv-1"
  }
}
```

This structured request is transformed into a Policy Request.

The Policy Request becomes the only input consumed by the Policy Engine.

Importantly, the Policy Engine never evaluates free-form natural language.

It evaluates structured execution requests produced by the language model.

---

# Rule-Based Authorization

Administrators define security policies through the dashboard.

Each policy represents a rule describing how certain execution requests should be handled.

Examples include:

* Block a specific tool.
* Require approval before executing a tool.
* Restrict allowed filesystem paths.
* Enforce conversation token budgets.
* Apply policies based on tool risk.

These policies are stored centrally and loaded into the running Policy Engine.

When a tool request arrives, the engine evaluates every active rule in priority order.

Each rule answers a single question:

> Does this policy apply to the current execution request?

If the answer is no, evaluation continues.

If the answer is yes, the rule returns its corresponding policy decision.

Because every rule is evaluated independently, new policy types can be introduced without modifying existing authorization logic.

---

# Evaluation Pipeline

The evaluation process follows a predictable sequence.

```text
Incoming Tool Request
        │
        ▼
Load Active Rules
        │
        ▼
Evaluate Rule 1
        │
        ▼
Evaluate Rule 2
        │
        ▼
Evaluate Rule N
        │
        ▼
Return Final Decision
```

Each rule operates only on the information relevant to that rule type.

Examples include:

* requested tool name
* supplied arguments
* conversation token usage
* assigned risk level

Rules do not communicate with one another.

This keeps evaluation isolated and simplifies reasoning about policy behavior.

---

# Rule Matching

Every rule type implements its own matching logic.

For example:

A Block Tool rule checks whether the requested tool appears in its configured tool list.

An Approval rule determines whether the requested tool requires administrator authorization.

An Input Validation rule verifies that supplied arguments satisfy configured constraints.

A Budget rule compares current token usage against configured limits.

A Risk-Based rule compares the tool's assigned risk level against administrator-defined thresholds.

Each rule evaluates only the information necessary for its own decision.

This modular approach allows new policy types to be introduced without affecting existing rule implementations.

---

# Rule Priority

Multiple policies may theoretically apply to the same request.

Cossie evaluates rules according to administrator-defined priority.

Rules with higher precedence are evaluated first.

This produces deterministic behavior even when multiple rules target the same execution request.

Administrators therefore control not only which policies exist, but also the order in which they are considered.

---

# Risk Classification

Risk is treated as metadata rather than authorization.

Every discovered tool receives a risk classification describing its potential operational impact.

Examples include:

* LOW
* MEDIUM
* HIGH
* CRITICAL

Risk itself never blocks execution.

Instead, it provides additional context that policies may use during evaluation.

For example, an administrator may configure a policy stating:

> Require approval for every tool whose risk level is HIGH or greater.

In this case, the policy—not the risk level—is responsible for producing the authorization decision.

Risk therefore acts as an input to policy evaluation rather than a security decision by itself.

---

# Extensibility

The Policy Engine is intentionally designed around independent rule evaluators.

Adding a new policy type generally requires:

* defining a new rule schema
* implementing a matching function
* implementing an evaluator
* registering the evaluator within the engine

Existing rule implementations remain unchanged.

This architecture allows the authorization model to grow without increasing coupling between policy types, keeping the engine maintainable as additional security capabilities are introduced.

---

# Trust Boundaries

Cossie assumes that every external component should be treated as an independent trust domain.

Rather than allowing unrestricted communication between these domains, every transition is mediated through a well-defined interface.

This minimizes implicit trust and ensures that authorization remains centralized.

The primary trust domains are:

* User
* Language Model
* Policy Engine
* MCP Registry
* MCP Servers
* Dashboard
* Administrator

Each component has a clearly defined responsibility and is intentionally prevented from performing work outside its designated role.

---

# Trust Relationships

## User → Language Model

Users communicate only through natural language prompts.

Users never invoke MCP tools directly.

The language model determines whether tool usage is necessary.

This prevents clients from bypassing the AI reasoning layer and directly requesting privileged operations.

---

## Language Model → Policy Engine

The language model is treated as an untrusted decision-maker.

Although it determines which tool should be invoked, it possesses no authority to execute that tool.

Every structured tool request must first be evaluated by the Policy Engine.

This separation ensures that a compromised model cannot independently perform privileged operations.

---

## Policy Engine → MCP Registry

The Policy Engine represents the system's authorization authority.

Only requests explicitly authorized by the Policy Engine may reach the MCP Registry.

The registry therefore assumes that every incoming request has already been validated.

It never performs authorization itself.

---

## MCP Registry → MCP Servers

The registry abstracts communication with connected MCP servers.

Whether tools originate from local custom servers or remote providers, they are exposed through the same execution interface.

This abstraction allows Cossie to remain independent of specific MCP implementations while maintaining a consistent authorization model.

---

## Dashboard → Policy Engine

The dashboard never participates in runtime authorization.

Instead, it acts purely as an administrative control plane.

Administrators modify policies through the dashboard.

Those policies are synchronized into the running Policy Engine.

Once loaded, the Policy Engine evaluates requests independently of the dashboard.

This means authorization continues even if the dashboard is unavailable.

---

# Runtime Synchronization

Policy changes are propagated to the running agent without requiring restarts.

The synchronization pipeline consists of:

Dashboard

↓

Database

↓

Redis Pub/Sub

↓

Rule Loader

↓

Rule Cache

↓

Policy Engine

This design separates policy management from policy enforcement.

Administrators modify persistent configuration.

The running agent consumes synchronized runtime state.

As a result, authorization logic remains available even during periods of dashboard inactivity.

---

# Security Guarantees

The current architecture provides several important guarantees.

## Every Tool Request Is Evaluated

No MCP tool executes without first passing through the Policy Engine.

This creates a single, centralized authorization point for the entire platform.

---

## Policies Are Runtime Configurable

Authorization behavior is driven by configuration rather than source code.

Administrators can introduce, modify or remove guardrails without rebuilding or redeploying the application.

---

## Every Decision Is Explainable

Each authorization decision is deterministic and traceable.

Audit logs preserve:

* the requested tool
* the matched policy
* the resulting decision
* execution status
* timestamps
* additional execution context

This makes every decision reproducible during debugging or security investigations.

---

## Discovery Does Not Imply Authorization

Discovering a tool from an MCP server does not automatically grant permission to execute it.

Discovery simply makes the tool available to the platform.

Authorization remains entirely under administrator control through runtime policies.

This distinction is fundamental to Cossie's security model.

---

# Current Limitations

Cossie intentionally focuses on authorization at the tool execution boundary.

Several production-oriented capabilities remain outside the current implementation.

These include:

* authentication and user identity
* role-based access control
* multi-tenant policy isolation
* cryptographic policy signing
* distributed policy consensus
* execution continuation after human approval
* fine-grained rate limiting
* policy versioning and rollback
* distributed audit storage

These features represent natural extensions of the architecture rather than changes to its core design.

---

# Future Security Directions

The current architecture intentionally leaves room for more advanced security capabilities.

Potential future improvements include:

* attribute-based access control (ABAC)
* policy simulation before deployment
* rule conflict detection
* execution sandboxing
* automatic risk scoring
* cryptographically verifiable audit logs
* real-time anomaly detection
* streaming policy evaluation
* multi-stage approval workflows
* approval delegation
* temporary policy overrides
* signed policy bundles
* execution replay for incident analysis

Because authorization is isolated within the Policy Engine, these capabilities can largely be introduced without changing the surrounding agent runtime.

---

# Summary

Cossie treats AI-generated tool requests as untrusted operations until they have successfully passed through an independent authorization layer.

The language model determines intent.

The Policy Engine determines permission.

The MCP Registry performs execution.

The Dashboard governs policy configuration.

This separation of concerns creates a security architecture that is deterministic, auditable and extensible, allowing AI capabilities to evolve without compromising the integrity of external systems.


---



