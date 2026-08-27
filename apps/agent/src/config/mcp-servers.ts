// Single global source of truth for all MCP servers.
// The registry bootstraps itself from this configuration.

import type { MCPServerConfig } from "@cossie/shared-types";

export const MCP_SERVERS: MCPServerConfig[] = [
  {
    id: "infra-mcp",

    name: "Infrastructure MCP",

    transport: "stdio",

    command: "node",

    args: [
      "../custom-mcp/dist/index.js",
    ],
  },

  {
    id: "context7",

    name: "Context7",

    transport: "stdio",

    command: "node",

    args: [
      "./node_modules/@upstash/context7-mcp/dist/index.js",
      "--api-key",
      process.env.CONTEXT7_API_KEY!,
    ],
  },
];