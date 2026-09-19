import type {
  ApprovalRule,
  PolicyRequest,
} from "@cossie/shared-types";

function toolNameMatches(ruleToolName: string, requestedToolName: string): boolean {
  if (ruleToolName === requestedToolName) return true;
  const rawRule = ruleToolName.includes(":") ? ruleToolName.split(":")[1]! : ruleToolName;
  const rawRequested = requestedToolName.includes(":") ? requestedToolName.split(":")[1]! : requestedToolName;
  return rawRule === rawRequested;
}

export function matchesApprovalRule(
  rule: ApprovalRule,
  request: PolicyRequest
) {
  return rule.toolNames.some((name) => toolNameMatches(name, request.toolName));
}
