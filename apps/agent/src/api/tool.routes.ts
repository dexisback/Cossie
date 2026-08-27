//dashboard tools page
import { Router } from "express";

import { prisma } from "@cossie/db";


//for adding dynamic reloads when a new tool is added:
import {registry } from "@cossie/mcp-registry"
import { MCP_SERVERS } from "../config/mcp-servers.js";
import { toolCatalogService } from "../services/tool-catalog.service.js";



export const toolRouter =
  Router();

toolRouter.get(
  "/tools",
  async (_req, res) => {
    const [catalog, overrides] =
      await Promise.all([
        prisma.toolCatalog.findMany({
          orderBy: {
            toolName: "asc",
          },
        }),
        prisma.toolRiskOverride.findMany(),
      ]);

    const overrideMap = new Map(
      overrides.map((o) => [
        o.toolName,
        o.riskLevel,
      ])
    );

    const tools = catalog.map((t) => {
      const override = overrideMap.get(
        t.toolName
      );
      return {
        ...t,
        finalRisk:
          override ?? t.finalRisk,
        overridden: override
          ? true
          : false,
      };
    });

    res.json(tools);
  }
);


toolRouter.post(
  "/tools/refresh",
  async (_req, res) => {
    await Promise.all(
      MCP_SERVERS.map((server) =>
        registry.refreshServer(server.id)
      )
    );

    await toolCatalogService.sync(
      registry.getTools()
    );

    return res.json({
      success: true,
      tools: registry.getTools().length,
    });
  }
);

toolRouter.patch(
  "/tools/:toolName/risk",
  async (req, res) => {
    try {
      const { toolName } = req.params;
      const { riskLevel } = req.body;

      if (
        ![
          "LOW",
          "MEDIUM",
          "HIGH",
          "CRITICAL",
        ].includes(riskLevel)
      ) {
        return res
          .status(400)
          .json({
            error: "Invalid riskLevel",
          });
      }

      const override =
        await prisma.toolRiskOverride.upsert(
          {
            where: { toolName },
            update: { riskLevel },
            create: {
              toolName,
              riskLevel,
            },
          }
        );

      return res.json(override);
    } catch (error) {
      return res
        .status(500)
        .json({
          error:
            error instanceof Error
              ? error.message
              : "Unknown error",
        });
    }
  }
);
