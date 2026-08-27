import { registry } from "@cossie/mcp-registry";
import { prisma } from "@cossie/db";
import { Router } from "express";
import { MODELS, DEFAULT_PROVIDER, FALLBACK_PROVIDER } from "../lib/models.js";
import { MCP_SERVERS } from "../config/mcp-servers.js";
import { getRedis } from "../lib/redis.js";

export const healthRouter = Router();

healthRouter.get(
  "/health",
  async (_req, res) => {
    let database = "healthy";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "unhealthy";
    }

    let redis = "healthy";
    try {
      const pong = await getRedis().ping();
      if (pong !== "PONG") redis = "unhealthy";
    } catch {
      redis = "unhealthy";
    }

    return res.json({
      status: "ok",
      uptime: process.uptime(),
      database,
      redis,
      servers: registry.getServers().length,
      tools: registry.getTools().length,
      models: {
        gemini: MODELS.GEMINI,
        groq: MODELS.GROQ,
      },
      providers: {
        default: DEFAULT_PROVIDER,
        fallback: FALLBACK_PROVIDER,
      },
      serversList: MCP_SERVERS,
    });
  }
);