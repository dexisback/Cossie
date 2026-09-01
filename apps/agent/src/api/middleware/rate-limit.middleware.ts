import type { Request, Response, NextFunction } from "express";
import type { RateLimitResult } from "../../services/rate-limiter.service.js";
import { rateLimiter } from "../../services/rate-limiter.service.js";
import { costBudgetService } from "../../services/cost-budget.service.js";

/**
 * Extract identifier from request (session ID or IP address).
 * Prefer session cookie for authenticated users, fall back to IP for anonymous.
 */
function getIdentifier(req: Request): string {
  // Try to get session ID from cookie
  const sessionId = (req.cookies as Record<string, string> | undefined)?.sessionId ||
    req.get("x-session-id");

  if (sessionId) return sessionId;

  // Fall back to IP address (handle proxies)
  const ip =
    (req.get("x-forwarded-for")?.split(",")[0]?.trim()) ||
    req.socket.remoteAddress ||
    "unknown";

  return ip;
}

/**
 * Rate limit middleware factory.
 * Creates a middleware that enforces rate limits on a specific layer.
 *
 * @param layer The layer identifier ('pattern' or 'judge')
 * @param config Rate limit configuration { limit, windowSeconds }
 *
 * Example:
 *   router.post("/security/scan", rateLimitMiddleware("pattern", { limit: 20, windowSeconds: 60 }), handler);
 */
export function rateLimitMiddleware(
  layer: string,
  config: { limit: number; windowSeconds: number }
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = getIdentifier(req);

    const result = await rateLimiter.checkLimit(
      layer,
      identifier,
      config.limit,
      config.windowSeconds
    );

    // Always include rate limit headers (X-RateLimit-*)
    res.setHeader("X-RateLimit-Limit", config.limit);
    res.setHeader("X-RateLimit-Remaining", result.remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(Date.now() / 1000) + result.resetIn);

    if (result.quotaBudget) {
      res.setHeader("X-RateLimit-HourlyRemaining", result.quotaBudget.hourlyRemaining);
      res.setHeader("X-RateLimit-HourlyLimit", result.quotaBudget.hourlyLimit);
    }

    // If rate limited, return 429
    if (!result.allowed) {
      const retryAfter = result.resetIn;
      res.setHeader("Retry-After", retryAfter);

      res.status(429).json({
        error: "Rate limited",
        message:
          layer === "judge"
            ? `Too many security scans. Please wait ${retryAfter}s before trying again.`
            : `Too many requests. Please wait ${retryAfter}s before trying again.`,
        resetIn: retryAfter,
        remaining: result.remaining,
        rateLimit: {
          limit: config.limit,
          window: `${config.windowSeconds}s`,
        },
      });
      return;
    }

    // Attach rate limit info to request for logging/monitoring
    (req as any).rateLimit = result;

    next();
  };
}

/**
 * Budget check middleware for expensive operations.
 * Returns 429 if daily budget exhausted.
 */
export function budgetCheckMiddleware(layer: "judge" | "pattern") {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (layer !== "judge") {
      return next();
    }

    const budget = await costBudgetService.checkBudget(layer);

    // Attach budget info to response headers
    res.setHeader("X-Budget-Daily-Remaining", budget.dailyRemaining);
    res.setHeader("X-Budget-Daily-Limit", budget.dailyLimit);
    res.setHeader("X-Budget-Hourly-Remaining", budget.hourlyRemaining);
    res.setHeader("X-Budget-Hourly-Limit", budget.hourlyLimit);

    // If degraded (budget exhausted), return 429
    if (budget.degraded) {
      res.status(429).json({
        error: "Service temporarily unavailable",
        message:
          "Our security scanning service is temporarily at capacity. Please try again in a few moments.",
        reason: "cost_budget_exceeded",
        budget: {
          daily: {
            remaining: budget.dailyRemaining,
            limit: budget.dailyLimit,
          },
          hourly: {
            remaining: budget.hourlyRemaining,
            limit: budget.hourlyLimit,
          },
        },
        resetIn: 3600, // Suggest waiting 1 hour
      });
      return;
    }

    next();
  };
}
