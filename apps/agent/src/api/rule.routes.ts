import { Router } from "express";

import { prisma } from "@cossie/db";

import { redisPublisher } from "../services/redis-publisher.service.js";

export const ruleRouter = Router();

ruleRouter.get(
  "/rules",
  async (_req, res) => {
    const rules =
      await prisma.rule.findMany({
        orderBy: {
          priority: "asc",
        },
      });

    res.json(rules);
  }
);

ruleRouter.post(
  "/rules",
  async (req, res) => {
    try {
      const rule =
        await prisma.rule.create({
          data: req.body,
        });

      await redisPublisher();

      return res
        .status(201)
        .json(rule);
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

ruleRouter.patch(
  "/rules/:id",
  async (req, res) => {
    try {
      const rule =
        await prisma.rule.update({
          where: {
            id: req.params.id,
          },

          data: req.body,
        });

      await redisPublisher();

      return res.json(rule);
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

ruleRouter.delete(
  "/rules/:id",
  async (req, res) => {
    try {
      await prisma.rule.delete({
        where: {
          id: req.params.id,
        },
      });

      await redisPublisher();

      return res
        .status(204)
        .send();
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


