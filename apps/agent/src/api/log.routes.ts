//dashboard logs endpoint 
import { Router } from "express";

import { prisma } from "@cossie/db";

export const logRouter =
  Router();

logRouter.get(
  "/logs",
  async (req, res) => {
    const approvalId = typeof req.query.approvalId === "string" ? req.query.approvalId : undefined;

    const logs = approvalId
      ? await prisma.toolExecutionLog.findMany({
          where: {
            trace: {
              path: ["approvalId"],
              string_contains: approvalId,
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      : await prisma.toolExecutionLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 100,
        });

    res.json(logs);
  }
);
