import { requestGroqText, AIConfigError, AIServiceError } from "@/lib/ai/groq-client";
import type { AITransformAction } from "../types";

export const PERSONAL_NOTE_IMPROVE_SYSTEM_PROMPT = `You are an expert CRM personal note editor.
Lightly rewrite this personal CRM note for clarity and readability. Preserve every factual detail, number, name, date, amount and meaning. Do not invent, infer or recommend anything.

STRICT FACTUALITY & SAFETY RULES:
1. You may improve:
   - grammar
   - clarity
   - structure
   - spelling
   - readability
2. You must NOT invent or infer:
   - names
   - amounts
   - dates
   - commitments
   - tasks
   - client requirements
   - conclusions
   - recommendations
   - business facts
3. Preserve all:
   - numbers
   - prices
   - percentages
   - dates/times
   - names
   - URLs
   - meaning
4. If information is unclear, do not guess.

LANGUAGE & TONE:
- Preserve language style:
  - English -> English
  - Hinglish -> natural Hinglish
  - Hindi -> Hindi where supported
- Do not convert casual notes into unnecessarily formal business writing. Keep it natural and appropriate for personal CRM notes.

OUTPUT FORMAT:
- Return ONLY the improved note text.
- Do NOT add conversational preamble, pleasantries, or explanations.
- Do NOT wrap in quotes.
- Do NOT wrap in markdown code blocks.`;

/**
 * Strips surrounding quotes or markdown code fences if added by the LLM.
 */
function cleanAiNoteText(raw: string): string {
  let cleaned = raw.trim();

  // Strip markdown code fences (e.g. ```text ... ``` or ``` ...)
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z0-9_-]*\n?/, "").replace(/\n?```$/, "").trim();
  }

  // Strip surrounding quotes if the whole note is wrapped in them
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
    (cleaned.startsWith("“") && cleaned.endsWith("”"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned;
}

/**
 * Lightly rewrites a personal note for clarity and readability using the existing Groq AI client.
 * Strictly preserves all facts, numbers, names, amounts, and Hinglish style without inventing anything.
 */
export async function improvePersonalNoteService(content: string): Promise<string> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Note content cannot be empty.");
  }

  const userPrompt = trimmed;

  try {
    const result = await requestGroqText({
      systemPrompt: PERSONAL_NOTE_IMPROVE_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.1, // Deterministic to strictly preserve facts and eliminate hallucination
    });

    const cleaned = cleanAiNoteText(result.text);
    return cleaned || trimmed;
  } catch (err: unknown) {
    if (err instanceof AIConfigError) {
      throw new Error("AI service is currently unavailable. Please check system configuration.");
    }
    if (err instanceof AIServiceError) {
      throw new Error("Unable to improve note right now. Please try again or edit manually.");
    }
    if (err instanceof Error && err.message.includes("Note content cannot be empty")) {
      throw err;
    }
    throw new Error("Unable to improve note right now. Please try again or edit manually.");
  }
}

export const improvePersonalNoteText = improvePersonalNoteService;

const SYSTEM_PROMPT_BASE = `You are an expert executive assistant and note editor in a high-performance CRM.
Your objective is to transform the user's personal notes according to the requested transformation.
Strict Guidelines:
1. Preserve all factual information, numbers, names, dates, and intent accurately.
2. DO NOT hallucinate or invent new facts, metrics, contacts, or requirements.
3. Return ONLY the transformed note content directly as plain markdown text. Do NOT wrap in conversational preamble (such as "Here is your note:", "Certainly!").`;

export async function cleanPersonalNote(content: string): Promise<string> {
  const trimmed = content.trim();
  if (!trimmed) return "";

  const systemPrompt = `${SYSTEM_PROMPT_BASE}
Task: Clean up spelling, grammar, punctuation, and typographical mistakes. Keep the sentence structure and tone close to original.`;

  const userPrompt = `Note to clean:\n\n${trimmed}`;
  const result = await requestGroqText({
    systemPrompt,
    userPrompt,
    temperature: 0.1,
  });

  return result.text;
}

export async function organizePersonalNote(content: string): Promise<string> {
  const trimmed = content.trim();
  if (!trimmed) return "";

  const systemPrompt = `${SYSTEM_PROMPT_BASE}
Task: Organize unstructured notes into a structured format with appropriate sections, bullet points, key takeaways, and action items if present.`;

  const userPrompt = `Note to organize:\n\n${trimmed}`;
  const result = await requestGroqText({
    systemPrompt,
    userPrompt,
    temperature: 0.2,
  });

  return result.text;
}

export async function rewritePersonalNoteClearly(content: string): Promise<string> {
  const trimmed = content.trim();
  if (!trimmed) return "";

  const systemPrompt = `${SYSTEM_PROMPT_BASE}
Task: Rewrite the note with professional clarity, high readability, and concise phrasing while preserving every piece of factual content.`;

  const userPrompt = `Note to rewrite:\n\n${trimmed}`;
  const result = await requestGroqText({
    systemPrompt,
    userPrompt,
    temperature: 0.2,
  });

  return result.text;
}

export async function summarizePersonalNote(content: string): Promise<string> {
  const trimmed = content.trim();
  if (!trimmed) return "";

  const systemPrompt = `${SYSTEM_PROMPT_BASE}
Task: Provide a concise executive summary and key bullet takeaways of the note without omitting vital numbers, deadlines, or decisions.`;

  const userPrompt = `Note to summarize:\n\n${trimmed}`;
  const result = await requestGroqText({
    systemPrompt,
    userPrompt,
    temperature: 0.2,
  });

  return result.text;
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
