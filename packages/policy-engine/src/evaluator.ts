//this file converts the result/evaluation returned by the rule-matcher into actual decisions, and also builds trace (for logs) while at it




import type {
  ApprovalRule,
  BlockToolRule,
  BudgetRule,
  InputValidationRule,
  PolicyDecision,
  PolicyRequest,
  PolicyTraceStep,
  RiskBasedRule,
} from "@cossie/shared-types";

import { PolicyDecisionTypeSchema } from "@cossie/shared-types";

import { matchesApprovalRule } from "./rule-matcher/approval.rule.js";
import { matchesBlockToolRule } from "./rule-matcher/block-tool.rule.js";
import { exceedsBudget } from "./rule-matcher/budget.rule.js";
import { matchesInputValidationRule } from "./rule-matcher/input-validation.rule.js";
import { matchesRiskRule } from "./rule-matcher/risk.rule.js";

export function evaluateBlockRule(
  rule: BlockToolRule,
  request: PolicyRequest,
  trace: PolicyTraceStep[]
): PolicyDecision | null {
  const matched = matchesBlockToolRule(rule, request);

  trace.push({
    rule: "BLOCK_TOOL",
    matched,
    message: matched
      ? `Blocked ${request.toolName}`
      : "Rule not matched",
  });

  if (!matched) return null;

  return {
    decision: PolicyDecisionTypeSchema.enum.DENY,
    matchedRule: rule.name,
    reason: `Tool ${request.toolName} is blocked`,
    trace,
  };
}

export function evaluateApprovalRule(
  rule: ApprovalRule,
  request: PolicyRequest,
  trace: PolicyTraceStep[]
): PolicyDecision | null {
  const matched = matchesApprovalRule(rule, request);

  trace.push({
    rule: "REQUIRE_APPROVAL",
    matched,
    message: matched
      ? "Approval required"
      : "Rule not matched",
  });

  if (!matched) return null;

  return {
    decision:
      PolicyDecisionTypeSchema.enum.REQUIRE_APPROVAL,
    reason: "Approval required",
    matchedRule: rule.name,
    trace,
  };
}

export function evaluateValidationRule(
  rule: InputValidationRule,
  request: PolicyRequest,
  trace: PolicyTraceStep[]
): PolicyDecision | null {
  const valid = matchesInputValidationRule(
    rule,
    request
  );
  trace.push({
    rule: "INPUT_VALIDATION",
    matched: !valid,
    message: valid
      ? "Validation passed"
      : "Validation failed",
  });

  if (valid) return null;

  return {
    decision:
      PolicyDecisionTypeSchema.enum.VALIDATION_FAILED,
    reason: "Input validation failed",
    matchedRule: rule.name,
    trace,
  };
}

export function evaluateBudgetRule(
  rule: BudgetRule,
  currentTokens: number,
  trace: PolicyTraceStep[]
): PolicyDecision | null {
  const exceeded = exceedsBudget(
    rule,
    currentTokens
  );

  trace.push({
    rule: "BUDGET_LIMIT",
    matched: exceeded,
    message: exceeded
      ? "Budget exceeded"
      : "Budget ok",
  });

  if (!exceeded) return null;

  return {
    decision:
      PolicyDecisionTypeSchema.enum.BUDGET_EXCEEDED,
    reason: "Budget exceeded",
    matchedRule: rule.name,
    trace,
  };
}

export function evaluateRiskRule(
  rule: RiskBasedRule,
  riskLevel: string | undefined,
  trace: PolicyTraceStep[]
): PolicyDecision | null {
  const matched = matchesRiskRule(
    rule,
    riskLevel as never
  );

  trace.push({
    rule: "RISK_BASED",
    matched,
    message: matched
      ? "Risk rule matched"
      : "Risk rule not matched",
  });

  if (!matched) return null;

  return {
    decision:
      PolicyDecisionTypeSchema.enum.REQUIRE_APPROVAL,
    reason:
      "High risk action requires approval",
    matchedRule: rule.name,
    trace,
  };
}