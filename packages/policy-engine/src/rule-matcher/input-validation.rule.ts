import type {
  InputValidationRule,
  PolicyRequest,
} from "@cossie/shared-types";

export function matchesInputValidationRule(
  rule: InputValidationRule,
  request: PolicyRequest
): boolean {
  if (rule.toolName !== request.toolName) {
    return true;
  }

  const path = request.args.path;

  if (typeof path !== "string") {
    return false;
  }

  return path.startsWith(
    rule.allowedPrefix
  );
}