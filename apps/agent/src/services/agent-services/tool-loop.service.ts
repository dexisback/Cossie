//core agent file


//NOTE: we LOG the sus prompts, NOT block them. WHY? because some people MIGHT be using some words for real and not exploiting need not be blocked. Logging works as a warning. //TODO: add a UI popup/advisory of avoiding user not to use certain words or get banned with multiple attempts
import { logService }
from "../log.service.js";
import { promptSecurityService, PromptSecurityService } from "../prompt-security.service.js";
import {
  policyEngine,
} from "@cossie/policy-engine";
import { registry } from "@cossie/mcp-registry";
import { prisma } from "@cossie/db";

import { ruleCache } from "../rule-cache.service.js";

import { chatService } from "./chat.service.js";

import type { RiskLevel } from "@cossie/shared-types";

async function resolveEffectiveRisk(
  toolName: string,
  registryRisk: RiskLevel
): Promise<RiskLevel> {
  try {
    const override =
      await prisma.toolRiskOverride.findUnique(
        {
          where: { toolName },
        }
      );
    return (
      (override?.riskLevel as RiskLevel) ??
      registryRisk
    );
  } catch {
    return registryRisk;
  }
}

import { toolAdapterService } from "./tool-adapter.service.js";
import { approvalService } from "../approval.service.js";

export class ToolLoopService {
  async run(
    prompt: string,
    conversationId: string = "default"
  ): Promise<string> {
      const scan = promptSecurityService.scan(prompt)
      if(scan.suspicious){
        await logService.create({
          toolName: "PROMPT_SECURITY",
          decision: "ALLOW",
          eventType: "PROMPT_INJECTION",
          reason: scan.matchedPatterns.join(
            ", "
          ),
          trace: scan,
          conversationId,
        })
      }

    const discoveredTools =
      registry.getTools();

    const geminiTools =
      toolAdapterService.toGeminiTools(
        discoveredTools
      );

    let response =
      await chatService.generate(
        prompt,
        geminiTools
      );

    while (true) {
      const candidate =
        response.candidates?.[0];

      const parts =
        candidate?.content?.parts ??
        [];

      const toolCall =
        parts.find(
          (part: any) =>
            "functionCall" in part
        );

      if (!toolCall) {
        return (
          response.text ??
          "No response"
        );
      }

      const functionCall =
        toolCall.functionCall;

      if (!functionCall || !functionCall.name) {
        throw new Error("Function call details or name are missing.");
      }

      const tool =
        registry.getTool(
          functionCall.name
        );

      if (!tool) {
        throw new Error(
          `Unknown tool ${functionCall.name}`
        );
      }

      const effectiveRisk =
        await resolveEffectiveRisk(
          functionCall.name,
          tool.riskLevel
        );

      const decision =
        await policyEngine.evaluate(
          {
            conversationId,
            toolName:
              functionCall.name,

            args:
              functionCall.args ??
              {},
          },

          ruleCache.getRules(),

          {
            riskLevel:
              effectiveRisk,
          }
        );

        console.log(
"Policy:",
decision.decision,
decision.reason,
decision.matchedRule
);
        console.log(
  "POLICY DECISION:",
  decision
);
      if (decision.decision === "REQUIRE_APPROVAL") {
        await logService.create({
          toolName: functionCall.name,
          decision: "REQUIRE_APPROVAL",
          eventType: "TOOL_EXECUTION",
          arguments: functionCall.args ?? {},
          reason: decision.reason,
          matchedRule: decision.matchedRule,
          riskLevel: tool.riskLevel,
          conversationId,
        });

        const approval = await approvalService.create(
          functionCall.name,
          functionCall.args ?? {}
        );

        await logService.create({
          toolName: functionCall.name,
          decision: "REQUIRE_APPROVAL",
          eventType: "APPROVAL_CREATED",
          arguments: functionCall.args ?? {},
          approvalId: approval.id,
          reason: decision.reason,
          matchedRule: decision.matchedRule,
          riskLevel: tool.riskLevel,
          conversationId,
        });

        return `Approval required. Approval ID: ${approval.id}`;
      }

      if (decision.decision !== "ALLOW") {
        await logService.create({
          toolName: functionCall.name,
          decision: decision.decision as any,
          eventType: "TOOL_EXECUTION",
          arguments: functionCall.args ?? {},
          reason: decision.reason,
          matchedRule: decision.matchedRule,
          riskLevel: tool.riskLevel,
          conversationId,
        });
        return `Tool blocked: ${decision.reason}`;
      }

      const toolResult =
        await registry.executeTool(
          functionCall.name,
          functionCall.args ?? {}
        );

      await logService.create({
        toolName: functionCall.name,
        decision: "ALLOW",
        eventType: "TOOL_EXECUTION",
        arguments: functionCall.args ?? {},
        executed: true,
        reason: decision.reason,
        matchedRule: decision.matchedRule,
        riskLevel: tool.riskLevel,
        conversationId,
      });

      response =
        await chatService.generate(
          `
Based on the following tool execution result, write a final response to the user. Do NOT call any more tools.

User Prompt: ${prompt}
Tool Result: ${JSON.stringify(toolResult)}
          `,
          geminiTools
        );
    }
  }
}

export const toolLoopService =
  new ToolLoopService();