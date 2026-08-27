import type { Rule } from "@cossie/shared-types";

export class RuleCacheService {
  private rules: Rule[] = [];

  getRules() {
    return this.rules;
  }

  setRules(rules: Rule[]) {
    this.rules = rules;
  }

  clear() {
    this.rules = [];
  }
}

export const ruleCache =
  new RuleCacheService();