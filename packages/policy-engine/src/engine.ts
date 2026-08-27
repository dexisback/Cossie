import type {
  PolicyDecision,
  PolicyRequest,
  PolicyTraceStep,
  RiskLevel,
  Rule,
} from "@cossie/shared-types";

import {
  PolicyDecisionTypeSchema,
  RuleTypeSchema,
} from "@cossie/shared-types";

import {
  evaluateApprovalRule,
  evaluateBlockRule,
  evaluateBudgetRule,
  evaluateRiskRule,
  evaluateValidationRule,
} from "./evaluator.js";

export class PolicyEngine {
  async evaluate(
    request: PolicyRequest,
    rules: Rule[],
    options?: {
      currentTokens?: number;
      riskLevel?: RiskLevel;
    }
  ): Promise<PolicyDecision> {
    const trace: PolicyTraceStep[] = [];

    const currentTokens =
      options?.currentTokens ?? 0;

    const riskLevel =
      options?.riskLevel;

    for (const rule of rules) {
      switch (rule.type) {
        case RuleTypeSchema.enum.BLOCK_TOOL: {
          const result =
            evaluateBlockRule(
              rule,
              request,
              trace
            );

          if (result) return result;

          break;
        }

        case RuleTypeSchema.enum.INPUT_VALIDATION: {
          const result =
            evaluateValidationRule(
              rule,
              request,
              trace
            );

          if (result) return result;

          break;
        }

        case RuleTypeSchema.enum.BUDGET_LIMIT: {
          const result =
            evaluateBudgetRule(
              rule,
              currentTokens,
              trace
            );

          if (result) return result;

          break;
        }

        case RuleTypeSchema.enum.RISK_BASED: {
          const result =
            evaluateRiskRule(
              rule,
              riskLevel,
              trace
            );

          if (result) return result;

          break;
        }

        case RuleTypeSchema.enum.REQUIRE_APPROVAL: {
          const result =
            evaluateApprovalRule(
              rule,
              request,
              trace
            );

          if (result) return result;

          break;
        }
      }
    }

    return {
      decision:
        PolicyDecisionTypeSchema.enum.ALLOW,
      reason:
        "No policy violations detected",
      trace,
    };
  }
}

export const policyEngine =
  new PolicyEngine();



  //policy engine is now stateless - earlier you'd haveto call 
  //new PolicyEngine(rules)
  //now none of that sh
  //policyEngine.evaluate(request, rules, optional)
  //rules automatically keep on coming from ruleCache.getRules()
  