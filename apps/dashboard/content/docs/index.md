---
title: Introduction
description: >-
  Cossie is a policy enforcement layer for AI agents. It sits between a language model and the MCP tools it invokes, evaluating every request before execution.
---

# Cossie

Cossie is an AI agent security platform. It sits **between** a language model and the Model Context Protocol (MCP) tools it invokes, evaluating every tool request against administrator-defined policies before execution.

The core question is not *"can the model call tools?"* — it is *"should the model be allowed to call this tool?"*

> The LLM proposes the action. Cossie decides whether it is permitted.

## Why it exists

Language models can invoke external tools, and uncontrolled tool use is dangerous: deleting production data, restarting critical infrastructure, leaking secrets, and acting on prompt-injection instructions.

Cossie inserts a dedicated **Policy Engine** between the model and every tool. The model is never trusted to decide what it may do.

```text
User → LLM → Policy Engine → MCP Tools
```

## How a request flows

1. A prompt arrives at `POST /api/chat`.
2. **Prompt Security** scans it for suspicious patterns.
3. The LLM either replies or requests a tool call.
4. The tool request is evaluated by the **Policy Engine**.
5. The engine returns `ALLOW`, `DENY`, or `REQUIRE_APPROVAL`.
6. Allowed requests execute through the **MCP Registry**.

```text
        ┌──────────────┐
        │   Dashboard  │   policies · approvals · tools · logs
        └──────┬───────┘
               │ REST API
        ┌──────▼───────┐
        │   Agent API  │
        └──────┬───────┘
               │ prompt
        ┌──────▼──────────┐
        │ Prompt Security │
        └──────┬──────────┘
        ┌──────▼──────────┐
        │    LLM Layer    │   Gemini → Groq fallback
        └──────┬──────────┘
        ┌──────▼──────────┐
        │    Tool Loop    │
        └──────┬──────────┘
               │ tool request
        ┌──────▼──────────┐
        │  Policy Engine  │   ALLOW / DENY / REQUIRE_APPROVAL
        └──────┬──────────┘
        ┌──────▼──────────┐
        │  MCP Registry   │
        └──┬───────────┬──┘
           │           │
   Custom MCP Server  Remote MCP Server
```

## Core properties

- **Runtime discovery** — tools are discovered from MCP servers at runtime; there are no hardcoded tool lists.
- **Runtime configuration** — policies live in the database and take effect without redeploys.
- **Deterministic policy** — the engine is pure and stateless; the same input always yields the same decision.
- **Human approval** — sensitive actions can pause for manual authorization.
- **Complete audit** — every decision is logged and explainable.

## Explore the docs

| Page | Covers |
| --- | --- |
| [System Design](/docs/concepts/system-design) | Architectural principles and the trade-offs behind them. |
| [Backend Architecture](/docs/concepts/backend-architecture) | Packages, services, and the full request lifecycle. |
| [Policy Engine](/docs/concepts/policy-engine) | Rule types and how authorization decisions are evaluated. |
| [Security Model](/docs/security/security-model) | Trust boundaries, guarantees, and limitations. |
| [API Reference](/docs/reference/api) | Every HTTP endpoint exposed by the agent. |
