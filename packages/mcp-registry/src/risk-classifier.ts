//this smartly (and auto) recognises the risk level based on the name of the tool
import type {
  RiskLevel,
} from "@cossie/shared-types";

export function inferRisk(
  toolName: string,
  description: string
): RiskLevel {
  const text =
    `${toolName} ${description}`
      .toLowerCase();

  if (
    /(delete|destroy|terminate|shutdown|rollback)/.test(
      text
    )
  ) {
    return "CRITICAL";
  }

  if (
    /(restart|deploy|write|update|modify|create)/.test(
      text
    )
  ) {
    return "HIGH";
  }

  if (
    /(read|get|search|list|find|resolve)/.test(
      text
    )
  ) {
    return "LOW";
  }

  return "MEDIUM";
}