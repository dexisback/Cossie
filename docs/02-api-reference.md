# API Reference

HTTP API reference for the Cossie Agent backend. The REST API is the single public interface to the platform — clients never communicate directly with Prisma, Redis, the Policy Engine, the MCP Registry, or LLM providers.

## Conventions

- **Base URL:** `http://localhost:4000` (development). All routes are mounted under `/api`. Unversioned; future deployments should expose `/api/v1`.
- **Content type:** JSON for requests and responses (`Content-Type: application/json`).
- **Auth:** None currently. All endpoints assume a trusted administrative environment. Future versions plan JWT auth, RBAC, organization-level authorization, and API keys.
- **Success responses:** Chat and tools use `{"success": true, ...}`; other endpoints return plain JSON arrays/objects.
- **Error responses:** Two shapes exist today — chat/tools return `{ "success": false, "error": "..." }`, rules endpoints return bare `{ "error": "..." }`. There is no central error-handling middleware; each route catches its own errors. Internal details (stack traces) are never exposed.

### Status codes

| Code | Meaning                 |
| ---: | ----------------------- |
|  200 | Successful request      |
|  201 | Rule created            |
|  204 | Rule deleted (no body)  |
|  400 | Invalid request payload |
|  404 | Resource not found      |
|  500 | Internal server error   |

Future codes planned: 401, 403, 409, 429.

## Endpoint summary

| Method | Path                            | Purpose                |
| ------ | ------------------------------- | ---------------------- |
| GET    | `/api/health`                   | Platform health        |
| POST   | `/api/chat`                     | AI interaction         |
| GET    | `/api/rules`                    | List policies          |
| POST   | `/api/rules`                    | Create policy          |
| PATCH  | `/api/rules/:id`                | Update policy          |
| DELETE | `/api/rules/:id`                | Delete policy          |
| GET    | `/api/tools`                    | Tool catalog           |
| POST   | `/api/tools/refresh`            | Rediscover MCP tools   |
| PATCH  | `/api/tools/:toolName/risk`     | Override risk          |
| GET    | `/api/tools/:toolName/risk`     | View override          |
| GET    | `/api/approvals`                | Pending approvals      |
| POST   | `/api/approvals/:id/approve`    | Approve + execute      |
| POST   | `/api/approvals/:id/reject`     | Reject execution       |
| GET    | `/api/logs`                     | Audit history          |

---

## Health

### `GET /api/health`

Returns operational status of the backend, including connectivity to critical dependencies. Used by the dashboard, monitoring systems, and load balancers.

**Request:** no body.

**Response example:**

```json
{
  "status": "ok",
  "uptime": 148.42,
  "database": "healthy",
  "redis": "healthy",
  "servers": 2,
  "tools": 9,
  "models": { "gemini": true, "groq": true },
  "providers": { "default": "gemini", "fallback": "groq" }
}
```

| Field | Description |
| --- | --- |
| status | Overall application status |
| uptime | Seconds since application startup |
| database / redis | `healthy` or `unhealthy` per dependency |
| servers / tools | Connected MCP servers and total discovered tools |
| models | Per-provider key configuration check |
| providers | Default and fallback provider names |

---

## Chat

### `POST /api/chat`

Accepts a natural language prompt and executes the full agent workflow: prompt security inspection → LLM invocation → function call handling → policy enforcement → approval handling → tool execution → LLM-generated final response. The conversation is created or resolved server-side; user and assistant messages are persisted.

**Request body:**

```json
{
  "message": "Restart server srv-1",
  "conversationId": "optional-existing-conversation-id"
}
```

**Response examples — all return `200`:**

Normal conversation:

```json
{
  "success": true,
  "response": "Server srv-1 has been restarted successfully.",
  "conversationId": "cmf..."
}
```

Approval required:

```json
{
  "success": true,
  "response": "Approval required. Approval ID: cmq...",
  "conversationId": "cmf..."
}
```

Blocked by policy:

```json
{
  "success": true,
  "response": "Tool blocked: Restart operations are prohibited.",
  "conversationId": "cmf..."
}
```

**Policy outcomes:**

| Decision         | Behaviour                 |
| ---------------- | ------------------------- |
| ALLOW            | Tool executes immediately |
| DENY / VALIDATION_FAILED / BUDGET_EXCEEDED | Tool blocked; response explains why |
| REQUIRE_APPROVAL | Approval record created; tool NOT executed |
| No tool call     | Normal LLM response       |

**Errors:** invalid request body, conversation not found (404), LLM unavailable (Gemini failures automatically fall back to Groq), MCP server unavailable, tool execution failure, internal server error (500).

---

## Rules

Rule endpoints manage runtime guardrails. Every change is immediately synchronized to the running agent via a Redis publish pipeline (database write → publish `policy:updated` → Rule Loader → in-memory rule cache), so no application restart is required.

### `GET /api/rules`

Returns all configured rules, ordered by priority ascending.

```json
[
  {
    "id": "...",
    "name": "Block Restart",
    "type": "BLOCK_TOOL",
    "priority": 1,
    "enabled": true,
    "config": { "type": "BLOCK_TOOL", "toolNames": ["restart_server"] }
  }
]
```

