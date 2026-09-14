import "server-only";
import { requestGroqJson, AIServiceError } from "@/lib/ai/groq-client";
import { normalizePhone, extractPotentialPhone } from "./phone-utils";
import { parseBudget, extractPotentialBudget } from "./budget-utils";
import { getReferenceDateTimeContext, isValidDateStr, isValidTimeStr } from "./date-utils";
import {
  GroqLeadExtractionSchema,
  type StructuredLeadDraft,
  type StructuredLeadField,
  type AIFieldConfidence,
  LeadStatusesList,
} from "./types";
import type { LeadStatus } from "@/features/leads/types";

function buildSystemPrompt(timeContext: ReturnType<typeof getReferenceDateTimeContext>): string {
  return `You are an expert CRM sales lead extraction assistant for an Indian web agency.
Your task is to extract structured lead information from messy, unstructured text (such as raw messages, quick notes, WhatsApp chat pastes, or copied Meta Ad lead information).

CRITICAL NO-HALLUCINATION RULES:
1. NEVER invent, assume, or fabricate any missing information.
2. If a field is NOT explicitly mentioned or cannot be directly deduced from the text, you MUST return null for that field.
3. Distinguish between EXTRACTED FACT (information explicitly present) and NOT PROVIDED.
4. Do NOT guess names. If only a phone number is given (e.g. "9876543210"), name MUST be null.
5. Do NOT guess budgets or requirements. If someone didn't state a budget, budget MUST be null.
6. Do NOT include "Lead Source" - all leads are Meta Ads leads and source is removed from the CRM.

RELATIVE TIME REFERENCE:
- Current Reference Date & Time: ${timeContext.formattedKolkata}
- Reference Date (YYYY-MM-DD): ${timeContext.todayDateStr}
- Reference Day of Week: ${timeContext.dayOfWeek}
- Business Timezone: Asia/Kolkata (IST)
Resolve relative expressions such as "tomorrow", "Friday 4pm", "next Monday", "16 September at 3 PM" using this exact reference date.
- suggestedFollowUpDate MUST be in format YYYY-MM-DD, or null if no follow-up is mentioned.
- suggestedFollowUpTime MUST be in 24-hour format HH:MM (e.g. "16:00" for 4pm, "11:30" for 11:30am), or null if no time is mentioned.

INDIAN SALES CONVENTIONS:
- Budgets: Understand "25k" = 25000, "30 thousand" = 30000, "1.5L" or "1.5 lakh" = 150000. Return numeric budget or null.
- Status: Choose one of ["New", "Contacted", "Qualified", "Proposal Sent", "Won", "Lost"]. Default to "New" if not explicitly different.
- Confidence: For each field, indicate "high" if directly and explicitly stated, or "review" if inferred or ambiguous.

OUTPUT FORMAT:
Return a JSON object with this exact structure:
{
  "name": string | null,
  "phone": string | null,
  "email": string | null,
  "business": string | null,
  "industryOrRequirement": string | null,
  "budget": number | null,
  "status": "New" | "Contacted" | "Qualified" | "Proposal Sent" | "Won" | "Lost" | null,
  "notes": string | null,
  "suggestedFollowUpDate": "YYYY-MM-DD" | null,
  "suggestedFollowUpTime": "HH:MM" | null,
  "confidence": {
    "name": "high" | "review",
    "phone": "high" | "review",
    "email": "high" | "review",
    "business": "high" | "review",
    "industryOrRequirement": "high" | "review",
    "budget": "high" | "review",
    "status": "high" | "review",
    "notes": "high" | "review",
    "suggestedFollowUpDate": "high" | "review",
    "suggestedFollowUpTime": "high" | "review"
  }
}`;
}

