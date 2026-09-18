---
title: Security Model
description: >-
  Trust boundaries, prompt injection detection, risk classification, approvals, audit logging, and the guarantees and limitations of Cossie's security architecture.
---

# Security Model

Cossie is built on one principle:

> Every AI-initiated tool execution is an untrusted request until it has been evaluated by an independent policy layer.

The language model never invokes tools directly. Every requested tool execution is intercepted and evaluated by the Policy Engine before it reaches an MCP server. The model decides *what* to do; the Policy Engine decides *whether it is allowed*.

## Core principles

### Policy-first execution

No MCP tool executes directly from the language model. Every request passes through the Policy Engine — the single authorization boundary between AI reasoning and external side effects — regardless of LLM provider, prompt contents, connected MCP server, or tool implementation.

### Runtime policy enforcement

Policies are external configuration, not application code. Administrators define guardrails through the dashboard; they are distributed to the running agent and evaluated at runtime without restarts. This keeps security rules independent of deployments and lets administrators respond immediately to incidents.

### Least privilege by default

The language model has no direct access to infrastructure. Its only job is to select which tool it believes should be invoked. Even if the model requests a dangerous action, execution happens only if an active policy explicitly permits it.

## Separation of responsibilities

| Component | Responsibility | Explicitly does **not** |
| --- | --- | --- |
| Language Model | Reasons and produces structured tool requests | Authorize execution |
| Policy Engine | Evaluates admin-defined policies | Execute tools |
| MCP Registry | Discovers and executes tools after authorization | Evaluate policy |
| Dashboard | Creates, modifies, inspects, and audits policies | Participate in runtime authorization |

## Security boundary

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

No execution bypasses this boundary. Every request passes through the Policy Engine exactly once before reaching an MCP server.

## Trust boundaries

Every external component is an independent trust domain, and transitions between domains are mediated through well-defined interfaces.

- **User → Language Model** — users communicate only via natural language prompts and never invoke MCP tools directly.
- **Language Model → Policy Engine** — the model is an untrusted decision-maker. It selects a tool but has no authority to execute it; a compromised model cannot independently perform privileged operations.
- **Policy Engine → MCP Registry** — only explicitly authorized requests reach the registry, which assumes incoming requests are already validated.
- **MCP Registry → MCP Servers** — local and remote servers share one execution interface, keeping Cossie independent of specific MCP implementations.
- **Dashboard → Policy Engine** — the dashboard is purely an administrative control plane. Authorization continues even if the dashboard is unavailable.

## Runtime synchronization

Policy changes propagate to the running agent without restarts:

```text
Dashboard → Database → Redis Pub/Sub → Rule Loader → Rule Cache → Policy Engine
```

Policy management (persistent configuration) is separated from enforcement (runtime state).

## Prompt injection detection

LLMs are vulnerable to prompt injection — e.g. *"Ignore previous instructions,"* *"Act as the system administrator,"* *"Reveal your hidden prompt."*

Cossie scans prompts before they enter the tool execution loop. When suspicious patterns are detected, the prompt is classified, the matching patterns are recorded, and an audit log entry is created.

**The request is intentionally not blocked** — execution continues. This reduces false positives: legitimate users often discuss injection for education, research, or debugging. Prompt injection is treated as an observable security signal rather than an automatic failure.

## Policy evaluation

### Deterministic evaluation

The Policy Engine never attempts to infer intent or make subjective decisions. It evaluates structured tool requests against administrator-defined policies, making every decision predictable, explainable, and reproducible.

### From prompt to policy request

A prompt such as *"Restart server srv-1."* causes the language model to produce a structured function call:

```json
{
  "toolName": "restart_server",
  "arguments": { "serverId": "srv-1" }
}
```

This becomes the **Policy Request** — the only input the Policy Engine consumes. The engine never evaluates free-form natural language.

### Rule-based authorization

Each policy is a rule describing how certain execution requests should be handled:

- Block a specific tool.
- Require approval before executing a tool.
- Restrict allowed filesystem paths.
- Enforce conversation token budgets.
- Apply policies based on tool risk.

Rules are evaluated in priority order. Each rule answers one question: *does this policy apply to the current request?* If not, evaluation continues; if so, the rule returns its decision.

### Evaluation pipeline

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

Matching logic per rule type:

