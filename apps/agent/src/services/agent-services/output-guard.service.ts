// Output plane guardrail: inspects model-generated text before it reaches the
// user. Catches what the input plane and policy engine structurally cannot:
//   1. system prompt / instruction leakage (verbatim sentinel overlap)
//   2. model/provider identity disclosure ("I'm a LLM from Google")
//   3. secrets echoed out of tool results (egress filtering / DLP)
//
// Deterministic (patterns + sentinels only, no LLM judge) so it adds no
// meaningful latency and is trivially auditable.
//
// Regexes are compiled per inspect() call: module-level /g regexes carry
// lastIndex state between calls and silently skip matches.
import { SYSTEM_PROMPT_SENTINELS } from "./agent-prompt.js";

export interface OutputGuardResult {
  /** false → do not deliver `text`; return the guard refusal instead */
  ok: boolean;
  /** true → deliver `text`, but it was rewritten (secrets redacted) */
  redacted: boolean;
  text: string;
  reason?: string;
  evidence?: string[];
}

interface RedactionRule {
  name: string;
  source: string;
  flags: string;
  replacement: string;
}

const VENDOR_PATTERN =
  /\b(gemini|deepmind|bard|groq|llama|openai|chatgpt|gpt(?:-\d(?:\.\d)?)?|claude|anthropic|deepseek|mistral|qwen|copilot|google)\b/i;

// First-person anchors only, so sentences about third-party vendors
// ("the release was built by Google") are not flagged.
const SELF_REFERENCE_PATTERN = /\b(i'?m|im|i am|i was|i've been|my)\b/i;

// The self-reference + vendor co-occurrence only counts when the sentence also
// links them to the model itself ("I'm a LLM from Google", "I was trained by
// Google", "my underlying model is Gemini").
const DISCLOSURE_LINK_PATTERN =
  /\b(llm|large language model|language model|model|ai|chatbot|assistant|bot|trained|developed|created|built|made|powered|based|version)\b/i;

// "As an AI developed by Google, ..." / "As a language model trained by OpenAI, ..."
const AS_AN_AI_PATTERN =
  /\bas\s+an?\s+(?:ai|llm|language model|large language model|chatbot|assistant)[^.!?]{0,120}?\b(gemini|google|openai|anthropic|gpt|claude|groq|llama|deepseek|mistral|deepmind)\b/i;

const REDACTION_RULES: RedactionRule[] = [
  {
    name: "google_api_key",
    source: "\\bAIza[0-9A-Za-z_\\-]{35}\\b",
    flags: "g",
    replacement: "[REDACTED_GOOGLE_KEY]",
  },
  {
    name: "aws_access_key",
    source: "\\bAKIA[0-9A-Z]{16}\\b",
    flags: "g",
    replacement: "[REDACTED_AWS_KEY]",
  },
  {
    name: "openai_or_groq_key",
    source: "\\b(sk|gsk)_[A-Za-z0-9_-]{16,}\\b",
    flags: "g",
    replacement: "[REDACTED_KEY]",
  },
  {
    name: "github_token",
    source: "\\bgh[pousr]_[A-Za-z0-9]{20,}\\b",
    flags: "g",
    replacement: "[REDACTED_GITHUB_TOKEN]",
  },
  {
    name: "jwt",
    source: "\\beyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\b",
    flags: "g",
    replacement: "[REDACTED_JWT]",
  },
  {
    name: "bearer_token",
    source: "\\bBearer\\s+[A-Za-z0-9._-]{20,}\\b",
    flags: "gi",
    replacement: "Bearer [REDACTED]",
  },
  {
    name: "credential_key_value",
    source:
      "\\b(pass(?:word)?|secret|api[_-]?key|token|authorization)\\b([\"']?\\s*[:=]\\s*[\"']?)([^\\s\"']{8,})",
    flags: "gi",
    replacement: "$1$2[REDACTED]",
  },
];

export const OUTPUT_GUARD_REFUSAL =
  "I'm ArmorIQ, an operations assistant. That's not something I share — happy to help with your servers, deployments, or anything else though!";

export class OutputGuardService {
  inspect(text: string): OutputGuardResult {
    if (!text) {
      return { ok: true, redacted: false, text };
    }

    // 1. System prompt / instruction leakage (verbatim sentinels).
    for (const sentinel of SYSTEM_PROMPT_SENTINELS) {
      if (text.toLowerCase().includes(sentinel.toLowerCase())) {
        return {
          ok: false,
          redacted: false,
          text,
          reason: "System prompt disclosure detected",
          evidence: [sentinel],
        };
      }
    }

    // 2. Identity / provider disclosure.
    const sentences = text.split(/(?<=[.!?])\s+|\n+/);
    for (const sentence of sentences) {
      const selfRef = SELF_REFERENCE_PATTERN.test(sentence);
      const vendor = VENDOR_PATTERN.test(sentence);
      const link = DISCLOSURE_LINK_PATTERN.test(sentence);
      if (selfRef && vendor && link) {
        return {
          ok: false,
          redacted: false,
          text,
          reason: "Model/provider identity disclosure detected",
          evidence: [sentence.slice(0, 160)],
        };
      }
      if (AS_AN_AI_PATTERN.test(sentence)) {
        return {
          ok: false,
          redacted: false,
          text,
          reason: "Model/provider identity disclosure detected (as-an-AI framing)",
          evidence: [sentence.slice(0, 160)],
        };
      }
    }

    // 3. Secret redaction (egress filtering).
    let working = text;
    const redactedRules: string[] = [];
    for (const rule of REDACTION_RULES) {
      const regex = new RegExp(rule.source, rule.flags);
      if (regex.test(working)) {
        working = working.replace(new RegExp(rule.source, rule.flags), rule.replacement);
        redactedRules.push(rule.name);
      }
    }

    if (redactedRules.length > 0) {
      return {
        ok: true,
        redacted: true,
        text: working,
        reason: `Sensitive patterns redacted: ${redactedRules.join(", ")}`,
        evidence: redactedRules,
      };
    }

    return { ok: true, redacted: false, text };
  }
}

export const outputGuardService = new OutputGuardService();
