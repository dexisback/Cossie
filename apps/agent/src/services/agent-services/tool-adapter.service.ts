//gemini doesnt understand mcp tools, the registry
//returns {name, descriptoin, inputSchema}
//and gemini expedcts {functionDeclarations: lambda}
//SO THIS FILE CONVERTS THE MCP TOOL -> GEMINI TOOL

import type {
  DiscoveredTool,
} from "@cossie/shared-types";

export class ToolAdapterService {
  toGeminiTools(
    tools: DiscoveredTool[]
  ) {
    return [
      {
        functionDeclarations:
          tools.map(tool => ({
            name: tool.name,

            description:
              tool.description,

            parameters:
              JSON.parse(JSON.stringify(tool.inputSchema)),
          })),
      },
    ];
  }
}

export const toolAdapterService =
  new ToolAdapterService();