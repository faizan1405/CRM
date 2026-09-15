import { z } from "zod";
import { requestGroqJson, AIConfigError, AIServiceError } from "@/lib/ai/groq-client";
import type { StructuredCallNotesData, InterestLevel } from "../types";

export const ZodInterestLevel = z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]);

export const RawGroqNotesSchema = z.object({
  requirement: z.string().nullable().optional().transform((v) => (v && v.trim() ? v.trim() : null)),
  budget: z.string().nullable().optional().transform((v) => (v && v.trim() ? v.trim() : null)),
  interestLevel: z.preprocess((val) => {
    if (typeof val === "string") {
      const upper = val.toUpperCase().trim();
      if (["HIGH", "MEDIUM", "LOW", "UNKNOWN"].includes(upper)) return upper;
      if (upper.includes("HIGH")) return "HIGH";
      if (upper.includes("MED")) return "MEDIUM";
      if (upper.includes("LOW")) return "LOW";
    }
    return "UNKNOWN";
  }, ZodInterestLevel),
  decisionFactor: z.string().nullable().optional().transform((v) => (v && v.trim() ? v.trim() : null)),
  objections: z.string().nullable().optional().transform((v) => (v && v.trim() ? v.trim() : null)),
  importantDetails: z.string().nullable().optional().transform((v) => (v && v.trim() ? v.trim() : null)),
  nextAction: z.string().nullable().optional().transform((v) => (v && v.trim() ? v.trim() : null)),
  suggestedFollowUpDate: z.string().nullable().optional().transform((v) => (v && v.trim() ? v.trim() : null)),
  suggestedFollowUpTime: z.string().nullable().optional().transform((v) => (v && v.trim() ? v.trim() : null)),
  tags: z.array(z.string()).default([]),
});

/**
 * Returns current timestamp information in Asia/Kolkata timezone for prompt context
 */
function getIndiaTimeContext() {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);

  const timeStr = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);

  const isoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return { dateStr, timeStr, isoDate };
}

/**
 * Parses raw messy conversation notes into a clean structured DTO using Groq.
 * Employs zero-hallucination guardrails: absent fields are returned strictly as null.
 */
export async function parseRawCallNotes(
  rawNote: string,
  leadContext?: { name?: string; business?: string; requirement?: string; status?: string }
): Promise<StructuredCallNotesData> {
  const cleanRaw = rawNote?.trim() || "";
  if (!cleanRaw) {
    return {
      rawNote: "",
      requirement: null,
      budget: null,
      interestLevel: "UNKNOWN",
      decisionFactor: null,
      objections: null,
      importantDetails: null,
      nextAction: null,
      suggestedFollowUpDate: null,
      suggestedFollowUpTime: null,
      tags: [],
    };
  }

  const { dateStr, timeStr, isoDate } = getIndiaTimeContext();

  const systemPrompt = `You are an AI sales notes parser for a CRM in India.
Current business context in India (Asia/Kolkata):
- Today: ${dateStr} (ISO: ${isoDate})
- Current Time: ${timeStr}

YOUR GOAL:
Analyze quick, informal shorthand sales/call notes and extract key facts into structured JSON.

CRITICAL EXTRACTION RULES:
1. DO NOT invent information. If a detail (like budget, objections, or decision factor) is not mentioned or implied in the note, you MUST set it to null.
2. interestLevel must be strictly one of: "HIGH", "MEDIUM", "LOW", "UNKNOWN".
   - HIGH: strong buying intent, urgent need, requested quotation or proposal, ready to buy.
   - MEDIUM: interested, checking options, comparing, need approval or discussion.
   - LOW: cold, unenthusiastic, low budget without willingness to negotiate, delayed indefinitely.
   - UNKNOWN: not enough information to judge.
3. suggestedFollowUpDate: If a relative date is stated (e.g. "friday", "tomorrow", "next monday", "20th"), calculate the specific calendar date in YYYY-MM-DD format based on today's reference date (${isoDate}). If none, set to null.
4. suggestedFollowUpTime: Format as e.g. "4:00 PM" or "16:00". If no time mentioned, set to null.
5. budget: Standardize budget references (e.g. "25k" -> "₹25,000", "1.5L" -> "₹1,50,000"). If none, set to null.
6. tags: A list of 1 to 4 concise tags (e.g. ["Ecommerce", "Follow-up Required", "Partner Review"]).
7. Output strictly JSON matching this structure:
{
  "requirement": string | null,
  "budget": string | null,
  "interestLevel": "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN",
  "decisionFactor": string | null,
  "objections": string | null,
  "importantDetails": string | null,
  "nextAction": string | null,
  "suggestedFollowUpDate": "YYYY-MM-DD" | null,
  "suggestedFollowUpTime": "HH:mm" | null,
  "tags": string[]
}`;

  const userPrompt = `Lead Context:
${leadContext?.name ? `- Lead Name: ${leadContext.name}` : ""}
${leadContext?.business ? `- Business: ${leadContext.business}` : ""}
${leadContext?.requirement ? `- Prior Requirement: ${leadContext.requirement}` : ""}
${leadContext?.status ? `- Current Status: ${leadContext.status}` : ""}

Raw Call Notes:
"""
${cleanRaw}
"""

Extract structured facts now:`;

  try {
    const { rawJson } = await requestGroqJson({
      systemPrompt,
      userPrompt,
      temperature: 0.1,
    });

    const parsed = JSON.parse(rawJson);
    const validated = RawGroqNotesSchema.parse(parsed);

    return {
      rawNote: cleanRaw,
      requirement: validated.requirement,
      budget: validated.budget,
      interestLevel: validated.interestLevel as InterestLevel,
      decisionFactor: validated.decisionFactor,
      objections: validated.objections,
      importantDetails: validated.importantDetails,
      nextAction: validated.nextAction,
      suggestedFollowUpDate: validated.suggestedFollowUpDate,
      suggestedFollowUpTime: validated.suggestedFollowUpTime,
      tags: validated.tags || [],
    };
  } catch (error) {
    if (error instanceof AIConfigError || error instanceof AIServiceError || error instanceof Error) {
      // Deterministic fallback if Groq is unavailable or fails
      return parseDeterministicFallback(cleanRaw);
    }
    throw error;
  }
}

