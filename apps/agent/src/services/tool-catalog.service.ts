import { prisma } from "@cossie/db";

import type {
  DiscoveredTool,
} from "@cossie/shared-types";

export class ToolCatalogService {
  async sync(
    tools: DiscoveredTool[]
  ) {
    await prisma.$transaction(
      tools.map((tool) =>
        prisma.toolCatalog.upsert({
          where: { toolName: tool.name },
          create: {
            toolName: tool.name,
            description: tool.description,
            serverId: tool.serverId,
            inferredRisk: tool.riskLevel as any,
            finalRisk: tool.riskLevel as any,
          },
          update: {
            description: tool.description,
            inferredRisk: tool.riskLevel as any,
            finalRisk: tool.riskLevel as any,
            updatedAt: new Date(),
          },
        })
      )
    );
  }
}

export const toolCatalogService =
  new ToolCatalogService();