import { prisma } from "@cossie/db";
import { RuleSchema, type Rule } from "@cossie/shared-types";
import { ruleCache } from "./rule-cache.service.js";

export async function loadRules() {
  const dbRules = await prisma.rule.findMany({
    where: {
      enabled: true,
    },
    orderBy: {
      priority: "asc",
    },
  });

  const rules = dbRules
    .map(rule => {
      const parsed = RuleSchema.safeParse({
        ...(rule.config as any),
        name: rule.name,
        description: rule.description ?? undefined,
      });
      if (!parsed.success) {
        console.error(`[Rule Loader] Failed to parse rule "${rule.name}":`, parsed.error.format());
        return null;
      }
      return parsed.data;
    })
    .filter((r): r is Rule => r !== null);

  ruleCache.setRules(rules);
  console.log(`Loaded ${rules.length} active rule(s) into policy engine cache.`);
}
