import type {
  RiskBasedRule,
  RiskLevel,
} from "@cossie/shared-types";

const RISK_HIERARCHY: Record<RiskLevel, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export function matchesRiskRule(
  rule: RiskBasedRule,
  riskLevel?: RiskLevel
): boolean {
  if (!riskLevel) {
    return false;
  }

  const targetRisk = rule.minimumRisk || rule.riskLevel;
  if (!targetRisk) {
    return false;
  }

  const toolLevelScore = RISK_HIERARCHY[riskLevel] ?? 0;
  const targetLevelScore = RISK_HIERARCHY[targetRisk] ?? 0;

  // Matches if the tool's risk level meets or exceeds the rule's minimum risk
  return toolLevelScore >= targetLevelScore;
}
