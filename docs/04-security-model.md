# Security Model

Cossie is built on one principle:

> Every AI-initiated tool execution is an untrusted request until it has been evaluated by an independent policy layer.

The language model never invokes tools directly. Every requested tool execution is intercepted and evaluated by the Policy Engine before reaching a Model Context Protocol (MCP) server. Reasoning and authorization stay independent: the model decides *what* to do, the Policy Engine decides *whether it is allowed*. This lets security policies evolve independently of application logic, model providers, and connected MCP servers.

## Core Principles

### Policy-First Execution

No MCP tool executes directly from the language model. Every request passes through the Policy Engine, the single authorization boundary between AI reasoning and external side effects. Every invocation is evaluated consistently regardless of LLM provider, prompt contents, connected MCP server, or tool implementation.

### Runtime Policy Enforcement

Policies are external configuration, not application code. Administrators define guardrails through the dashboard; they are distributed to the running agent and evaluated at runtime without service restarts. This means:

- Security rules can evolve independently of deployments.
- Administrators can respond immediately to operational incidents.
- Authorization logic remains centralized and auditable.

### Least Privilege by Default

The language model has no direct capability to interact with infrastructure — its only job is selecting which tool it believes should be invoked. Even if the model requests a dangerous action, execution occurs only if an active policy explicitly permits it.

## Separation of Responsibilities

| Component | Responsibility | Explicitly does NOT |
|---|---|---|
| Language Model | Reasoning; produces structured tool requests | Never authorizes execution |
| Policy Engine | Authorization; evaluates admin-defined policies | Never executes tools |
| MCP Registry | Tool discovery and execution after authorization | Never evaluates policy |
| Dashboard | Administration: create, modify, inspect, audit policies | Never participates in runtime authorization |

## Security Boundary

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
Policy Engine ──► ALLOW / DENY / REQUIRE_APPROVAL
    │
    ▼
MCP Registry
    │
    ▼
External Tool
```

No execution bypasses this boundary; every request passes through the Policy Engine exactly once before reaching an MCP server.

## Trust Boundaries

Every external component is an independent trust domain, and transitions between domains are mediated through well-defined interfaces: User, Language Model, Policy Engine, MCP Registry, MCP Servers, Dashboard, Administrator.

- **User → Language Model**: Users communicate only via natural language prompts and never invoke MCP tools directly. The model determines whether tool usage is necessary, preventing clients from bypassing the reasoning layer to request privileged operations.
- **Language Model → Policy Engine**: The model is treated as an untrusted decision-maker. It selects which tool to invoke but has no authority to execute it; every structured tool request must be evaluated first. A compromised model cannot independently perform privileged operations.
- **Policy Engine → MCP Registry**: Only requests explicitly authorized by the Policy Engine reach the registry. The registry assumes incoming requests are already validated and never performs authorization itself.
- **MCP Registry → MCP Servers**: Local custom servers and remote providers are exposed through the same execution interface, keeping Cossie independent of specific MCP implementations while maintaining one authorization model.
- **Dashboard → Policy Engine**: The dashboard is purely an administrative control plane. Policy changes are synchronized into the running engine, which then operates independently — authorization continues even if the dashboard is unavailable.

## Runtime Synchronization

Policy changes propagate to the running agent without restarts:

Dashboard → Database → Redis Pub/Sub → Rule Loader → Rule Cache → Policy Engine

Policy management (persistent configuration) is separated from enforcement (runtime state). Authorization remains available during periods of dashboard inactivity.

## Prompt Injection Detection

LLMs are vulnerable to prompt injection — e.g., "Ignore previous instructions," "Act as the system administrator," "Reveal your hidden prompt."

Cossie scans prompts before they enter the normal tool execution loop. If suspicious patterns are detected:

- The prompt is classified.
- Matching patterns are recorded.
- An audit log entry is created.

**The request is intentionally not blocked** — execution continues normally.

This is a deliberate design choice to reduce false positives: legitimate users often discuss prompt injection for educational, research, or debugging purposes, and blocking those requests would degrade usability. Cossie treats prompt injection as an observable security signal rather than an automatic execution failure, letting administrators monitor suspicious behavior without interrupting legitimate workflows.

## Policy Evaluation

## Deterministic Evaluation

The Policy Engine never attempts to understand user intent, infer risk from natural language, or make subjective decisions. It evaluates structured tool requests against administrator-defined policies, making every decision predictable, explainable, and reproducible.

## From Prompt to Policy Request

A user prompt such as `Restart server srv-1.` causes the language model to produce a structured function call:

```json
{
  "toolName": "restart_server",
  "arguments": {
    "serverId": "srv-1"
  }
}
```

This becomes a Policy Request — the only input the Policy Engine consumes. The engine never evaluates free-form natural language, only structured execution requests produced by the model.

## Rule-Based Authorization

Administrators define policies through the dashboard. Each policy is a rule describing how certain execution requests should be handled, e.g.:

- Block a specific tool.
- Require approval before executing a tool.
- Restrict allowed filesystem paths.
- Enforce conversation token budgets.
- Apply policies based on tool risk.

Policies are stored centrally and loaded into the running engine. On each request, the engine evaluates every active rule in priority order. Each rule answers one question: *does this policy apply to the current execution request?* If not, evaluation continues; if yes, the rule returns its policy decision. Because rules are evaluated independently, new policy types can be added without modifying existing authorization logic.

## Evaluation Pipeline

```text
Incoming Tool Request
    │
    ▼
Load Active Rules
    │
    ▼
Evaluate Rule 1 … Rule N
    │
    ▼
