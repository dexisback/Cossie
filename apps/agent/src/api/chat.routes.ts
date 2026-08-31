import { Router } from "express";
import { prisma } from "@cossie/db";
import { toolLoopService } from "../services/agent-services/tool-loop.service.js";
import { estimateTokens } from "../services/agent-services/token-estimate.js";


export const chatRouter =
  Router();

chatRouter.post(
  "/chat",
  async (req, res) => {
    try {
      const { message, conversationId } =
        req.body;

      const conv =
        conversationId
          ? await prisma.conversation
              .findUnique({
                where: { id: conversationId },
              })
          : await prisma.conversation
              .create({ data: {} });

      if (!conv) {
        return res
          .status(404)
          .json({ success: false, error: "Conversation not found" });
      }

      await prisma.message.create({
        data: {
          conversationId: conv.id,
          role: "USER",
          content: message,
        },
      });

      const response =
        await toolLoopService.run(
          message,
          conv.id
        );

      await prisma.message.create({
        data: {
          conversationId: conv.id,
          role: "ASSISTANT",
          content: response,
        },
      });

      // Keep Conversation.totalTokens in sync so the policy engine's
      // BUDGET_LIMIT rules see cumulative usage on the next request.
      // Accounting failures must never break the chat response.
      const usage =
        estimateTokens(message) + estimateTokens(response);
      try {
        await prisma.conversation.update({
          where: { id: conv.id },
          data: { totalTokens: { increment: usage } },
        });
      } catch (accountingError) {
        console.warn(
          "[chat] token accounting failed:",
          accountingError instanceof Error
            ? accountingError.message
            : accountingError
        );
      }

      return res.json({
        success: true,
        response,
        conversationId: conv.id,
      });
    } catch (error) {
      return res
        .status(500)
        .json({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Unknown error",
        });
    }
  }
);