/**
 * Fallback parser that does not require an LLM. Extracts basic patterns safely.
 */
export function parseDeterministicFallback(rawNote: string): StructuredCallNotesData {
  const clean = rawNote.trim();
  const lower = clean.toLowerCase();

  // Basic budget detection (e.g. 25k, 25000, 1.5L)
  let budget: string | null = null;
  const budgetMatch = clean.match(/(?:budget|quote|quoted|rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?\s*(?:k|lakh|lac|cr)?|\d{4,8})\b/i);
  if (budgetMatch && budgetMatch[1]) {
    const val = budgetMatch[1].trim();
    if (/^\d+k$/i.test(val)) {
      const num = parseInt(val) * 1000;
      budget = `₹${num.toLocaleString("en-IN")}`;
    } else if (/^\d+$/i.test(val) && parseInt(val) >= 1000) {
      budget = `₹${parseInt(val).toLocaleString("en-IN")}`;
    } else {
      budget = val;
    }
  }

  // Interest level inference
  let interestLevel: InterestLevel = "UNKNOWN";
  if (lower.includes("very interested") || lower.includes("urgent") || lower.includes("ready to buy") || lower.includes("high interest")) {
    interestLevel = "HIGH";
  } else if (lower.includes("not interested") || lower.includes("declined") || lower.includes("too expensive") || lower.includes("drop")) {
    interestLevel = "LOW";
  } else if (lower.includes("interested") || lower.includes("follow up") || lower.includes("callback")) {
    interestLevel = "MEDIUM";
  }

  // Tags
  const tags: string[] = [];
  if (lower.includes("follow up") || lower.includes("call back") || lower.includes("friday")) tags.push("Follow-up Required");
  if (budget) tags.push("Budget Discussed");
  if (lower.includes("partner") || lower.includes("boss") || lower.includes("team")) tags.push("Decision Maker");

  return {
    rawNote: clean,
    requirement: clean.length > 80 ? `${clean.slice(0, 77)}...` : clean,
    budget,
    interestLevel,
    decisionFactor: null,
    objections: null,
    importantDetails: clean,
    nextAction: lower.includes("follow up") ? "Follow up with client" : null,
    suggestedFollowUpDate: null,
    suggestedFollowUpTime: null,
    tags,
  };
}

/**
 * Formats structured call notes into a human-readable activity text
 */
export function formatStructuredNoteToReadableText(data: StructuredCallNotesData): string {
  const parts: string[] = [];

  if (data.requirement) {
    parts.push(`Requirement: ${data.requirement}`);
  }
  if (data.budget) {
    parts.push(`Budget: ${data.budget}`);
  }
  if (data.interestLevel && data.interestLevel !== "UNKNOWN") {
    parts.push(`Interest Level: ${data.interestLevel}`);
  }
  if (data.decisionFactor) {
    parts.push(`Decision Factor: ${data.decisionFactor}`);
  }
  if (data.objections) {
    parts.push(`Objections: ${data.objections}`);
  }
  if (data.importantDetails) {
    parts.push(`Key Details: ${data.importantDetails}`);
  }
  if (data.nextAction) {
    parts.push(`Next Action: ${data.nextAction}`);
  }
  if (data.suggestedFollowUpDate) {
    const timePart = data.suggestedFollowUpTime ? ` at ${data.suggestedFollowUpTime}` : "";
    parts.push(`Suggested Follow-up: ${data.suggestedFollowUpDate}${timePart}`);
  }
  if (data.tags && data.tags.length > 0) {
    parts.push(`Tags: ${data.tags.join(", ")}`);
  }

  if (parts.length === 0) {
    return data.rawNote;
  }

  return parts.join("\n• ");
}