Return Final Decision
```

Each rule operates only on the information relevant to its type — typically the requested tool name, supplied arguments, conversation token usage, or assigned risk level. Rules do not communicate with one another, keeping evaluation isolated.

Matching logic per rule type:

| Rule type | Matches when… |
|---|---|
| Block Tool | Requested tool appears in the configured tool list |
| Approval | Requested tool requires administrator authorization |
| Input Validation | Supplied arguments violate configured constraints |
| Budget | Current token usage exceeds configured limits |
| Risk-Based | Tool's risk level equals the configured risk level |

## Rule Priority

Multiple policies may apply to the same request. Rules are evaluated according to administrator-defined priority, higher precedence first. Behavior stays deterministic even with overlapping rules, and administrators control both which policies exist and the order they are considered.

## Risk Classification

Risk is metadata, not authorization. Every discovered tool receives a classification describing its operational impact: `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL` — inferred from the tool's name and description (e.g. destructive keywords → CRITICAL, restart/deploy → HIGH, read/list/search → LOW).

Risk itself never blocks execution. It provides context that policies may use during evaluation — e.g., a `RISK_BASED` policy targeting CRITICAL tools. In that case, the policy, not the risk level, produces the authorization decision. Risk is an input to policy evaluation, not a security decision by itself.

## Policy Decisions

Every evaluation yields exactly one decision: `ALLOW`, `DENY`, or `REQUIRE_APPROVAL`. The Policy Engine neither executes tools nor modifies application state; the Tool Loop enforces whichever decision is returned.

### ALLOW

No active policy prevents execution. The Tool Loop forwards the request to the MCP Registry, where the appropriate MCP server executes the tool. This is the normal path. The request, decision, and execution outcome are recorded in the audit log.

### DENY

Execution is explicitly prohibited by one or more active policies. The Tool Loop immediately terminates the execution path and returns a response to the user; the MCP Registry is never reached. Typical causes: blocked tools, failed input validation, exceeded token budgets, policy violations, or other administrator-defined restrictions.

### REQUIRE_APPROVAL

The operation is not inherently forbidden but requires human oversight. Execution pauses, an Approval record is created, an audit event is recorded, and the administrator is notified through the dashboard. When an administrator approves via the API, the stored tool and arguments execute immediately at approval time. Sensitive operations remain available while introducing a human authorization step before execution.

## Approvals

Authorization is separated from execution across components: the Policy Engine determines that approval is required, the Tool Loop creates the approval request, the Dashboard presents it to an administrator, who decides whether execution proceeds. Policy evaluation remains deterministic while operational decisions remain under human control.

Approval workflow states:

| State | Meaning |
|---|---|
| `PENDING` | Awaiting action (the only actionable state) |
| `APPROVED` | Administrator authorized execution — execution happens immediately at approval time |
| `REJECTED` | Execution explicitly denied; never executes |
| `EXPIRED` | Not resolved within 30 minutes |

## Audit Logging

Every security decision is designed to be observable. Wherever possible, the platform records:

- Requested tool
- Policy decision and matched rule
- Execution status
- Approval identifiers
- Reasoning
- Timestamps
- Prompt security events

Rather than recording only failures, Cossie records the complete decision-making process, providing an end-to-end audit trail explaining why every execution was allowed, denied, or paused. The audit log serves both as a debugging tool and a security artifact, enabling post-incident analysis without access to application internals.

## Extensibility

The Policy Engine is built around independent rule evaluators. Adding a new policy type requires:

1. Defining a new rule schema
2. Implementing a matching function
3. Implementing an evaluator
4. Registering the evaluator within the engine

Existing rules remain unchanged. Authorization can grow without increasing coupling between policy types.

## Security Guarantees

The current architecture provides these guarantees:

- **Every tool request is evaluated.** No MCP tool executes without passing through the Policy Engine — a single, centralized authorization point for the platform.
- **Policies are runtime configurable.** Authorization behavior is driven by configuration, not source code; administrators add, modify, or remove guardrails without rebuilding or redeploying.
- **Every decision is explainable.** Decisions are deterministic and traceable; audit logs preserve the requested tool, matched policy, resulting decision, execution status, timestamps, and additional context, making any decision reproducible during debugging or investigation.
- **Discovery does not imply authorization.** Discovering a tool from an MCP server makes it available to the platform but grants no permission to execute it; authorization remains entirely under administrator control. This distinction is fundamental to the model.

## Current Limitations

Cossie intentionally focuses on authorization at the tool execution boundary. The following production-oriented capabilities are outside the current implementation:

- Authentication and user identity — no auth middleware exists yet; all endpoints are open in a trusted environment
- Role-based access control
- Multi-tenant policy isolation
- Cryptographic policy signing
- Distributed policy consensus
- Fine-grained rate limiting
- Policy versioning and rollback
- Distributed audit storage

These are natural extensions of the architecture rather than changes to its core design.

## Future Directions

Potential future capabilities include: attribute-based access control (ABAC), policy simulation before deployment, rule conflict detection, execution sandboxing, automatic risk scoring, cryptographically verifiable audit logs, real-time anomaly detection, streaming policy evaluation, multi-stage approval workflows, approval delegation, temporary policy overrides, signed policy bundles, and execution replay for incident analysis.

Because authorization is isolated within the Policy Engine, these can largely be introduced without changing the surrounding agent runtime.

## Summary

Cossie treats AI-generated tool requests as untrusted until they pass through an independent authorization layer. The language model determines intent, the Policy Engine determines permission, the MCP Registry performs execution, and the Dashboard governs policy configuration. This separation creates a security architecture that is deterministic, auditable, and extensible, allowing AI capabilities to evolve without compromising external systems.
