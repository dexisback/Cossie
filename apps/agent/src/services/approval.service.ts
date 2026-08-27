import { prisma } from "@cossie/db";

export class ApprovalService {
  async create(
    toolName: string,
    payload: Record<string, unknown>
  ) {
    return prisma.approval.create({
      data: {
        toolName,
        arguments: payload as any,
        status: "PENDING",
      },
    });
  }

  async approve(id: string) {
    return prisma.approval.update({
      where: { id },

      data: {
        status: "APPROVED",
      },
    });
  }

  async reject(id: string) {
    return prisma.approval.update({
      where: { id },

      data: {
        status: "REJECTED",
      },
    });
  }

  async getPending() {
    return prisma.approval.findMany({
      where: {
        status: "PENDING",
      },

      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async getById(id: string){
    return prisma.approval.findUnique({
        where: { id }
    })
  }


  //expire pending. NOTE ⚠️⚠️⚠️ temperory. to be added as a cron
  async expirePending() {
  const thirtyMinutesAgo =
    new Date(
      Date.now() -
      30 * 60 * 1000
    );

  return prisma.approval.updateMany({
    where: {
      status: "PENDING",

      createdAt: {
        lt: thirtyMinutesAgo,
      },
    },

    data: {
      status: "EXPIRED",

      resolvedAt:
        new Date(),

      resolutionReason:
        "Approval expired",
    },
  });
}

}

export const approvalService =
  new ApprovalService();



//this creates approval requests (approve, reject, fetch pending approvals)

