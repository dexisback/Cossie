//change models being used directly from here, suppose flash -> something else

//TODO: later add fallback models asw, like gaspy

// change models here

export const MODELS = {
  GROQ: process.env.GROQ_MODEL || "qwen/qwen3.8-27b",
  GEMINI: "gemini-2.5-flash",
} as const;

export const DEFAULT_PROVIDER = "groq";

export const FALLBACK_PROVIDER = "gemini";






