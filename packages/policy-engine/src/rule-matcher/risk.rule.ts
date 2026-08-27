import type {
  RiskBasedRule,
  RiskLevel,
} from "@cossie/shared-types";

export function matchesRiskRule(
  rule: RiskBasedRule,
  riskLevel?: RiskLevel
): boolean {
  if (!riskLevel) {
    return false;
  }

  return rule.riskLevel === riskLevel;
}


//checks does the tool risk level match teh rule risk level
//so like for a successful (true) we need HIGH==HIGH





