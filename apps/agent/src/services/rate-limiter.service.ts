import { getRedis } from "../lib/redis.js";

export interface RateLimitConfig {
  /** Maximum requests per day per user */
  dailyLimit: number;
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
   * Check per-user daily quota. Each user gets 15-20 requests per day.
   * @param identifier Session ID or IP address
   * @param dailyLimit Daily quota per user (typically 15-20)
   * @returns Rate limit result
   */
  async checkDailyLimit(
    identifier: string,
    dailyLimit: number
  ): Promise<RateLimitResult> {
    if (!identifier || identifier.trim() === "") {
      return { allowed: false, remaining: 0, resetIn: 0 };
    }

    const key = `rl_daily:${identifier}`;

    try {
      const count = await this.redis.incr(key);
      if (count === 1) {
        // Set expiry to midnight UTC (86400 seconds = 24h)
        await this.redis.expire(key, 86400);
      }

      const ttl = await this.redis.ttl(key);
      const resetIn = ttl > 0 ? ttl : 86400;
      const allowed = count <= dailyLimit;

      return {
        allowed,
        remaining: Math.max(0, dailyLimit - count),
        resetIn,
      };
    } catch (error) {
      console.warn("[rate-limiter] Redis check failed, allowing request:", error);
      return {
        allowed: true,
        remaining: dailyLimit,
        resetIn: 86400,
      };
    }
  }

  /**
   * Check global daily cap (all requests from all users combined).
   * Once we hit 100 requests total per day, deny all others.
   * @param globalLimit Total requests allowed per day across all users
   */
  async checkGlobalCap(globalLimit: number): Promise<RateLimitResult> {
    const key = "rl_global_daily";

    try {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, 86400);
      }

      const ttl = await this.redis.ttl(key);
      const resetIn = ttl > 0 ? ttl : 86400;
      const allowed = count <= globalLimit;

      return {
        allowed,
        remaining: Math.max(0, globalLimit - count),
        resetIn,
      };
    } catch (error) {
      console.warn("[rate-limiter] Global cap check failed, allowing request:", error);
      return {
        allowed: true,
        remaining: globalLimit,
        resetIn: 86400,
      };
    }
  }

  /**
   * Get current quota status without incrementing.
   */
  async getQuotaStatus(
    identifier: string,
    dailyLimit: number
  ): Promise<RateLimitResult> {
    const key = `rl_daily:${identifier}`;

    try {
      const count = (await this.redis.get(key)) || "0";
      const ttl = await this.redis.ttl(key);

      return {
        allowed: true,
        remaining: Math.max(0, dailyLimit - parseInt(count, 10)),
        resetIn: Math.max(0, ttl),
      };
    } catch {
      return {
        allowed: true,
        remaining: dailyLimit,
        resetIn: 0,
      };
    }
  }

  /**
   * Reset daily quota for a user (admin use).
   */
  async reset(identifier: string): Promise<void> {
    const key = `rl_daily:${identifier}`;
    await this.redis.del(key);
  }

  /**
   * Get global daily request count.
   */
  async getGlobalCount(): Promise<number> {
    const key = "rl_global_daily";
    const count = await this.redis.get(key);
    return parseInt(count || "0", 10);
  }

  /**
   * Reset global daily cap (admin use).
   */
  async resetGlobal(): Promise<void> {
    await this.redis.del("rl_global_daily");
  }
}

export const rateLimiter = new RateLimiter();