export async function parseUnstructuredLeadText(rawInput: string): Promise<StructuredLeadDraft> {
  const text = rawInput.trim();
  if (!text) {
    throw new AIServiceError("Please provide lead details to structure.");
  }

  const timeContext = getReferenceDateTimeContext();
  const systemPrompt = buildSystemPrompt(timeContext);

  const { rawJson } = await requestGroqJson({
    systemPrompt,
    userPrompt: `Extract structured lead data from this text:\n\n"""\n${text}\n"""`,
    temperature: 0.1,
  });

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawJson);
  } catch {
    throw new AIServiceError("AI returned malformed output. Please retry or use Manual Entry.");
  }

  const validationResult = GroqLeadExtractionSchema.safeParse(parsedJson);
  if (!validationResult.success) {
    throw new AIServiceError("AI output validation failed. Please retry or use Manual Entry.");
  }

  const extracted = validationResult.data;

  let phoneDisplay: string | null = null;
  const rawPhoneCandidate = extracted.phone || extractPotentialPhone(text);
  if (rawPhoneCandidate) {
    const normalized = normalizePhone(rawPhoneCandidate);
    if (normalized && normalized.isValid) {
      phoneDisplay = normalized.display;
    } else {
      phoneDisplay = rawPhoneCandidate.trim() || null;
    }
  }

  let budgetVal: number | null = null;
  if (extracted.budget !== null && extracted.budget !== undefined) {
    budgetVal = parseBudget(extracted.budget);
  }
  if (budgetVal === null) {
    budgetVal = extractPotentialBudget(text);
  }

  let statusVal: LeadStatus | null = null;
  if (extracted.status && LeadStatusesList.includes(extracted.status as (typeof LeadStatusesList)[number])) {
    statusVal = extracted.status as LeadStatus;
  } else {
    statusVal = "New";
  }

  let followUpDate: string | null = null;
  if (extracted.suggestedFollowUpDate && isValidDateStr(extracted.suggestedFollowUpDate)) {
    followUpDate = extracted.suggestedFollowUpDate;
  }

  let followUpTime: string | null = null;
  if (extracted.suggestedFollowUpTime && isValidTimeStr(extracted.suggestedFollowUpTime)) {
    followUpTime = extracted.suggestedFollowUpTime;
  }

  const cleanStr = (val: string | null | undefined, maxLen = 500): string | null => {
    if (!val || typeof val !== "string") return null;
    const trimmed = val.trim();
    if (!trimmed || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "undefined" || trimmed.toLowerCase() === "not provided") {
      return null;
    }
    return trimmed.slice(0, maxLen);
  };

  const nameVal = cleanStr(extracted.name, 120);
  const emailCandidate = cleanStr(extracted.email, 254);
  const emailVal = emailCandidate && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCandidate) ? emailCandidate : null;
  const businessVal = cleanStr(extracted.business, 160);
  const industryVal = cleanStr(extracted.industryOrRequirement, 100);
  const notesVal = cleanStr(extracted.notes, 5000) || text.slice(0, 5000);

  const confidence: Partial<Record<StructuredLeadField, AIFieldConfidence>> = {};
  const rawConfidence = (extracted.confidence || {}) as Partial<Record<StructuredLeadField, AIFieldConfidence>>;

  const assignConfidence = (field: StructuredLeadField, value: unknown, isDirectlyInText: boolean) => {
    if (value === null || value === undefined || value === "") return;
    const modelConfidence = rawConfidence[field];
    if (modelConfidence === "high" || modelConfidence === "review") {
      confidence[field] = modelConfidence;
    } else {
      confidence[field] = isDirectlyInText ? "high" : "review";
    }
  };

  assignConfidence("name", nameVal, Boolean(nameVal && text.toLowerCase().includes(nameVal.toLowerCase())));
  assignConfidence("phone", phoneDisplay, Boolean(phoneDisplay));
  assignConfidence("email", emailVal, Boolean(emailVal && text.toLowerCase().includes(emailVal.toLowerCase())));
  assignConfidence("business", businessVal, Boolean(businessVal && text.toLowerCase().includes(businessVal.toLowerCase())));
  assignConfidence("industryOrRequirement", industryVal, Boolean(industryVal));
  assignConfidence("budget", budgetVal, Boolean(budgetVal !== null));
  assignConfidence("status", statusVal, statusVal === "New" ? true : Boolean(extracted.status));
  assignConfidence("notes", notesVal, true);
  assignConfidence("suggestedFollowUpDate", followUpDate, Boolean(followUpDate));
  assignConfidence("suggestedFollowUpTime", followUpTime, Boolean(followUpTime));

  return {
    name: nameVal,
    phone: phoneDisplay,
    email: emailVal,
    business: businessVal,
    industryOrRequirement: industryVal,
    budget: budgetVal,
    status: statusVal,
    notes: notesVal,
    suggestedFollowUpDate: followUpDate,
    suggestedFollowUpTime: followUpTime,
    confidence,
    rawInput: text,
  };
}
