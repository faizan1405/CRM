export const AI_CONFIG = {
  get apiKey(): string | undefined {
    return process.env.GROQ_API_KEY;
  },
  get model(): string {
    return process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
  },
  timeoutMs: 15_000,
  maxRetries: 1,
  businessTimezone: "Asia/Kolkata",
} as const;
