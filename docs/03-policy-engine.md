# Policy Engine

The Policy Engine is the core security component of Cossie. Its responsibility is simple: decide whether an AI agent is allowed to execute a requested action. It sits between the LLM and the MCP Registry, so every tool invocation is evaluated against administrator-defined guardrails before execution.

It is an intentionally standalone package, independent of Express, Prisma, Redis, Gemini, Groq, and MCP transports. It is stateless, deterministic, pure business logic: fast, predictable, easily testable, and extensible.

## Responsibilities

Responsible for:

- Evaluating policy rules
- Producing authorization decisions
- Generating evaluation traces
- Applying deterministic rule precedence (first match wins, ascending priority)

Not responsible for:

- Loading rules from the database
- Discovering or executing MCP tools
- Logging
- Persisting approvals
- HTTP handling

## Inputs

The engine evaluates three inputs:

1. **Policy Request** — the attempted action: `conversationId`, `toolName`, and `args` (e.g. `restart_server` with `{ serverId: "srv-1" }`).
2. **Active Rules** — a validated, in-memory list of enabled rules supplied by the Rule Cache. The engine assumes they are already loaded, validated, and sorted by priority.
3. **Runtime Context** — contextual information influencing evaluation. Currently includes tool risk level and token usage (for budget rules). Future versions could include user identity, organization, environment, time of day, or geographic region.

## Output

Every evaluation produces exactly one `PolicyDecision`:

| Decision           | Meaning                                      |
| ------------------ | -------------------------------------------- |
| `ALLOW`            | The action may proceed                       |
| `DENY`             | The action is blocked                        |
| `REQUIRE_APPROVAL` | Execution pauses until a human approves      |

The engine never throws authorization exceptions; callers always receive a structured decision describing the outcome. Each decision includes the decision type, a human-readable reason, the matched rule (or `null` when allowed by default with no violations, e.g. reason `"No policy violations detected"`), an optional approval ID, and an evaluation trace.

## Evaluation Pipeline

```
Tool Request → Policy Request → Rule Iteration → Rule Match → Decision → Trace → Return
```

Rules are evaluated sequentially in **ascending priority order**. Each rule follows the same lifecycle: does it match? If not, evaluation continues to the next rule; if it matches, evaluation stops immediately and that rule's decision becomes the outcome ("first match wins"). This guarantees deterministic conflict resolution — for example, if priority 1 blocks `restart_server` and priority 10 requires approval for it, a restart request is always denied because the higher-priority rule matches first.

### Matchers and Evaluators

Each rule type has its own matcher (`matchesBlockToolRule()`, `matchesApprovalRule()`, `matchesRiskRule()`, `matchesBudgetRule()`, `matchesInputValidationRule()`). Matchers answer only one question — "does this rule apply to the current request?" — and never create decisions.

Each matcher is wrapped by an evaluator (e.g. `evaluateApprovalRule()` calls `matchesApprovalRule()`); on a match, the evaluator constructs the decision, reason, trace, and matched rule. This makes every authorization decision explainable.

### Evaluation Trace

The engine records a trace of every rule processed during evaluation, e.g. `BLOCK_TOOL → Matched → Decision: DENY`. Traces provide explainability for administrators and are returned with the final decision so dashboards can display them later.

### Performance and Failure Handling

Evaluation contacts no external systems — no database queries, Redis calls, network requests, or LLM invocations. Everything operates on in-memory data structures, keeping policy evaluation extremely fast.

The engine assumes all rules are valid: validation happens before rules enter the cache, so malformed rules are rejected at load time rather than during evaluation. This keeps the evaluation loop simple and predictable.

## Supported Rule Types

Five rule categories are supported. All follow the same evaluation model while enforcing different governance constraints; each rule is evaluated independently and knows nothing about other rule types.

