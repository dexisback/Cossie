import { Router } from "express";
import { promptSecurityService } from "../services/prompt-security.service.js";
import { logService } from "../services/log.service.js";

export const securityRouter = Router();

securityRouter.post("/security/scan", async (req, res) => {
  try {
    const { prompt, conversationId } = req.body as {
      prompt?: string;
      conversationId?: string;
    };

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "prompt is required" });
    }

    const result = await promptSecurityService.scan(prompt);

    if (result.suspicious) {
      await logService.create({
        toolName: "PROMPT_SECURITY",
        decision: "DENY",
        eventType: "PROMPT_INJECTION",
        arguments: { prompt },
        reason: result.technique
          ? `${result.technique} (score ${result.score})`
          : result.matchedPatterns.join(", ") || `score ${result.score}`,
        trace: result as unknown as Record<string, unknown>,
        conversationId: conversationId ?? "playground",
      });
    }

    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Prompt scan failed",
    });
  }
});
