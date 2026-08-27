import { registry }
from "@cossie/mcp-registry";

import { approvalService }
from "./approval.service.js";

export class ApprovalExecutionService {
  async execute(
    approvalId: string
  ) {
    const approval =
      await approvalService.getById(
        approvalId
      );

    if (!approval) {
      throw new Error(
        "Approval not found"
      );
    }

    if (
      approval.status !==
      "APPROVED"
    ) {
      throw new Error(
        "Approval not approved"
      );
    }

    return registry.executeTool(
      approval.toolName,
      approval.arguments as Record<
        string,
        unknown
      >
    );
  }
}

export const
  approvalExecutionService =
    new ApprovalExecutionService();