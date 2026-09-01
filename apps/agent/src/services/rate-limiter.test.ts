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

  it("should allow request under daily limit", async () => {
    const redis = getRedis();
    vi.mocked(redis.incr).mockResolvedValue(5); // 5th request
    vi.mocked(redis.ttl).mockResolvedValue(82800); // ~23 hours left

    const result = await rateLimiter.checkDailyLimit("ip-1.2.3.4", 15);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(10);
    expect(result.resetIn).toBe(82800);
  });

  it("should deny request exceeding daily limit", async () => {
    const redis = getRedis();
    vi.mocked(redis.incr).mockResolvedValue(16); // 16th request, limit is 15
    vi.mocked(redis.ttl).mockResolvedValue(43200);

    const result = await rateLimiter.checkDailyLimit("ip-1.2.3.4", 15);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should allow request under global cap", async () => {
    const redis = getRedis();
    vi.mocked(redis.incr).mockResolvedValue(50); // 50 total requests
    vi.mocked(redis.ttl).mockResolvedValue(43200);

    const result = await rateLimiter.checkGlobalCap(100);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(50);
  });

  it("should deny request exceeding global cap", async () => {
    const redis = getRedis();
    vi.mocked(redis.incr).mockResolvedValue(101); // 101 total, cap is 100
    vi.mocked(redis.ttl).mockResolvedValue(43200);

    const result = await rateLimiter.checkGlobalCap(100);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should handle Redis failure gracefully (fail open)", async () => {
    const redis = getRedis();
    vi.mocked(redis.incr).mockRejectedValue(new Error("Redis connection failed"));

    const result = await rateLimiter.checkDailyLimit("ip-1.2.3.4", 15);

    // Fail open: allow request
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(15);
  });

  it("should reject empty identifier", async () => {
    const result = await rateLimiter.checkDailyLimit("", 15);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
