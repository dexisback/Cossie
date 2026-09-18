---
title: API Reference
description: >-
  Complete HTTP API reference for the Cossie Agent backend: endpoints, request/response schemas, status codes, and error behavior.
---

# API Reference

HTTP API reference for the Cossie Agent backend. The REST API is the single public interface to the platform — clients never communicate directly with Prisma, Redis, the Policy Engine, the MCP Registry, or LLM providers.

## Conventions

- **Base URL:** `http://localhost:4000` in development. All routes mount under `/api` and are unversioned; future deployments should expose `/api/v1`.
- **Content type:** JSON for requests and responses.
- **Auth:** none currently; all endpoints assume a trusted administrative environment.
- **Success responses:** chat and tools use `{ "success": true, ... }`; other endpoints return plain JSON.
- **Error responses:** two shapes exist — chat/tools return `{ "success": false, "error": "..." }`; rules endpoints return bare `{ "error": "..." }`. Internal details (stack traces) are never exposed.

### Status codes

| Code | Meaning |
| ---: | --- |
| 200 | Successful request |
| 201 | Rule created |
| 204 | Rule deleted (no body) |
| 400 | Invalid request payload |
| 404 | Resource not found |
| 500 | Internal server error |

## Endpoint summary

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Platform health |
| POST | `/api/chat` | AI interaction |
| GET | `/api/rules` | List policies |
| POST | `/api/rules` | Create policy |
| PATCH | `/api/rules/:id` | Update policy |
| DELETE | `/api/rules/:id` | Delete policy |
| GET | `/api/tools` | Tool catalog |
| POST | `/api/tools/refresh` | Rediscover MCP tools |
| PATCH | `/api/tools/:toolName/risk` | Override risk |
| GET | `/api/tools/:toolName/risk` | View override |
| GET | `/api/approvals` | Pending approvals |
| POST | `/api/approvals/:id/approve` | Approve + execute |
| POST | `/api/approvals/:id/reject` | Reject execution |
| GET | `/api/logs` | Audit history |

---

## Health

### `GET /api/health`

Returns the backend's operational status, including connectivity to critical dependencies. Used by the dashboard, monitoring, and load balancers.

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
| `status` | Overall application status |
| `uptime` | Seconds since startup |
| `database` / `redis` | `healthy` or `unhealthy` per dependency |
| `servers` / `tools` | Connected MCP servers and discovered tools |
| `models` | Per-provider key configuration check |
| `providers` | Default and fallback provider names |

---

## Chat

### `POST /api/chat`

Accepts a natural language prompt and executes the full agent workflow: prompt security inspection → LLM invocation → function call handling → policy enforcement → approval handling → tool execution → final response. The conversation is created or resolved server-side.

**Request body:**

```json
{
  "message": "Restart server srv-1",
  "conversationId": "optional-existing-conversation-id"
}
```

**Response examples — all return `200`:**

```json
{
  "success": true,
  "response": "Server srv-1 has been restarted successfully.",
  "conversationId": "cmf..."
}
```

```json
{
  "success": true,
  "response": "Approval required. Approval ID: cmq...",
  "conversationId": "cmf..."
}
```

```json
{
  "success": true,
  "response": "Tool blocked: Restart operations are prohibited.",
  "conversationId": "cmf..."
}
```

**Policy outcomes:**

| Decision | Behavior |
| --- | --- |
| `ALLOW` | Tool executes immediately |
| `DENY` / `VALIDATION_FAILED` / `BUDGET_EXCEEDED` | Tool blocked; response explains why |
| `REQUIRE_APPROVAL` | Approval record created; tool **not** executed |
| No tool call | Normal LLM response |

---

## Rules

Rule endpoints manage runtime guardrails. Every change is synchronized to the running agent via Redis publish (`database write → publish policy:updated → Rule Loader → rule cache`), so no restart is required.

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

Creates a new policy. The `config` payload is validated against the shared Zod rule schemas and must include a matching `type`.

```json
{
  "name": "Block Restart",
  "type": "BLOCK_TOOL",
  "priority": 1,
  "enabled": true,
  "config": { "type": "BLOCK_TOOL", "toolNames": ["restart_server"] }
}
```

### `PATCH /api/rules/:id`

Updates an existing rule (priority, enabled state, configuration, description) and synchronizes via the same Redis pipeline.

### `DELETE /api/rules/:id` — `204`

Removes a rule permanently and publishes a policy update event.

---

## Tools

These endpoints read from the persisted Tool Catalog — they do not query MCP servers directly.

### `GET /api/tools`

Returns every discovered MCP tool, merged with any risk overrides.

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

Forces rediscovery of every connected MCP server. Internally: `tools/list` → risk classification → persist catalog → update runtime cache.

```json
{ "success": true, "tools": 9 }
```

### `PATCH /api/tools/:toolName/risk`

Creates or updates a runtime risk override. Overrides take precedence over inferred risk and are read per call.

```json
{ "riskLevel": "CRITICAL" }
```

`riskLevel` must be one of `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` — otherwise `400 { "error": "Invalid riskLevel" }`.

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

Approves a pending request **and executes it immediately**: status → `APPROVED` → `ApprovalExecutionService` executes the stored tool + arguments through the Registry → audit log written (`APPROVAL_APPROVED`, decision `ALLOW`).

```json
{
  "approval": { "status": "APPROVED", "resolvedAt": "...", "resolutionReason": null },
  "result": { "success": true, "message": "srv-1 restarted" }
}
```

### `POST /api/approvals/:id/reject`

Rejects a pending request: status → `REJECTED` → audit log written (`APPROVAL_REJECTED`, decision `DENY`). Rejected approvals never execute.

---

## Logs

### `GET /api/logs`

Returns the latest 100 audit records. Accepts an optional `?approvalId=` filter.

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

- **Dashboard usage** — Overview reads `/api/health`, `/api/logs`, `/api/approvals`; Policies use `/api/rules`; Tools use `/api/tools` and `/api/tools/refresh`; Approvals use `/api/approvals` plus approve/reject. Suggested polling intervals: `/api/health` 10s, `/api/approvals` and `/api/logs` 5s, `/api/tools` 30s.
- **Planned improvements** — pagination, filtering, sorting, versioned prefix, OpenAPI generation, rate limiting, and a unified error envelope.