| Rule type | Matches when… |
| --- | --- |
| `BLOCK_TOOL` | The requested tool appears in the configured tool list |
| `REQUIRE_APPROVAL` | The requested tool requires administrator authorization |
| `INPUT_VALIDATION` | The supplied arguments violate configured constraints |
| `BUDGET_LIMIT` | Current token usage exceeds the configured limit |
| `RISK_BASED` | The tool's risk level equals the configured level |

### Rule priority

Multiple policies may apply to the same request. Rules are evaluated in ascending priority order (lower value = higher precedence), which keeps behavior deterministic even with overlapping rules.

## Risk classification

Risk is metadata, not authorization. Every discovered tool receives a classification describing its operational impact — `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL` — inferred from its name and description (destructive keywords → `CRITICAL`, restart/deploy → `HIGH`, read/list/search → `LOW`).

Risk never blocks execution by itself. It provides context that policies may use during evaluation — for example, a `RISK_BASED` policy targeting `CRITICAL` tools. The policy produces the decision; the risk level does not.

## Policy decisions

Every evaluation yields exactly one decision: `ALLOW`, `DENY`, or `REQUIRE_APPROVAL`. The Policy Engine neither executes tools nor modifies state; the Tool Loop enforces the returned decision.

### `ALLOW`

No active policy prevents execution. The request is forwarded to the MCP Registry, and the outcome is recorded in the audit log.

### `DENY`

Execution is explicitly prohibited. The Tool Loop terminates the execution path; the MCP Registry is never reached. Typical causes: blocked tools, failed input validation, or exceeded budgets.

### `REQUIRE_APPROVAL`

The operation is not forbidden but needs human oversight. Execution pauses, an `Approval` record is created, and an administrator is notified. On approval, the stored tool and arguments execute immediately.

## Approvals

The Policy Engine determines that approval is required, the Tool Loop creates the approval request, and the Dashboard presents it to an administrator. Policy evaluation stays deterministic while operational decisions stay under human control.

| State | Meaning |
| --- | --- |
| `PENDING` | Awaiting action (the only actionable state) |
| `APPROVED` | Administrator authorized execution; executes immediately |
| `REJECTED` | Execution denied; never executes |
| `EXPIRED` | Not resolved within 30 minutes |

## Audit logging

Every security decision is observable. The platform records the requested tool, the policy decision and matched rule, execution status, approval identifiers, reasoning, and timestamps.

Rather than recording only failures, Cossie records the complete decision-making process — an end-to-end trail explaining why every execution was allowed, denied, or paused.

## Extensibility

Adding a new policy type requires four steps:

1. Define a new rule schema.
2. Implement a matching function.
3. Implement an evaluator.
4. Register the evaluator in the engine.

Existing rules remain unchanged; authorization can grow without increasing coupling between policy types.

## Security guarantees

- **Every tool request is evaluated.** No MCP tool executes without passing through the Policy Engine.
- **Policies are runtime configurable.** Guardrails change without rebuilds or redeploys.
- **Every decision is explainable.** Decisions are deterministic and traceable via audit logs.
- **Discovery does not imply authorization.** Discovering a tool makes it available; it grants no permission to execute.

## Current limitations

Cossie intentionally focuses on authorization at the tool execution boundary. The following are outside the current implementation:

- Authentication and user identity (all endpoints are open in a trusted environment)
- Role-based access control
- Multi-tenant policy isolation
- Cryptographic policy signing
- Distributed policy consensus
- Fine-grained rate limiting
- Policy versioning and rollback
- Distributed audit storage

These are extensions of the architecture, not changes to its core design.

## Future directions

Attribute-based access control (ABAC), policy simulation before deployment, rule conflict detection, execution sandboxing, cryptographically verifiable audit logs, real-time anomaly detection, multi-stage approval workflows, and approval delegation.

Because authorization is isolated within the Policy Engine, most of these can be introduced without changing the surrounding runtime.

## Summary

Cossie treats AI-generated tool requests as untrusted until they pass through an independent authorization layer. The model determines intent, the Policy Engine determines permission, the MCP Registry performs execution, and the Dashboard governs configuration.

## Where to next

- [Policy Engine](/docs/concepts/policy-engine) — rule types and evaluation semantics in detail.
- [Backend Architecture](/docs/concepts/backend-architecture) — the runtime that enforces this model.
- [API Reference](/docs/reference/api) — approvals, risk overrides, and audit logs over HTTP.
