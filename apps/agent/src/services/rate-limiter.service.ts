import { getRedis } from "../lib/redis.js";

export interface RateLimitConfig {
  /** Layer identifier: 'pattern' or 'judge' */
  layer: string;
  /** Maximum requests per window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number; // seconds until quota resets
  quotaBudget?: {
    hourlyRemaining: number;
    hourlyLimit: number;
  };
}

/**
 * Rate limiter with per-IP and per-session tracking.
 * Tracks both requests-per-minute and requests-per-hour separately.
 */
export class RateLimiter {
  private readonly redis = getRedis();

  /**
   * Check and enforce rate limit for a given layer and identifier.
   * Falls back to IP if no session ID provided.
   * @param layer The layer identifier ('pattern' or 'judge')
   * @param identifier Session ID or IP address
   * @param limit Requests allowed per window
   * @param windowSeconds Window duration in seconds
   * @returns Rate limit result with remaining quota
   */
  async checkLimit(
    layer: string,
    identifier: string,
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    if (!identifier || identifier.trim() === "") {
      return { allowed: false, remaining: 0, resetIn: 0 };
    }

    const key = `rl:${layer}:${identifier}`;
    const hourlyKey = `rl_hourly:${layer}:${identifier}`;

    try {
      // Check minute-level rate limit
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, windowSeconds);
      }

      const ttl = await this.redis.ttl(key);
      const resetIn = ttl > 0 ? ttl : windowSeconds;

      const allowed = count <= limit;

      // Track hourly budget separately (for cost budgeting)
      let hourlyRemaining = limit * 60; // default: 60 min windows in an hour
      let hourlyLimit = limit * 60;

      if (layer === "judge") {
        // Judge calls are expensive; track daily budget too
        const hourlyCount = await this.redis.incr(hourlyKey);
        if (hourlyCount === 1) {
          await this.redis.expire(hourlyKey, 3600); // 1 hour
        }

        // Judge: 2 per minute = max 120 per hour (conservative)
        hourlyLimit = 120;
        hourlyRemaining = Math.max(0, hourlyLimit - hourlyCount);
      }

      return {
        allowed,
        remaining: Math.max(0, limit - count),
        resetIn,
        quotaBudget: {
          hourlyRemaining,
          hourlyLimit,
        },
      };
    } catch (error) {
      console.warn("[rate-limiter] Redis check failed, allowing request:", error);
      // Fail open: if Redis is down, allow the request (degraded mode)
      return {
        allowed: true,
        remaining: limit,
        resetIn: windowSeconds,
      };
    }
  }

  /**
   * Get current quota status without incrementing counter.
   */
  async getQuotaStatus(
    layer: string,
    identifier: string,
    limit: number
  ): Promise<RateLimitResult> {
    const key = `rl:${layer}:${identifier}`;
    const hourlyKey = `rl_hourly:${layer}:${identifier}`;

    try {
      const count = (await this.redis.get(key)) || "0";
      const hourlyCount = (await this.redis.get(hourlyKey)) || "0";
      const ttl = await this.redis.ttl(key);

      return {
        allowed: true,
        remaining: Math.max(0, limit - parseInt(count, 10)),
        resetIn: Math.max(0, ttl),
        quotaBudget:
          layer === "judge"
            ? {
                hourlyRemaining: Math.max(0, 120 - parseInt(hourlyCount, 10)),
                hourlyLimit: 120,
              }
            : undefined,
      };
    } catch {
      return {
        allowed: true,
        remaining: limit,
        resetIn: 0,
      };
    }
  }

  /**
   * Reset rate limit for a given identifier (admin use).
   */
  async reset(layer: string, identifier: string): Promise<void> {
    const key = `rl:${layer}:${identifier}`;
    const hourlyKey = `rl_hourly:${layer}:${identifier}`;
    await Promise.all([this.redis.del(key), this.redis.del(hourlyKey)]);
  }
}

export const rateLimiter = new RateLimiter();
