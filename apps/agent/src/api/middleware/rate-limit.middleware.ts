import type { Request, Response, NextFunction } from "express";
import type { RateLimitResult } from "../../services/rate-limiter.service.js";
import { rateLimiter } from "../../services/rate-limiter.service.js";

/**
 * Extract identifier from request (session ID or IP address).
 */
function getIdentifier(req: Request): string {
  const sessionId = (req.cookies as Record<string, string> | undefined)?.sessionId ||
    req.get("x-session-id");

  if (sessionId) return sessionId;

  const ip =
    (req.get("x-forwarded-for")?.split(",")[0]?.trim()) ||
    req.socket.remoteAddress ||
    "unknown";

  return ip;
}

/**
 * Rate limit middleware for portfolio protection.
 * Per-user: 15-20 requests per day
 * Global: 100 requests per day across all users
 */
export function rateLimitMiddleware(config: { dailyLimit: number }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = getIdentifier(req);

    // Check global daily cap first (faster)
    const globalCap = await rateLimiter.checkGlobalCap(100);
    if (!globalCap.allowed) {
      res.setHeader("X-RateLimit-Global-Remaining", globalCap.remaining);
      res.setHeader("X-RateLimit-Reset", Math.ceil(Date.now() / 1000) + globalCap.resetIn);

      res.status(429).json({
        error: "Service quota exhausted",
        message:
          "Daily quota has been reached. Service resets at midnight UTC. Please try again tomorrow.",
        resetIn: globalCap.resetIn,
        reason: "global_cap_exceeded",
      });
      return;
    }

    // Check per-user daily limit
    const userLimit = await rateLimiter.checkDailyLimit(identifier, config.dailyLimit);
    if (!userLimit.allowed) {
      res.setHeader("X-RateLimit-Remaining", "0");
      res.setHeader("X-RateLimit-Reset", Math.ceil(Date.now() / 1000) + userLimit.resetIn);

      res.status(429).json({
        error: "Rate limited",
        message: `You've reached your daily limit of ${config.dailyLimit} requests. Please try again tomorrow.`,
        resetIn: userLimit.resetIn,
        remaining: userLimit.remaining,
      });
      return;
    }

    // Set headers with remaining quota
    res.setHeader("X-RateLimit-Limit", config.dailyLimit);
    res.setHeader("X-RateLimit-Remaining", userLimit.remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(Date.now() / 1000) + userLimit.resetIn);
    res.setHeader("X-RateLimit-Global-Remaining", globalCap.remaining);

    (req as any).rateLimit = userLimit;

    next();
  };
}
