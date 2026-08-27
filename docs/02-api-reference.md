# 02-api-reference.md (Part 1)

# API Reference

This document provides the complete reference for every HTTP endpoint exposed by the Cossie Agent backend.

Unlike `01-backend-architecture.md`, which explains how the backend is designed, this document explains how external clients interact with it.

The intended audience includes:

* Frontend developers
* Backend developers
* API consumers
* Future contributors
* Engineers integrating Cossie into other systems

Every endpoint is documented with:

* Purpose
* HTTP method
* Request format
* Response format
* Internal execution flow
* Error conditions
* Notes and implementation details

---

# API Philosophy

The backend exposes a REST API that acts as the single public interface to the platform.

Clients never communicate directly with:

* Prisma
* Redis
* Policy Engine
* MCP Registry
* LLM Providers

Instead, every request passes through the API layer, where it is validated, delegated to services, and transformed into structured responses.

This ensures:

* centralized orchestration
* consistent error handling
* predictable behavior
* future compatibility with authentication and authorization

---

# Base URL

During development:

```text
http://localhost:3000
```

Future production deployments may expose the API behind a reverse proxy or API gateway.

---

# Content Type

All endpoints communicate using JSON.

Request:

```http
Content-Type: application/json
```

Response:

```http
Content-Type: application/json
```

---

# Response Philosophy

Successful requests should always return structured JSON.

Typical pattern:

```json
{
  "success": true,
  "data": {}
}
```

or

```json
{
  "success": true,
  "response": "..."
}
```

depending on the endpoint.

The API avoids returning raw infrastructure objects unless they are intentionally exposed (e.g., Tool Catalog or Audit Logs).

---

# Error Philosophy

Failures should be explicit and machine-readable.

Typical structure:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

Internal implementation details such as stack traces should never be exposed to clients.

Instead, detailed diagnostics belong in audit logs or server logs.

---

# HTTP Status Codes

The current implementation primarily uses:

| Code | Meaning                 |
| ---: | ----------------------- |
|  200 | Successful request      |
|  400 | Invalid request payload |
|  404 | Resource not found      |
|  500 | Internal server error   |

Future versions may introduce additional status codes such as:

* 401 Unauthorized
* 403 Forbidden
* 409 Conflict
* 429 Too Many Requests

---

# Endpoint Categories

The API is organized into six feature groups.

| Category     | Purpose                 |
| ------------ | ----------------------- |
| `/chat`      | AI agent interaction    |
| `/rules`     | Policy management       |
| `/tools`     | MCP tool catalog        |
| `/approvals` | Human approval workflow |
| `/logs`      | Audit history           |
| `/health`    | Operational monitoring  |

Each group owns a single domain and should remain independent from the others.

---

# Internal Request Lifecycle

Although clients only observe an HTTP request and response, every request follows the same internal execution model.

```text
Client

↓

Express Route

↓

Validation

↓

Application Service

↓

Domain Package(s)

↓

Infrastructure

↓

Response
```

Business logic never lives inside routes.

Routes act only as transport adapters between HTTP and the service layer.

---

# Stateless API Design

Every request is treated independently.

The server does not maintain HTTP session state.

Persistent information is stored explicitly in the database.

This design simplifies scaling and makes horizontal deployment straightforward.

---

# Authentication

The current project does not require authentication.

Therefore, all endpoints are assumed to operate in a trusted administrative environment.

Future versions should introduce:

* JWT authentication
* Role-based access control
* Organization-level authorization
* API keys for service-to-service communication

The API has been designed so these additions can be introduced without changing endpoint semantics.

---

# Versioning Strategy

The current API is unversioned.

Future production deployments should expose endpoints under a versioned prefix.

Example:

```text
/api/v1
```

This allows backward-compatible evolution while supporting multiple client versions.

---

# What's Next

The following sections document every endpoint individually, including:

* request schema
* response schema
* runtime behavior
* internal execution flow
* edge cases
* implementation notes
* future improvements

Beginning with:

**Health APIs**, followed by the remaining endpoint groups in the order they are typically encountered during system operation.


---
# 02-api-reference.md (Part 2)

# Health APIs

The Health API provides operational information about the running agent.

Its purpose is not simply to determine whether the server is alive, but also whether the backend is correctly connected to its critical dependencies.

---

## GET /health

### Purpose

Returns the operational status of the backend.

Used by:

* Dashboard
* Monitoring systems
* Load balancers
* Developers

---

### Request

```http
GET /health
```

No request body.

---

### Success Response

Example:

```json
{
  "status": "ok",
  "uptime": 148.42,
  "database": "healthy",
  "servers": 2,
  "tools": 9
}
```

---

