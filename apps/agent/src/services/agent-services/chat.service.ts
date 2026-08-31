// Provider-agnostic chat client. The orchestration layer (tool-loop) composes
// the system instruction and conversation history; this client guarantees BOTH
// the primary (Gemini) and fallback (Groq) paths receive them — fallback paths
// must preserve security invariants, not just functionality.
import { gemini } from "../../lib/gemini.js";
import { groq } from "../../lib/groq.js";
import { MODELS } from "../../lib/models.js";

export interface ChatHistoryMessage {
  role: "USER" | "ASSISTANT";
  content: string;
}

export interface GenerateOptions {
  tools?: unknown[];
  systemInstruction?: string;
  history?: ChatHistoryMessage[];
}

async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    console.warn(`Groq request failed, retrying in ${delay}ms...`, error);
    await new Promise(resolve => setTimeout(resolve, delay));
    return retryWithBackoff(fn, retries - 1, delay * 2);
  }
}

export class ChatService {
  async generate(
    prompt: string,
    options: GenerateOptions = {}
  ) {
    const { tools, systemInstruction, history = [] } = options;

    try {
      const config: any = {};
      if (tools) {
        config.tools = JSON.parse(JSON.stringify(tools));
      }
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }

      const contents = [
        ...history.map(m => ({
          role: m.role === "ASSISTANT" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        { role: "user", parts: [{ text: prompt }] },
      ];

      const response = await gemini.models.generateContent({
        model: MODELS.GEMINI,
        contents,
        config,
      });

      return response;
    } catch (geminiError: any) {
      console.warn("Gemini call failed. Falling back to Groq...", geminiError.message || geminiError);

      const lowercaseSchemaTypes = (schema: any): any => {
        if (!schema || typeof schema !== "object") {
          return schema;
        }
        const result = Array.isArray(schema) ? [] : {};
        for (const key of Object.keys(schema)) {
          if (key === "type" && typeof schema[key] === "string") {
            (result as any)[key] = schema[key].toLowerCase();
          } else {
            (result as any)[key] = lowercaseSchemaTypes(schema[key]);
          }
        }
        return result;
      };

      const declarations = (tools as any)?.[0]?.functionDeclarations ?? [];
      const groqTools = declarations.map((decl: any) => ({
        type: "function",
        function: {
          name: decl.name,
          description: decl.description,
          parameters: lowercaseSchemaTypes(decl.parameters),
        }
      }));

      const messages: any[] = [];
      if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
      }
      for (const m of history) {
        messages.push({
          role: m.role === "ASSISTANT" ? "assistant" : "user",
          content: m.content,
        });
      }
      messages.push({ role: "user", content: prompt });

      const groqParams: any = {
        model: MODELS.GROQ,
        messages,
      };

      if (groqTools.length > 0) {
        groqParams.tools = groqTools;
      }

      const completion = await retryWithBackoff(async () => {
        return await groq.chat.completions.create(groqParams);
      });

      const choice = completion.choices?.[0];
      const message = choice?.message;
      const parts: any[] = [];

      if (message?.content) {
        parts.push({ text: message.content });
      }

      if (message?.tool_calls) {
        for (const tc of message.tool_calls) {
          parts.push({
            functionCall: {
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments || "{}"),
            }
          });
        }
      }

      const geminiResponse = {
        candidates: [
          {
            content: {
              parts,
            }
          }
        ],
        get text() {
          return message?.content || "";
        }
      };

      return geminiResponse as any;
    }
  }
}

export const chatService = new ChatService();
