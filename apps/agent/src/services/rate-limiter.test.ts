import { describe, it, expect, beforeEach, vi } from "vitest";
import { rateLimiter } from "./rate-limiter.service.js";
import { getRedis } from "../lib/redis.js";

// Mock Redis
vi.mock("../lib/redis.js", () => {
  const mockRedis = {
    incr: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  };
  return {
    getRedis: () => mockRedis,
  };
});

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow request under limit", async () => {
    const redis = getRedis();
    vi.mocked(redis.incr).mockResolvedValue(5); // 5th request
    vi.mocked(redis.ttl).mockResolvedValue(55); // 55 seconds left

    const result = await rateLimiter.checkLimit("pattern", "ip-1.2.3.4", 20, 60);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(15);
    expect(result.resetIn).toBe(55);
  });

  it("should deny request exceeding limit", async () => {
    const redis = getRedis();
    vi.mocked(redis.incr).mockResolvedValue(21); // 21st request, limit is 20
    vi.mocked(redis.ttl).mockResolvedValue(30);

    const result = await rateLimiter.checkLimit("pattern", "ip-1.2.3.4", 20, 60);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should track hourly budget for judge layer", async () => {
    const redis = getRedis();
    vi.mocked(redis.incr).mockResolvedValue(1);
    vi.mocked(redis.ttl).mockResolvedValue(60);

    const result = await rateLimiter.checkLimit("judge", "ip-1.2.3.4", 2, 60);

    expect(result.quotaBudget).toBeDefined();
    expect(result.quotaBudget?.hourlyLimit).toBe(120);
    expect(result.allowed).toBe(true);
  });

  it("should handle Redis failure gracefully (fail open)", async () => {
    const redis = getRedis();
    vi.mocked(redis.incr).mockRejectedValue(new Error("Redis connection failed"));

    const result = await rateLimiter.checkLimit("pattern", "ip-1.2.3.4", 20, 60);

    // Fail open: allow request
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(20);
  });

  it("should reject empty identifier", async () => {
    const result = await rateLimiter.checkLimit("pattern", "", 20, 60);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
