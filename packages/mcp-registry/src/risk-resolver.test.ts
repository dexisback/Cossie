import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUniqueMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
}));

vi.mock("@cossie/db", () => ({
  prisma: {
    toolRiskOverride: {
      findUnique: findUniqueMock,
    },
  },
}));

import { resolveRisk } from "./risk-resolver.js";

beforeEach(() => {
  findUniqueMock.mockReset();
});

describe("resolveRisk", () => {
  it("returns the inferred risk when no override exists", async () => {
    findUniqueMock.mockResolvedValue(null);

    const result = await resolveRisk("list_servers", "LOW");

    expect(result).toEqual({
      toolName: "list_servers",
      inferredRisk: "LOW",
      finalRisk: "LOW",
      overridden: false,
    });
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { toolName: "list_servers" },
    });
  });

  it("applies an override when one exists in the database", async () => {
    findUniqueMock.mockResolvedValue({
      toolName: "list_servers",
      riskLevel: "CRITICAL",
    });

    const result = await resolveRisk("list_servers", "LOW");

    expect(result.inferredRisk).toBe("LOW");
    expect(result.finalRisk).toBe("CRITICAL");
    expect(result.overridden).toBe(true);
  });

  it("uses the override risk level regardless of the inferred value", async () => {
    findUniqueMock.mockResolvedValue({
      toolName: "deploy_release",
      riskLevel: "MEDIUM",
    });

    const result = await resolveRisk("deploy_release", "CRITICAL");

    expect(result.inferredRisk).toBe("CRITICAL");
    expect(result.finalRisk).toBe("MEDIUM");
    expect(result.overridden).toBe(true);
  });
});
