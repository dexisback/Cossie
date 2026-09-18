---
title: Policy Engine
description: >-
  The isolated, stateless evaluation core: rule types, matchers, priority semantics, traces, and how decisions are produced.
---

# Policy Engine

The Policy Engine is the core security component of Cossie. It decides whether an AI agent is allowed to execute a requested action, sitting between the LLM and the MCP Registry so every tool invocation is evaluated against administrator-defined guardrails.

It is an intentionally standalone package — independent of Express, Prisma, Redis, Gemini, Groq, and MCP transports. It is stateless and deterministic: fast, predictable, easy to test, and extensible.

## Responsibilities

**Responsible for:**

- Evaluating policy rules
- Producing authorization decisions
- Generating evaluation traces
- Applying deterministic rule precedence (first match wins, ascending priority)

**Not responsible for:**

- Loading rules from the database
- Discovering or executing MCP tools
- Logging, persisting approvals, or HTTP handling

## Inputs and output

The engine evaluates three inputs:

1. **Policy Request** — the attempted action: `conversationId`, `toolName`, and `args`.
2. **Active Rules** — a validated, in-memory list of enabled rules supplied by the Rule Cache.
3. **Runtime Context** — contextual information such as tool risk level and token usage.

Every evaluation produces exactly one `PolicyDecision`:

| Decision | Meaning |
| --- | --- |
| `ALLOW` | The action may proceed |
| `DENY` | The action is blocked |
| `REQUIRE_APPROVAL` | Execution pauses until a human approves |

The engine never throws authorization exceptions. Each decision includes the decision type, a human-readable reason, the matched rule (or `null` when allowed by default), an optional approval ID, and an evaluation trace.

## Evaluation pipeline

```text
Tool Request → Policy Request → Rule Iteration → Rule Match → Decision → Trace → Return
```

Rules are evaluated sequentially in **ascending priority order**. Each rule is asked one question: *does this rule apply?* If not, evaluation continues; if it does, evaluation stops and that rule's decision becomes the outcome ("first match wins"). This guarantees deterministic conflict resolution — if priority `1` blocks `restart_server` and priority `10` requires approval for it, a restart request is always denied.

### Matchers and evaluators

Each rule type has a matcher (`matchesBlockToolRule()`, `matchesApprovalRule()`, etc.) that answers only whether the rule applies, never creating decisions. Each matcher is wrapped by an evaluator (e.g. `evaluateApprovalRule()`) that builds the decision, reason, and trace on a match — making every decision explainable.

### Evaluation trace

The engine records a trace of every rule processed, e.g. `BLOCK_TOOL → Matched → Decision: DENY`. Traces provide explainability and are returned with the final decision for dashboard display.

### Performance and failure handling

Evaluation touches no external systems — no database, Redis, network, or LLM calls. Everything operates on in-memory data structures.

The engine assumes all rules are valid: validation happens before rules enter the cache, so malformed rules are rejected at load time rather than during evaluation.

## Rule types

Five rule types are supported. Each follows the same evaluation model while enforcing different governance constraints.

### `BLOCK_TOOL`

Prevents specific tools from ever executing.

```json
{ "type": "BLOCK_TOOL", "toolNames": ["restart_server", "delete_server"] }
```

Matches when `toolNames` includes the requested tool. A match returns `DENY`.

### `REQUIRE_APPROVAL`

Pauses execution until a human approves.

```json
{ "type": "REQUIRE_APPROVAL", "toolNames": ["restart_server"] }
```

A match returns `REQUIRE_APPROVAL`: an approval record is created and execution pauses.

### `INPUT_VALIDATION`

Validates tool arguments before execution.

```json
{ "type": "INPUT_VALIDATION", "toolName": "write_file", "allowedPrefix": "/sandbox/" }
```

Valid arguments return `ALLOW`; invalid ones return `VALIDATION_FAILED`.

### `RISK_BASED`

Applies a policy to all tools at a given risk level.

```json
{ "type": "RISK_BASED", "riskLevel": "CRITICAL" }
```

Matches on **exact** risk-level equality (`rule.riskLevel === tool risk`). Use one rule per level you want to govern rather than relying on thresholds.

### `BUDGET_LIMIT`

Prevents excessive resource consumption.

```json
{ "type": "BUDGET_LIMIT", "maxTokens": 50000 }
```

Matches when `currentTokens >= maxTokens`, returning `BUDGET_EXCEEDED`.

### Additional decisions

The engine returns six decision types in total: the three headline outcomes above plus `VALIDATION_FAILED`, `BUDGET_EXCEEDED`, and `ERROR`. All non-`ALLOW` decisions surface to users as `"Tool blocked: <reason>"`.

## Rule lifecycle and loading

Rules persist in PostgreSQL but never reach the engine directly from the database:

```text
Dashboard → Database → Rule Loader → Validation → Rule Cache → Policy Engine → Evaluation → Decision
```

On startup, the Rule Loader fetches enabled rules, sorts them by priority, validates them with Zod, converts them to runtime rules, and populates the Rule Cache. From then on, the engine reads only from memory.

### Rule Cache

The Rule Cache holds the active policy set, providing fast access during evaluation and keeping database reads out of the request path. It is read-only during execution; only the Rule Loader updates it.

### Redis synchronization

Policy changes take effect without restarting the agent via Redis Pub/Sub:

```text
Dashboard → Create/Update Rule → Database → Redis Publish → Agent Subscriber → Rule Loader → Rule Cache Updated
```

### Reliability

- **Invalid rule configuration** → rejected during loading; never enters the cache.
- **Redis unavailable** → the existing cache keeps operating.
- **Database unavailable** → existing rules remain active; reload resumes once connectivity returns.

## Extending the engine

Adding a new rule type requires four steps:

1. Define a new rule schema (Zod schema + TypeScript type).
2. Implement a matcher.
3. Implement an evaluator.
4. Register the evaluator in the engine.

Existing rule implementations remain unchanged. Plausible future types — time-based restrictions, role-based permissions, geofencing, rate limits, and multi-stage approval workflows — fit into this pipeline without architectural changes.

Other potential enhancements:

- **Policy versioning** — track changes and roll back to previous versions.
- **Policy simulator** — test a request against policies without executing a tool.
- **Rule groups** — logical collections (Production, Development, Finance).
- **Approval chains** — sequential multi-approver flows.

## Summary

The Policy Engine evaluates a `PolicyRequest` against validated in-memory rules in ascending priority order using first-match-wins semantics, returning a deterministic `PolicyDecision` (with reason, matched rule, and trace) without touching infrastructure. Loading, caching, synchronization, and evaluation are separated into distinct responsibilities.

## Where to next

- [Backend Architecture](/docs/concepts/backend-architecture) — how the engine fits into the request lifecycle.
- [Security Model](/docs/security/security-model) — the security principles the engine enforces.
- [API Reference](/docs/reference/api) — manage rules at runtime via the Rules endpoints.
