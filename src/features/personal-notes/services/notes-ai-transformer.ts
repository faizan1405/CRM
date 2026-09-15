import { requestGroqText } from "@/lib/ai/groq-client";
import type { AITransformAction } from "../types";

const SYSTEM_PROMPT_BASE = `You are an expert executive assistant and note editor in a high-performance CRM.
Your objective is to transform the user's personal notes according to the requested transformation.
Strict Guidelines:
1. Preserve all factual information, numbers, names, dates, and intent accurately.
2. DO NOT hallucinate or invent new facts, metrics, contacts, or requirements.
3. Return ONLY the transformed note content directly as plain markdown text. Do NOT wrap in conversational preamble (such as "Here is your note:", "Certainly!").`;

export async function cleanPersonalNote(content: string): Promise<string> {
  const trimmed = content.trim();
  if (!trimmed) return "";

  try {
    const systemPrompt = `${SYSTEM_PROMPT_BASE}
Task: Clean up spelling, grammar, punctuation, and typographical mistakes. Keep the sentence structure and tone close to original.`;

    const userPrompt = `Note to clean:\n\n${trimmed}`;
    const result = await requestGroqText({
      systemPrompt,
      userPrompt,
      temperature: 0.1,
    });

    return result.text;
  } catch {
    // Graceful deterministic fallback: clean whitespace and format points
    return trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((l) => (l.startsWith("•") || l.startsWith("-") ? l : `• ${l.charAt(0).toUpperCase() + l.slice(1)}`))
      .join("\n");
  }
}

export async function organizePersonalNote(content: string): Promise<string> {
  const trimmed = content.trim();
  if (!trimmed) return "";

  try {
    const systemPrompt = `${SYSTEM_PROMPT_BASE}
Task: Organize unstructured notes into a structured format with appropriate sections, bullet points, key takeaways, and action items if present.`;

    const userPrompt = `Note to organize:\n\n${trimmed}`;
    const result = await requestGroqText({
      systemPrompt,
      userPrompt,
      temperature: 0.2,
    });

    return result.text;
  } catch {
    return `📌 Notes & Action Items:\n• ${trimmed.replace(/\n+/g, "\n• ")}`;
  }
}

export async function rewritePersonalNoteClearly(content: string): Promise<string> {
  const trimmed = content.trim();
  if (!trimmed) return "";

  try {
    const systemPrompt = `${SYSTEM_PROMPT_BASE}
Task: Rewrite the note with professional clarity, high readability, and concise phrasing while preserving every piece of factual content.`;

    const userPrompt = `Note to rewrite:\n\n${trimmed}`;
    const result = await requestGroqText({
      systemPrompt,
      userPrompt,
      temperature: 0.2,
    });

    return result.text;
  } catch {
    return trimmed;
  }
}

export async function summarizePersonalNote(content: string): Promise<string> {
  const trimmed = content.trim();
  if (!trimmed) return "";

  try {
    const systemPrompt = `${SYSTEM_PROMPT_BASE}
Task: Provide a concise executive summary and key bullet takeaways of the note without omitting vital numbers, deadlines, or decisions.`;

    const userPrompt = `Note to summarize:\n\n${trimmed}`;
    const result = await requestGroqText({
      systemPrompt,
      userPrompt,
      temperature: 0.2,
    });

    return result.text;
  } catch {
    const firstLine = trimmed.split("\n")[0];
    return `Key Summary: ${firstLine}`;
  }
}

export async function transformPersonalNote(
  content: string,
  action: AITransformAction
): Promise<string> {
  switch (action) {
    case "cleanup":
      return await cleanPersonalNote(content);
    case "organize":
      return await organizePersonalNote(content);
    case "rewrite":
      return await rewritePersonalNoteClearly(content);
    case "summarize":
      return await summarizePersonalNote(content);
    default:
      return content;
  }
}
