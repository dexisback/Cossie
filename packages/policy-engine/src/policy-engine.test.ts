import { describe, it, expect } from "vitest";
import { PolicyEngine } from "./engine.js";
import type { Rule, PolicyRequest } from "@cossie/shared-types";

const engine = new PolicyEngine();

const baseRequest: PolicyRequest = {
  conversationId: "test-conv",
  toolName: "list_servers",
  args: {},
};

describe("PolicyEngine", () => {
  it("returns ALLOW when no rules are configured", async () => {
    const decision = await engine.evaluate(baseRequest, []);
    expect(decision.decision).toBe("ALLOW");
    expect(decision.reason).toBe("No policy violations detected");
  });

  it("returns DENY when a BLOCK_TOOL rule matches the tool name", async () => {
    const rules: Rule[] = [
      {
        type: "BLOCK_TOOL",
        toolNames: ["delete_server", "shutdown"],
        name: "block-destructive",
      },
    ];
    const decision = await engine.evaluate(
      { ...baseRequest, toolName: "delete_server" },
      rules
    );
    expect(decision.decision).toBe("DENY");
    expect(decision.matchedRule).toBe("block-destructive");
    expect(decision.reason).toContain("blocked");
  });

  it("returns ALLOW when a BLOCK_TOOL rule does not match the tool name", async () => {
    const rules: Rule[] = [
      {
        type: "BLOCK_TOOL",
        toolNames: ["delete_server"],
        name: "block-destructive",
      },
    ];
    const decision = await engine.evaluate(baseRequest, rules);
    expect(decision.decision).toBe("ALLOW");
  });

  it("returns REQUIRE_APPROVAL when an APPROVAL rule matches", async () => {
    const rules: Rule[] = [
      {
        type: "REQUIRE_APPROVAL",
        toolNames: ["restart_server", "deploy_release"],
        name: "require-approval-for-deploy",
      },
    ];
    const decision = await engine.evaluate(
      { ...baseRequest, toolName: "deploy_release" },
      rules
    );
    expect(decision.decision).toBe("REQUIRE_APPROVAL");
    expect(decision.matchedRule).toBe("require-approval-for-deploy");
  });

  it("returns REQUIRE_APPROVAL from a RISK_BASED rule when riskLevel matches", async () => {
    const rules: Rule[] = [
      {
        type: "RISK_BASED",
        riskLevel: "HIGH",
        name: "high-risk-approval",
      },
    ];
    const decision = await engine.evaluate(
      { ...baseRequest, toolName: "deploy_release" },
      rules,
      { riskLevel: "HIGH" }
    );
    expect(decision.decision).toBe("REQUIRE_APPROVAL");
  });

  it("does not match RISK_BASED when riskLevel is undefined", async () => {
    const rules: Rule[] = [
      { type: "RISK_BASED", riskLevel: "HIGH", name: "r" },
    ];
    const decision = await engine.evaluate(baseRequest, rules);
    expect(decision.decision).toBe("ALLOW");
  });

  it("returns BUDGET_EXCEEDED when current tokens meet or exceed maxTokens", async () => {
    const rules: Rule[] = [
      { type: "BUDGET_LIMIT", maxTokens: 100, name: "budget-cap" },
    ];
    const decision = await engine.evaluate(
      baseRequest,
      rules,
      { currentTokens: 150 }
    );
    expect(decision.decision).toBe("BUDGET_EXCEEDED");
    expect(decision.matchedRule).toBe("budget-cap");
  });

  it("returns ALLOW when current tokens are below maxTokens", async () => {
    const rules: Rule[] = [
      { type: "BUDGET_LIMIT", maxTokens: 100, name: "budget-cap" },
    ];
    const decision = await engine.evaluate(
      baseRequest,
      rules,
      { currentTokens: 50 }
    );
    expect(decision.decision).toBe("ALLOW");
  });

  it("returns VALIDATION_FAILED when input does not match the allowed prefix", async () => {
    const rules: Rule[] = [
      {
        type: "INPUT_VALIDATION",
        toolName: "read_file",
        allowedPrefix: "/safe/",
        name: "path-guard",
      },
    ];
    const decision = await engine.evaluate(
      { ...baseRequest, toolName: "read_file", args: { path: "/etc/passwd" } },
      rules
    );
    expect(decision.decision).toBe("VALIDATION_FAILED");
  });

  it("returns ALLOW when input matches the allowed prefix", async () => {
    const rules: Rule[] = [
      {
        type: "INPUT_VALIDATION",
        toolName: "read_file",
        allowedPrefix: "/safe/",
        name: "path-guard",
      },
    ];
    const decision = await engine.evaluate(
      { ...baseRequest, toolName: "read_file", args: { path: "/safe/file.txt" } },
      rules
    );
    expect(decision.decision).toBe("ALLOW");
  });

  it("evaluates rules in array order: the first matching rule wins", async () => {
    // The engine iterates rules in array order and returns on the first match.
    // If a BLOCK_TOOL rule is listed before a REQUIRE_APPROVAL rule, it wins.
    const rules: Rule[] = [
      {
        type: "BLOCK_TOOL",
        toolNames: ["restart_server"],
        name: "block-rule",
      },
      {
        type: "REQUIRE_APPROVAL",
        toolNames: ["restart_server"],
        name: "approval-rule",
      },
    ];
    const decision = await engine.evaluate(
      { ...baseRequest, toolName: "restart_server" },
      rules
    );
    expect(decision.decision).toBe("DENY");
    expect(decision.matchedRule).toBe("block-rule");
  });

  it("stops at the first matching rule and does not evaluate later rules", async () => {
    const rules: Rule[] = [
      {
        type: "BLOCK_TOOL",
        toolNames: ["delete_server"],
        name: "first-match",
      },
      {
        type: "BLOCK_TOOL",
        toolNames: ["delete_server"],
        name: "second-match",
      },
    ];
    const decision = await engine.evaluate(
      { ...baseRequest, toolName: "delete_server" },
      rules
    );
    expect(decision.matchedRule).toBe("first-match");
  });

  it("records a trace step for every evaluated rule", async () => {
    const rules: Rule[] = [
      { type: "BLOCK_TOOL", toolNames: ["x"], name: "a" },
      { type: "BLOCK_TOOL", toolNames: ["y"], name: "b" },
    ];
    const decision = await engine.evaluate(baseRequest, rules);
    expect(decision.trace).toBeDefined();
    expect(decision.trace!.length).toBe(2);
    expect(decision.trace![0].rule).toBe("BLOCK_TOOL");
    expect(decision.trace![0].matched).toBe(false);
  });
});
