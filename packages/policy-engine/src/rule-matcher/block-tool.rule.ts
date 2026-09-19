import type { BlockToolRule, PolicyRequest } from '@cossie/shared-types';

function toolNameMatches(ruleToolName: string, requestedToolName: string): boolean {
  if (ruleToolName === requestedToolName) return true;
  const rawRule = ruleToolName.includes(":") ? ruleToolName.split(":")[1]! : ruleToolName;
  const rawRequested = requestedToolName.includes(":") ? requestedToolName.split(":")[1]! : requestedToolName;
  return rawRule === rawRequested;
}

export function matchesBlockToolRule(
  rule: BlockToolRule,
  request: PolicyRequest
) {
  return rule.toolNames.some((name) => toolNameMatches(name, request.toolName));
}
