//allows admin to override inferred mcp tool risk (from dashboard)

//example: if restart_server uses inferred: HIGH. and if we use override: CRITICAL. then the risk will become CRITICAL instead of HIGH

import { Router } from "express";

import { prisma } from "@cossie/db";

export const riskRouter = Router();

riskRouter.get(
  "/tools/:toolName/risk",
  async (req, res) => {
    const override =
      await prisma.toolRiskOverride.findUnique({
        where: {
          toolName:
            req.params.toolName,
        },
      });

    return res.json(
      override
    );
  }
);

riskRouter.patch(
  "/tools/:toolName/risk",
  async (req, res) => {
    const { riskLevel } =
      req.body;

    const override =
      await prisma.toolRiskOverride.upsert({
        where: {
          toolName:
            req.params.toolName,
        },

        create: {
          toolName:
            req.params.toolName,

          riskLevel,
        },

        update: {
          riskLevel,
        },
      });

    return res.json(
      override
    );
  }
);