### Response Fields

| Field    | Description                       |
| -------- | --------------------------------- |
| status   | Overall application status        |
| uptime   | Seconds since application startup |
| database | Database connectivity             |
| servers  | Connected MCP servers             |
| tools    | Total discovered tools            |

---

### Internal Flow

```text
GET /health

↓

Health Route

↓

Health Service

↓

Database Check

↓

Registry

↓

Return JSON
```

---

### Failure Cases

Possible responses include:

* Database unavailable
* Registry initialization failure
* Unexpected internal exception

Future improvements:

* Redis status
* Gemini availability
* Groq availability
* Version information
* Build commit
* Memory usage

---

# Chat APIs

The Chat API is the primary entry point into the AI agent.

Every user interaction begins here.

---

## POST /chat

### Purpose

Accepts a natural language prompt and executes the complete AI agent workflow.

Responsibilities include:

* Prompt inspection
* LLM invocation
* Tool execution
* Policy enforcement
* Approval handling
* Final response generation

---

### Request

```http
POST /chat
```

Example body:

```json
{
  "message": "Restart server srv-1"
}
```

---

### Success Response

Normal conversation:

```json
{
  "success": true,
  "response": "Server srv-1 has been restarted successfully."
}
```

Approval required:

```json
{
  "success": true,
  "response": "Approval required. Approval ID: cmq..."
}
```

Blocked request:

```json
{
  "success": true,
  "response": "Tool blocked: Restart operations are prohibited."
}
```

---

### Internal Flow

```text
POST /chat

↓

Prompt Security

↓

ChatService

↓

LLM

↓

Function Call?

↓

Policy Engine

↓

ALLOW
DENY
APPROVAL

↓

Registry

↓

Tool

↓

LLM Summary

↓

Response
```

---

### Possible Outcomes

| Decision         | Behaviour                 |
| ---------------- | ------------------------- |
| ALLOW            | Tool executes immediately |
| DENY             | Tool is blocked           |
| REQUIRE_APPROVAL | Approval record created   |
| No Tool Call     | Normal LLM response       |

---

### Possible Errors

* Invalid request body
* LLM unavailable
* MCP server unavailable
* Tool execution failure
* Internal server error

Gemini failures automatically trigger retry and fallback to Groq.

---

# Rule APIs

The Rule APIs manage runtime guardrails.

Every rule created through these endpoints is immediately synchronized with the running agent.

---

## GET /rules

Returns all configured rules.

Example response:

```json
[
  {
    "id": "...",
    "name": "Block Restart",
    "type": "BLOCK_TOOL",
    "priority": 1,
    "enabled": true
  }
]
```

---

## POST /rules

Creates a new policy.

Example:

```json
{
  "name": "Block Restart",
  "type": "BLOCK_TOOL",
  "priority": 1,
  "enabled": true,
  "config": {
    "type": "BLOCK_TOOL",
    "toolNames": [
      "restart_server"
    ]
  }
}
```

---

### Internal Flow

```text
POST /rules

↓

Prisma

↓

Database

↓

Redis Publish

↓

Rule Loader

↓

Rule Cache

↓

Policy Engine Updated
```

No application restart is required.

---

## PATCH /rules/:id

Updates an existing rule.

Typical updates:

* Priority
* Enabled state
* Configuration
* Description

Runtime synchronization follows the same Redis pipeline.

---

## DELETE /rules/:id

Removes a rule permanently.

Deletion also publishes a policy update event so the in-memory cache remains synchronized.

---

### Future Improvements

* Rule validation endpoint
* Bulk import/export
* Rule version history
* Dry-run simulation
* Rule templates


---

# 02-api-reference.md (Part 3)

# Tool APIs

The Tool APIs expose the runtime MCP ecosystem to the dashboard.

Unlike the Registry, these endpoints do not communicate directly with MCP servers. Instead, they expose the Registry's current state and allow administrators to manage runtime metadata such as risk overrides.

---

## GET /tools

### Purpose

Returns every discovered MCP tool currently known to the platform.

The returned list originates from the persisted Tool Catalog rather than directly querying MCP servers.

---

### Request

```http
GET /tools
```

No request body.

---

### Example Response

```json
[
  {
    "toolName": "restart_server",
    "description": "Restart a server",
    "serverId": "infra-mcp",
    "inferredRisk": "CRITICAL",
    "finalRisk": "CRITICAL"
  }
]
```

---

### Internal Flow

```text
GET /tools

↓

Tool Route

↓

Prisma

↓

Tool Catalog

↓

JSON Response
```

---

## POST /tools/refresh

### Purpose

Forces runtime rediscovery of every connected MCP server.

Useful when:

* New tools are added
* MCP server changes
* Schemas are updated

---

### Request

```http
POST /tools/refresh
```

---

### Example Response

```json
{
  "success": true,
  "tools": 9
}
```

---

### Internal Flow

```text
Refresh

↓

Registry

↓

tools/list

↓

Discovery

↓

Risk Classification

↓

Persist Tool Catalog

↓

Runtime Cache Updated
```

---

## PATCH /tools/:tool/risk

### Purpose

Creates or updates a runtime risk override.

Overrides always take precedence over automatically inferred risk.

---

### Example Request

```json
{
  "riskLevel": "CRITICAL"
}
```

---

### Example Response

```json
{
  "toolName": "restart_server",
  "riskLevel": "CRITICAL"
}
```

---

## GET /tools/:tool/risk

Returns the current override associated with a tool.

If no override exists, the API returns an appropriate empty response or not-found response depending on implementation.

---

# Approval APIs

Approval APIs implement the human-in-the-loop workflow.

They exist because some operations should neither execute automatically nor be permanently blocked.

Instead, execution pauses until a human makes a decision.

---

## GET /approvals

### Purpose

Returns every currently pending approval.

Used primarily by the dashboard.

---

### Request

```http
GET /approvals
```

---

### Example Response

```json
[
  {
    "id": "...",
    "toolName": "restart_server",
    "status": "PENDING"
  }
]
```

---

## POST /approvals/:id/approve

### Purpose

Approves a pending request.

Flow:

```text
Approval

↓

Status Updated

↓

ApprovalExecutionService

↓

Registry

↓

Tool Executes

↓

Audit Log
```

---

### Example Response

```json
{
  "status": "APPROVED"
}
```

---

## POST /approvals/:id/reject

Rejects a pending request.

Flow:

```text
Approval

↓

Status Updated

↓

Audit Log

↓

Finished
```

Rejected approvals never execute.

---

### Possible Errors

* Approval not found
* Approval already resolved
* Database failure
* Tool execution failure (after approval)

---

# Log APIs

The Log APIs expose the audit trail generated by the backend.

Logs are immutable.

Every significant event becomes a permanent historical record.

---

## GET /logs

### Purpose

Returns execution history.

Current implementation returns all logs.

Future versions should support:

* Pagination
* Search
* Filtering
* Date ranges
* Event types

---

### Request

```http
GET /logs
```

---

### Example Response

```json
[
  {
    "eventType": "PROMPT_INJECTION",
    "toolName": "PROMPT_SECURITY",
    "decision": "ALLOW",
    "reason": "ignore previous instructions"
  }
]
```

---

### Event Types

Current event types include:

* TOOL_EXECUTION
* PROMPT_INJECTION
* APPROVAL_CREATED
* APPROVAL_APPROVED
* APPROVAL_REJECTED

Future versions may introduce additional operational events.

---

### Internal Flow

```text
GET /logs

↓

Prisma

↓

ToolExecutionLog

↓

JSON Response
```

---

# Endpoint Summary

| Endpoint                    | Purpose              |
| --------------------------- | -------------------- |
| GET /health                 | Platform health      |
| POST /chat                  | AI interaction       |
| GET /rules                  | List policies        |
| POST /rules                 | Create policy        |
| PATCH /rules/:id            | Update policy        |
| DELETE /rules/:id           | Delete policy        |
| GET /tools                  | Tool catalog         |
| POST /tools/refresh         | Rediscover MCP tools |
| PATCH /tools/:tool/risk     | Override risk        |
| GET /tools/:tool/risk       | View override        |
| GET /approvals              | Pending approvals    |
| POST /approvals/:id/approve | Approve execution    |
| POST /approvals/:id/reject  | Reject execution     |
| GET /logs                   | Audit history        |


---

# 02-api-reference.md (Part 4)

# API Design Decisions

This section explains the reasoning behind the API rather than the endpoints themselves.

The goal was not simply to expose backend functionality, but to create an interface that is predictable, extensible, and suitable for both the dashboard and future integrations.

---

# Thin API Layer

Routes intentionally contain almost no business logic.

Instead:

```text
HTTP Request

↓

Route

↓

Service

↓

Domain Package

↓

Response
```

This keeps:

* controllers simple
* services reusable
* packages framework-independent

---

# REST Over RPC

The backend follows REST conventions.

Examples:

```text
GET    /rules

POST   /rules

PATCH  /rules/:id

DELETE /rules/:id
```

instead of:

```text
/createRule

/updateRule

/deleteRule
```

REST provides predictable semantics and integrates well with frontend tooling.

---

# Resource-Oriented Design

Every endpoint revolves around a resource.

Current resources include:

* Chat
* Rules
* Tools
* Approvals
* Logs
* Health

This keeps the API intuitive and scalable.

---

# Stateless Requests

Every request contains everything required for execution.

The backend does not maintain HTTP session state.

Persistent state is stored explicitly in the database.

Benefits:

* Horizontal scalability
* Simpler deployments
* Easier testing

---

# Separation of Read and Write Operations

Read endpoints:

```text
GET /rules

GET /tools

GET /logs

GET /approvals

GET /health
```

Write endpoints:

```text
POST /chat

POST /rules

PATCH /rules/:id

DELETE /rules/:id

PATCH /tools/:tool/risk

POST /approvals/:id/approve

POST /approvals/:id/reject
```

This separation improves readability and follows standard REST conventions.

---

# Consistent JSON Responses

All endpoints communicate using JSON.

Responses are designed to be consumed directly by the dashboard without additional transformation.

Future improvements may introduce a standardized response envelope across every endpoint.

---

# Error Handling Strategy

Errors are categorized into:

### Validation Errors

Example:

Malformed request body.

Response:

```json
{
  "success": false,
  "error": "Invalid request body"
}
```

---

### Resource Errors

Examples:

* Rule not found
* Approval not found
* Tool not found

---

### Infrastructure Errors

Examples:

* Database unavailable
* MCP server unavailable
* Redis unavailable
* LLM provider unavailable

These are translated into human-readable API responses while internal diagnostics remain in server logs.

---

### Unexpected Errors

Unhandled exceptions return a generic server error rather than exposing implementation details.

---

# Frontend Integration

The dashboard primarily communicates with these endpoints:

```text
Overview

↓

GET /health

GET /logs

GET /approvals
```

```text
Policies

↓

GET /rules

POST /rules

PATCH /rules/:id

DELETE /rules/:id
```

```text
Tools

↓

GET /tools

PATCH /tools/:tool/risk

POST /tools/refresh
```

```text
Approvals

↓

GET /approvals

POST /approvals/:id/approve

POST /approvals/:id/reject
```

```text
Logs

↓

GET /logs
```

The frontend never communicates directly with Redis, Prisma, or MCP servers.

---

# Security Considerations

The current project assumes a trusted environment.

Future production deployments should introduce:

* JWT authentication
* Role-based authorization
* API keys
* Request rate limiting
* CSRF protection (if cookie-based auth is used)
* Audit logging for administrative actions

The existing API design already supports these additions.

---

# Future Improvements

The API has been intentionally designed to evolve.

Planned improvements include:

### Pagination

Especially for:

* Logs
* Rules
* Tool Catalog

---

### Filtering

Examples:

```text
GET /logs?eventType=PROMPT_INJECTION

GET /rules?enabled=true
```

---

### Sorting

Examples:

Newest first.

Priority ascending.

Risk descending.

---

### Search

Examples:

```text
GET /tools?search=restart

GET /logs?search=approval
```

---

### API Versioning

Future production deployments should expose endpoints under:

```text
/api/v1
```

allowing backward-compatible evolution.

---

### OpenAPI Specification

Generating an OpenAPI/Swagger document would provide:

* Interactive documentation
* Client SDK generation
* Better testing
* Improved onboarding

---

# Example Dashboard Polling Strategy

The dashboard does not require WebSockets.

A lightweight polling approach is sufficient.

Suggested intervals:

| Endpoint       |                  Interval |
| -------------- | ------------------------: |
| GET /health    |                10 seconds |
| GET /approvals |                 5 seconds |
| GET /logs      |                 5 seconds |
| GET /tools     |                30 seconds |
| GET /rules     | On navigation or mutation |

This keeps the UI responsive while avoiding unnecessary load.

---

# API Stability

The API has been designed around stable resources rather than implementation details.

As the backend evolves internally, the external contract should remain as stable as possible.

This minimizes frontend changes and simplifies future integrations.

---

# Conclusion

The REST API serves as the single public interface to the Cossie backend.

It exposes the platform's capabilities while hiding internal implementation details such as the Policy Engine, MCP Registry, Redis synchronization, and LLM provider logic.

This separation allows the backend architecture to evolve independently while preserving a clean and predictable interface for clients.

---

# Document Summary

This document covered:

* API philosophy
* Response conventions
* Error handling
* Complete endpoint reference
* Runtime behavior
* Internal execution flow
* Frontend integration
* Security considerations
* Future evolution

With this, the API surface of the backend is fully documented.

The next document, **03-policy-engine.md**, will focus exclusively on the policy subsystem—its internal architecture, rule evaluation pipeline, caching strategy, Redis synchronization, evaluator design, trace generation, and extensibility.


---