### `POST /api/rules` — `201`

Creates a new policy.

**Request body:**

```json
{
  "name": "Block Restart",
  "type": "BLOCK_TOOL",
  "priority": 1,
  "enabled": true,
  "config": {
    "type": "BLOCK_TOOL",
    "toolNames": ["restart_server"]
  }
}
```

The `config` payload is validated with the shared Zod rule schemas and must include a matching `type`.

### `PATCH /api/rules/:id`

Updates an existing rule (priority, enabled state, configuration, description). Runtime synchronization uses the same Redis pipeline as creation. Errors use bare `{ "error": "..." }` (no `success` field).

### `DELETE /api/rules/:id`

Removes a rule permanently (`204`, empty body). Also publishes a policy update event so the in-memory cache stays synchronized.

**Errors (all rule mutations):** validation errors, rule not found, database/Redis failures.

---

## Tools

Exposes the runtime MCP ecosystem from the persisted Tool Catalog — these endpoints do not query MCP servers directly.

### `GET /api/tools`

Returns every discovered MCP tool currently known to the platform, merged with any risk overrides.

```json
[
  {
    "toolName": "restart_server",
    "description": "Restart a server",
    "serverId": "infra-mcp",
    "inferredRisk": "HIGH",
    "finalRisk": "CRITICAL",
    "overridden": true
  }
]
```

### `POST /api/tools/refresh`

Forces runtime rediscovery of every connected MCP server. Useful when new tools are added, MCP servers change, or schemas are updated. Internally: registry discovery via `tools/list` → risk classification → persist Tool Catalog → runtime cache update. Note: refresh does not publish a Redis event.

**Response:**

```json
{
  "success": true,
  "tools": 9
}
```

### `PATCH /api/tools/:toolName/risk`

Creates or updates a runtime risk override. Overrides always take precedence over automatically inferred risk and are applied at evaluation time (the tool loop reads the override from the database per call).

**Request body:**

```json
{
  "riskLevel": "CRITICAL"
}
```

`riskLevel` must be one of `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` — otherwise `400 { "error": "Invalid riskLevel" }`.

**Response:**

```json
{
  "toolName": "restart_server",
  "riskLevel": "CRITICAL"
}
```

### `GET /api/tools/:toolName/risk`

Returns the current override for a tool, or `null` if none exists.

---

## Approvals

Implements the human-in-the-loop workflow: operations that should neither execute automatically nor be permanently blocked pause until a human decides.

### `GET /api/approvals`

Returns every currently pending approval.

```json
[
  {
    "id": "...",
    "toolName": "restart_server",
    "arguments": { "serverId": "srv-1" },
    "status": "PENDING",
    "requestedAt": "2026-08-27T10:00:00.000Z"
  }
]
```

### `POST /api/approvals/:id/approve`

Approves a pending request **and executes it immediately**: status updated to `APPROVED` → ApprovalExecutionService verifies the status and executes the stored tool + arguments through the Registry → audit log written (`APPROVAL_APPROVED`, decision ALLOW). The execution result is returned in the same response.

**Response:**

```json
{
  "approval": { "status": "APPROVED", "resolvedAt": "...", "resolutionReason": null },
  "result": { "success": true, "message": "srv-1 restarted" }
}
```

**Errors:** approval not found (404), already resolved, database failure, tool execution failure (the approval remains approved but the result carries the error).

### `POST /api/approvals/:id/reject`

Rejects a pending request: status updated to `REJECTED` → audit log written (`APPROVAL_REJECTED`, decision DENY). Rejected approvals never execute.

**Response:** the updated approval object.

---

## Logs

Exposes the immutable audit trail generated by the backend. Logs are append-only historical records.

### `GET /api/logs`

Returns the latest 100 execution records. Accepts an optional `?approvalId=` filter (matches records whose trace contains the approval ID).

```json
[
  {
    "eventType": "PROMPT_INJECTION",
    "toolName": "PROMPT_SECURITY",
    "decision": "ALLOW",
    "executed": false,
    "reason": "ignore previous instructions"
  }
]
```

**Event types:** `TOOL_EXECUTION`, `PROMPT_INJECTION`, `APPROVAL_CREATED`, `APPROVAL_APPROVED`, `APPROVAL_REJECTED`.

---

## Notes for integrators

- **Dashboard usage:** Overview reads `/api/health`, `/api/logs`, `/api/approvals`; Policies use `/api/rules`; Tools use `/api/tools`, `/api/tools/refresh`, `/api/tools/:toolName/risk`; Approvals use `/api/approvals` + approve/reject. Suggested polling intervals: `/api/health` 10s, `/api/approvals` 5s, `/api/logs` 5s, `/api/tools` 30s, `/api/rules` on navigation or mutation. WebSockets are not required.
- **Planned improvements:** pagination, filtering (e.g. `GET /logs?eventType=PROMPT_INJECTION`, `GET /rules?enabled=true`), sorting, search, versioned prefix, OpenAPI spec generation, rate limiting, CSRF protection where cookie-based auth is used, audit logging of administrative actions, a unified error envelope (some endpoints return `{success:false,error}` while rules endpoints return bare `{error}`), and a central Express error-handling middleware.
