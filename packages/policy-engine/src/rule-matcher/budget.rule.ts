import type { BudgetRule } from "@cossie/shared-types";

export function exceedsBudget(
  rule: BudgetRule,
  currentTokens: number
) {
  return currentTokens >= rule.maxTokens;
}

//similarly, checks that while the tool is being used, has the budget expired. returns true or false 


