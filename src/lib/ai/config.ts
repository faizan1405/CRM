import "server-only";

export const AI_CONFIG = {
  get apiKey(): string | undefined {
    return process.env.GROQ_API_KEY;
  },
  get model(): string {
    return process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  },
  timeoutMs: 15_000,
  maxRetries: 1,
  businessTimezone: "Asia/Kolkata",
} as const;
