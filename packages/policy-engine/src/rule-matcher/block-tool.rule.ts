import type { BlockToolRule, PolicyRequest } from '@cossie/shared-types';

export function matchesBlockToolRule(
  rule: BlockToolRule,
  request: PolicyRequest
) {
  return rule.toolNames.includes(request.toolName);
}



//this checks does toolName even match the blocked tool
//returns true/false
