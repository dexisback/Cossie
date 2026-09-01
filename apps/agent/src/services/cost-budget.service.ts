import { getRedis } from "../lib/redis.js";

/**
 * Cost budgeting for expensive API calls (Gemini LLM judge).
 * Tracks spending across different operations and enforces soft/hard limits.
 *
 * This is a **local tracking system** that works as a safety net.
 * Real budget enforcement happens via Google Cloud billing alerts.
 */
export interface CostBudgetStatus {
  dailyRemaining: number;
  dailyLimit: number;
  hourlyRemaining: number;
  hourlyLimit: number;
  estimatedCost: number; // in USD cents
  degraded: boolean; // true if budget exceeded, triggers fallback
}

export class CostBudgetService {
  private readonly redis = getRedis();

  /**
   * Cost per operation (in USD cents, rough estimates):
   * - Gemini 1.5 Flash: ~$0.00001 per prompt, ~$0.00003 per output token
   * - Average judge call: ~500 tokens (prompt) + 100 tokens (response) = ~$0.000014 ≈ 0.0014 cents
   * We'll round to 1 cent per judge call for conservative tracking.
   */
  private readonly COST_PER_JUDGE_CALL_CENTS = 1;

  /**
   * Check if we have budget for a judge call.
   * Daily: $5 limit = 500 judge calls
   * Hourly: 100 judge calls (safety margin)
   */
  async checkBudget(layer: "judge" | "pattern"): Promise<CostBudgetStatus> {
    if (layer !== "judge") {
      return {
        dailyRemaining: 999999,
        dailyLimit: 999999,
        hourlyRemaining: 999999,
        hourlyLimit: 999999,
        estimatedCost: 0,
        degraded: false,
      };
    }

    const dailyKey = "cost:judge:daily";
    const hourlyKey = "cost:judge:hourly";

    try {
      const dailyCount = parseInt((await this.redis.get(dailyKey)) || "0", 10);
      const hourlyCount = parseInt((await this.redis.get(hourlyKey)) || "0", 10);

      const dailyLimit = 500; // $5/day
      const hourlyLimit = 100;

      const dailyRemaining = Math.max(0, dailyLimit - dailyCount);
      const hourlyRemaining = Math.max(0, hourlyLimit - hourlyCount);
      const estimatedCost = (dailyCount + hourlyCount) * this.COST_PER_JUDGE_CALL_CENTS;

      // Degraded if either limit exceeded
      const degraded = dailyRemaining === 0 || hourlyRemaining === 0;

      return {
        dailyRemaining,
        dailyLimit,
        hourlyRemaining,
        hourlyLimit,
        estimatedCost,
        degraded,
      };
    } catch (error) {
      console.warn("[cost-budget] Redis check failed, assuming budget available:", error);
      // Fail open: allow call but log it
      return {
        dailyRemaining: 999,
        dailyLimit: 500,
        hourlyRemaining: 99,
        hourlyLimit: 100,
        estimatedCost: 0,
        degraded: false,
      };
    }
  }

  /**
   * Record a judge call. Called after successful LLM invocation.
   */
  async recordJudgeCall(): Promise<void> {
    const dailyKey = "cost:judge:daily";
    const hourlyKey = "cost:judge:hourly";

    try {
      // Increment daily counter
      const dailyCount = await this.redis.incr(dailyKey);
      if (dailyCount === 1) {
        // Set expiry at midnight (approximate: 24h)
        await this.redis.expire(dailyKey, 86400);
      }

      // Increment hourly counter
      const hourlyCount = await this.redis.incr(hourlyKey);
      if (hourlyCount === 1) {
        await this.redis.expire(hourlyKey, 3600);
      }

      if (dailyCount > 500) {
        console.warn(
          "[cost-budget] Daily judge budget exhausted. Falling back to conservative mode.",
          {
            dailyCount,
            hourlyCount,
          }
        );
      }
    } catch (error) {
      console.warn("[cost-budget] Failed to record judge call:", error);
    }
  }

  /**
   * Reset daily budget (admin use, e.g., manual budget reset).
   */
  async resetDaily(): Promise<void> {
    await this.redis.del("cost:judge:daily");
  }

  /**
   * Get human-readable status message.
   */
  formatStatus(status: CostBudgetStatus): string {
    if (status.degraded) {
      return `Budget limit reached (${status.dailyRemaining} daily remaining)`;
    }
    const dailyPct = Math.round(
      ((status.dailyLimit - status.dailyRemaining) / status.dailyLimit) * 100
    );
    return `${dailyPct}% of daily budget used (${status.dailyRemaining} calls remaining)`;
  }
}

export const costBudgetService = new CostBudgetService();
