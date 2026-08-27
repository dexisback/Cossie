//connects to MCP servers
//runs tools/list, builds discoveredTools() , adds risk level , persists with building toolCatalog, returns tool to registry

import { resolveRisk } from "./risk-resolver.js";

import type {
  DiscoveredTool,
  MCPServerConfig,
} from "@cossie/shared-types";

import {
  SSEClientTransport,
} from "@modelcontextprotocol/sdk/client/sse.js";

import {
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { inferRisk } from "./risk-classifier.js";

export async function discoverTools(
  server: MCPServerConfig
): Promise<DiscoveredTool[]> {
  const client = new Client(
    {
      name: "cossie-agent",
      version: "1.0.0",
    }
  );

  if (server.transport === "stdio") {
    const transport =
      new StdioClientTransport({
        command: server.command!,
        args: server.args ?? [],
        env: process.env as Record<string, string>,
      });

    await client.connect(
      transport
    );
  } else {
    const transport =
      new SSEClientTransport(
        new URL(server.url!)
      );

    await client.connect(
      transport
    );
  }

  const response =
    await client.listTools();

//   return response.tools.map(
//     tool => ({
//       name: tool.name,

//       description:
//         tool.description ?? "",

//       serverId: server.id,

//       inputSchema:
//         tool.inputSchema,

//       riskLevel: inferRisk(
//         tool.name,
//         tool.description ?? ""
//       ),
const discoveredTools =
  await Promise.all(
    response.tools.map(
      async tool => {
        const inferredRisk =
          inferRisk(
            tool.name,
            tool.description ?? ""
          );

        const classification =
          await resolveRisk(
            tool.name,
            inferredRisk
          );

        return {
          name: tool.name,

          description:
            tool.description ?? "",

          serverId:
            server.id,

          inputSchema:
            tool.inputSchema,

          riskLevel:
            classification.finalRisk,
        };
      }
    )
  );

  return discoveredTools;
}
