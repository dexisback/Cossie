//single place for writing audit events
import { prisma, AuditEventType, PolicyDecisionType, RiskLevel } from "@cossie/db";

interface CreateLogInput {
  toolName: string;
  decision: PolicyDecisionType;
  eventType: AuditEventType;
  arguments?: Record<string, unknown> | undefined;
  reason?: string | undefined;
  matchedRule?: string | undefined;
  approvalId?: string | undefined;
  trace?: unknown | undefined;
  executed?: boolean | undefined;
  conversationId?: string | undefined;
  riskLevel?: RiskLevel | undefined;
}

export class LogService {
  async create(
    input: CreateLogInput
  ) {
    return prisma.toolExecutionLog.create({
      data: {
        toolName: input.toolName,
        decision: input.decision,
        eventType: input.eventType,
        conversationId: input.conversationId ?? null,
        riskLevel: input.riskLevel ?? null,
        arguments: (input.arguments ?? {}) as any,
        reason: input.reason ?? null,
        trace: {
          ...(typeof input.trace === "object" && input.trace ? (input.trace as any) : {}),
          matchedRule: input.matchedRule,
          approvalId: input.approvalId,
        } as any,
        executed: input.executed ?? false,
      },
    });
  }
}

export const logService = new LogService();

  