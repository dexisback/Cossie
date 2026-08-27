//this connects all mcp servers. populates the mcp registry


import { registry } from "@cossie/mcp-registry";

import { MCP_SERVERS } from "../config/mcp-servers.js";


import { toolCatalogService }
from "../services/tool-catalog.service.js";

export async function discoverTools() {
  for (const server of MCP_SERVERS) {
    if (server.transport === "sse" && (!server.url || server.url.trim() === "")) {
      console.warn(`Skipping SSE MCP server "${server.name || server.id}" (not configured).`);
      continue;
    }
    try {
      await registry.registerServer(server);
    } catch (error) {
      console.error(`Failed to register MCP server "${server.id}":`, error);
    }
  }

  await toolCatalogService.sync(
    registry.getTools()
  );
}
