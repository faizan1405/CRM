import "server-only";
import Groq from "groq-sdk";
import { AI_CONFIG } from "./config";

export class AIConfigError extends Error {
  constructor(message = "Groq API key is not configured.") {
    super(message);
    this.name = "AIConfigError";
  }
}

export class AIServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIServiceError";
  }
}

let cachedGroqClient: Groq | null = null;
let lastUsedApiKey: string | undefined = undefined;

export function getGroqClient(): Groq {
  const apiKey = AI_CONFIG.apiKey;
  if (!apiKey || !apiKey.trim()) {
    throw new AIConfigError(
      "AI lead structuring is unavailable because the Groq API key is not configured. Please use Manual Entry or check system configuration."
    );
  }

  if (cachedGroqClient && lastUsedApiKey === apiKey) {
    return cachedGroqClient;
  }

  cachedGroqClient = new Groq({ apiKey });
  lastUsedApiKey = apiKey;
  return cachedGroqClient;
}

export type GroqJsonCompletionOptions = {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  timeoutMs?: number;
};

export async function requestGroqJson({
  systemPrompt,
  userPrompt,
  temperature = 0.1,
  timeoutMs = AI_CONFIG.timeoutMs,
}: GroqJsonCompletionOptions): Promise<{ rawJson: string }> {
  const groq = getGroqClient();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await groq.chat.completions.create(
      {
        model: AI_CONFIG.model,
        temperature,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      },
      {
        signal: controller.signal,
      }
    );

    const messageContent = response.choices[0]?.message?.content;
    if (!messageContent || !messageContent.trim()) {
      throw new AIServiceError("AI returned an empty response. Please retry or use Manual Entry.");
    }

    return { rawJson: messageContent.trim() };
  } catch (error: unknown) {
    if (error instanceof AIConfigError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new AIServiceError("AI request timed out. Please retry or use Manual Entry.");
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.toLowerCase().includes("rate limit") || message.toLowerCase().includes("429")) {
      throw new AIServiceError("AI service is currently rate limited. Please retry in a few moments or use Manual Entry.");
    }

    if (
      message.toLowerCase().includes("authentication") ||
      message.toLowerCase().includes("invalid api key") ||
      message.toLowerCase().includes("401")
    ) {
      throw new AIServiceError("AI provider authentication failed. Please check system configuration or use Manual Entry.");
    }

    throw new AIServiceError("AI could not structure this lead. You can retry or use Manual Entry.");
  } finally {
    clearTimeout(timeoutId);
  }
}