| Type              | Purpose                                        | Example configuration                                                                                                              | Matching / decision behavior                                                        | Typical use cases                                                          |
| ----------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `BLOCK_TOOL`      | Prevent specific tools from ever executing     | `{ "type": "BLOCK_TOOL", "toolNames": ["restart_server", "delete_server"] }`                                                        | `toolNames.includes(tool)`; match → `DENY`                                           | Dangerous admin actions, disabled production tools, temporary restrictions |
| `REQUIRE_APPROVAL`| Pause execution until a human approves         | `{ "type": "REQUIRE_APPROVAL", "toolNames": ["restart_server"] }`                                                                   | Match → `REQUIRE_APPROVAL`; an approval record is created and execution is paused    | Infrastructure changes, production deployments, high-risk ops, financial transactions |
| `INPUT_VALIDATION`| Validate tool arguments before execution       | `{ "type": "INPUT_VALIDATION", "toolName": "write_file", "allowedPrefix": "/sandbox/" }`                                            | Inspects arguments for the given tool; valid → `ALLOW`, invalid → `VALIDATION_FAILED`| File path restrictions, input sanitization, directory allowlists           |
| `RISK_BASED`      | Apply policies based on a tool's risk classification | `{ "type": "RISK_BASED", "riskLevel": "CRITICAL" }`                                                                           | Matches on **exact** risk-level equality (`rule.riskLevel === tool risk`); match → rule applies as a block | Blocking all CRITICAL (or HIGH) tools without listing them individually |
| `BUDGET_LIMIT`    | Prevent excessive resource consumption         | `{ "type": "BUDGET_LIMIT", "maxTokens": 50000 }`                                                                                    | `currentTokens >= maxTokens`; match → `BUDGET_EXCEEDED`                              | Conversation-level token limits (current implementation)                   |

Notes:

- For `RISK_BASED`, matching is exact equality against the effective risk level — set one rule per level you want to govern rather than relying on thresholds.
- The engine returns six decision types in total: the three headline outcomes above plus `VALIDATION_FAILED`, `BUDGET_EXCEEDED`, and `ERROR`. All non-`ALLOW` decisions surface to users as `"Tool blocked: <reason>"`.
- `BUDGET_LIMIT` compares conversation token usage from runtime context; future versions could extend this to daily/monthly quotas, per-user or per-organization limits, and cost-based budgets.

## Rule Lifecycle and Loading

Rules persist in PostgreSQL but never reach the engine directly from the database. The full lifecycle separates persistence from runtime execution:

```
Dashboard → Database → Rule Loader → Validation → Rule Cache → Policy Engine → Evaluation → Decision
```

On application start, the Rule Loader fetches enabled rules from PostgreSQL, sorts them by priority, validates them with Zod, converts them to runtime rules, and populates the Rule Cache. From then on, the engine reads only from memory.

### Rule Cache

The Rule Cache holds the active policy set. It provides fast access during evaluation and eliminates database reads from the request path. It is read-only during normal execution; only the Rule Loader updates it.

### Redis Synchronization

Policy changes must take effect immediately without restarting the agent, so the backend uses Redis Pub/Sub:

```
Dashboard → Create/Update Rule → Database → Redis Publish → Agent Subscriber → Rule Loader → Rule Cache Updated
```

Without synchronization, applying a new rule would require a backend restart. With Pub/Sub, the next request automatically uses the updated policy set.

### Reliability

The design favors stability over aggressive synchronization and fails safely:

- **Invalid rule configuration** → rejected during loading; never enters the Rule Cache.
- **Redis unavailable** → the existing cache continues operating; no interruption to policy evaluation.
- **Database temporarily unavailable** → existing rules remain active; reload resumes once connectivity returns.

## Extending the Engine

Adding a new rule type requires four steps:

1. Define a new rule schema (Zod schema + TypeScript type).
2. Implement a matcher.
3. Implement an evaluator.
4. Register the evaluator in the Policy Engine.

Existing rule implementations remain unchanged (Open/Closed Principle). Plausible future rule types fit into this pipeline without architectural changes: time-based restrictions, user/role-based permissions, organization-specific policies, IP/geographic restrictions, maximum execution time, tool rate limits, conversation allowlists, and multi-stage approval workflows.

Other potential enhancements:

- **Policy versioning** — track every change and roll back to previous versions.
- **Policy simulator** — test a request against policies without executing the tool.
- **Rule groups** — logical collections (Production, Development, Finance, Infrastructure).
- **Conditional rules** — richer expressions (only after business hours, only for production servers, only for specific users, combined conditions).
- **Approval chains** — sequential multi-approver flows (Developer → Team Lead → Security → Execute).
- **Metrics** — rules evaluated, average evaluation latency, most frequently matched rules, blocked requests, approval rate.

## Summary

The Policy Engine evaluates a `PolicyRequest` against validated in-memory rules in ascending priority order using first-match-wins semantics, returning a deterministic `PolicyDecision` (with reason, matched rule, and trace) without touching infrastructure. Rule loading, caching (via the Rule Cache), synchronization (Redis Pub/Sub), and evaluation are separated into distinct responsibilities, allowing new guardrails to be introduced with minimal changes while existing behavior stays stable.
