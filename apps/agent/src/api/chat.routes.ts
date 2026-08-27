import { Router } from "express";
import { prisma } from "@cossie/db";
import { toolLoopService } from "../services/agent-services/tool-loop.service.js";


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
