import { requestGroqJson, AIServiceError } from "@/lib/ai/groq-client";
import { normalizePhone, extractPotentialPhone } from "./phone-utils";
import { parseBudget, extractPotentialBudget } from "./budget-utils";
import { getReferenceDateTimeContext, isValidDateStr, isValidTimeStr } from "./date-utils";
import {
  GroqBulkLeadExtractionSchema,
  GroqLeadExtractionSchema,
  type GroqLeadExtraction,
  type StructuredLeadDraft,
  type StructuredLeadField,
  type AIFieldConfidence,
  LeadStatusesList,
} from "./types";
import type { LeadStatus } from "@/features/leads/types";

export const MAX_BULK_LEADS_LIMIT = 50;

/**
 * Helper to clean and bound extracted strings
 */
function cleanStr(val: string | null | undefined, maxLen = 500): string | null {
  if (!val || typeof val !== "string") return null;
  const trimmed = val.trim();
  if (
    !trimmed ||
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "undefined" ||
    trimmed.toLowerCase() === "not provided" ||
    trimmed.toLowerCase() === "n/a"
  ) {
    return null;
  }
  return trimmed.slice(0, maxLen);
}

/**
 * Transforms a single raw Groq extraction or deterministic object into canonical StructuredLeadDraft
 */
export function normalizeSingleLeadDraft(
  extracted: GroqLeadExtraction,
  sourceText: string
): StructuredLeadDraft {
  const text = sourceText.trim();

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

  let statusVal: LeadStatus = "New";
  if (
    extracted.status &&
    LeadStatusesList.includes(extracted.status as (typeof LeadStatusesList)[number])
  ) {
    statusVal = extracted.status as LeadStatus;
  }

  let followUpDate: string | null = null;
  if (extracted.suggestedFollowUpDate && isValidDateStr(extracted.suggestedFollowUpDate)) {
    followUpDate = extracted.suggestedFollowUpDate;
  }

  let followUpTime: string | null = null;
  if (extracted.suggestedFollowUpTime && isValidTimeStr(extracted.suggestedFollowUpTime)) {
    followUpTime = extracted.suggestedFollowUpTime;
  }

  const nameVal = cleanStr(extracted.name, 120);
  const emailCandidate = cleanStr(extracted.email, 254);
  const emailVal =
    emailCandidate && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCandidate) ? emailCandidate : null;
  const businessVal = cleanStr(extracted.business, 160);
  const industryVal = cleanStr(extracted.industryOrRequirement, 100);
  const notesVal = cleanStr(extracted.notes, 5000) || (text ? text.slice(0, 5000) : null);

  const confidence: Partial<Record<StructuredLeadField, AIFieldConfidence>> = {};
  const rawConfidence = (extracted.confidence || {}) as Partial<
    Record<StructuredLeadField, AIFieldConfidence>
  >;

  const assignConfidence = (
    field: StructuredLeadField,
    value: unknown,
    isDirectlyInText: boolean
  ) => {
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

/**
 * Split text by common list patterns:
 * 1) Numbered items (1. ..., 2. ... or 1) ..., 2) ...)
 * 2) WhatsApp chat log messages ([date, time] Name: message)
 * 3) Newlines
 */
function splitIntoRawCandidateItems(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Check for WhatsApp message exports: e.g. "[12/09/2026, 10:15:30] Name: msg"
  const whatsappPattern = /(?:^|\n)(?:\[\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}[,\s]+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?\]|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}[,\s]+\d{1,2}:\d{2}\s*-\s*)/;
  if (whatsappPattern.test(trimmed)) {
    const parts = trimmed
      .split(/(?:^|\n)(?=(?:\[\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}[,\s]+\d{1,2}:\d{2}|(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}[,\s]+\d{1,2}:\d{2}\s*-\s*)))/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 1) return parts;
  }

  // Check for numbered lists on same line or multiple lines: e.g. "1. Faiz 9999999999 2. Ali 8888888888"
  if (/(?:^|\s)(?:1[\.\)]\s+)[\s\S]+?(?:\s+2[\.\)]\s+)/.test(trimmed)) {
    const parts = trimmed
      .split(/(?:^|\s+)(?=\d{1,3}[\.\)]\s+)/)
      .map((p) => p.replace(/^\d{1,3}[\.\)]\s*/, "").trim())
      .filter(Boolean);
    if (parts.length > 1) return parts;
  }

  // Default: Split by newlines
  const lines = trimmed
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Clean numbered prefix if present in lines (e.g. "1. Faiz - 9999999999")
  return lines.map((l) => l.replace(/^\d{1,3}[\.\)]\s*/, "").trim()).filter(Boolean);
}

/**
 * Attempts deterministic parsing of a single line/item.
 * Handles:
 * - Phone only: "9876543210" or "+91 98765 43210"
 * - Name + Phone: "Faiz - 9999999999", "Ali: 8888888888", "Faiz 9999999999", "Faiz | 9999999999"
 * - CSV / TSV: "Faiz, 9999999999, Web Agency, 50k"
 * - Name + Phone + Budget: "Faiz 9999999999 25k", "Faiz - 9999999999 - budget 50000"
 */
function tryDeterministicParseLine(line: string): StructuredLeadDraft | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Clean leading WhatsApp timestamp / bracket (e.g. "[12/09/2026, 10:15:30] Faiz: msg" -> "Faiz: msg")
  const cleaned = trimmed.replace(
    /^\[?\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}[,\s]+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?\]?\s*[-:]?\s*/,
    ""
  ).trim();
  const effectiveLine = cleaned || trimmed;

  // 1. Phone Only
  const normDirectPhone = normalizePhone(effectiveLine);
  if (normDirectPhone && normDirectPhone.isValid && /^[+\d\s\-()]+$/.test(effectiveLine)) {
    return normalizeSingleLeadDraft(
      {
        name: null,
        phone: normDirectPhone.display,
        email: null,
        business: null,
        industryOrRequirement: null,
        budget: null,
        status: "New",
        notes: trimmed,
        confidence: { phone: "high" },
      },
      trimmed
    );
  }

  // 2. CSV / TSV / Semicolon / Pipe separated values
  const delimiters = [",", "\t", ";", "|"];
  for (const delim of delimiters) {
    if (effectiveLine.includes(delim)) {
      const parts = effectiveLine.split(delim).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        // Find which part is the phone number
        let phoneIdx = -1;
        let phoneDisplay: string | null = null;
        for (let i = 0; i < parts.length; i++) {
          const norm = normalizePhone(parts[i]);
          if (norm && norm.isValid) {
            phoneIdx = i;
            phoneDisplay = norm.display;
            break;
          }
        }

        if (phoneIdx !== -1) {
          let nameVal: string | null = null;
          let emailVal: string | null = null;
          let businessVal: string | null = null;
          let budgetVal: number | null = null;
          let industryVal: string | null = null;

          // Process remaining parts
          const nonPhoneParts: string[] = [];
          for (let i = 0; i < parts.length; i++) {
            if (i === phoneIdx) continue;
            const part = parts[i];
            if (part.includes("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(part)) {
              emailVal = part;
            } else {
              const b = parseBudget(part);
              if (b !== null && budgetVal === null && (part.toLowerCase().includes("k") || part.toLowerCase().includes("l") || /^\d+$/.test(part))) {
                budgetVal = b;
              } else {
                nonPhoneParts.push(part);
              }
            }
          }

          if (phoneIdx === 0) {
            // Phone first: [Phone, Name, Business...]
            if (nonPhoneParts.length > 0) nameVal = nonPhoneParts[0];
            if (nonPhoneParts.length > 1) businessVal = nonPhoneParts[1];
            if (nonPhoneParts.length > 2) industryVal = nonPhoneParts.slice(2).join(", ");
          } else {
            // Name first: [Name, Phone, Business...]
            nameVal = parts[0] || null;
            const rest = nonPhoneParts.filter((p) => p !== nameVal);
            if (rest.length > 0) businessVal = rest[0];
            if (rest.length > 1) industryVal = rest.slice(1).join(", ");
          }

          const confidence: Partial<Record<StructuredLeadField, AIFieldConfidence>> = {
            name: nameVal ? "high" : "review",
            phone: "high",
          };
          if (emailVal) confidence.email = "high";
          if (businessVal) confidence.business = "high";
          if (budgetVal !== null) confidence.budget = "high";

          return normalizeSingleLeadDraft(
            {
              name: nameVal,
              phone: phoneDisplay,
              email: emailVal,
              business: businessVal,
              industryOrRequirement: industryVal,
              budget: budgetVal,
              status: "New",
              notes: trimmed,
              confidence,
            },
            trimmed
          );
        }
      }
    }
  }

  // 3. Delimited by hyphen or colon: "Faiz - 9999999999", "Ali: 8888888888"
  const separatorMatch = effectiveLine.match(/^([^:\-\–\—]+)\s*[:\-\–\—]\s*(.+)$/);
  if (separatorMatch) {
    const left = separatorMatch[1].trim();
    const right = separatorMatch[2].trim();

    const leftNorm = normalizePhone(left);

    // Left is phone, right is name/details
    if (leftNorm && leftNorm.isValid) {
      const budget = extractPotentialBudget(right);
      return normalizeSingleLeadDraft(
        {
          name: right.replace(/(?:budget\s*)?(?:₹\s*)?\d+(?:\.\d+)?\s*(?:k|lakh|thousand)?/i, "").trim() || null,
          phone: leftNorm.display,
          email: null,
          business: null,
          industryOrRequirement: null,
          budget,
          status: "New",
          notes: trimmed,
          confidence: { phone: "high", name: "high" },
        },
        trimmed
      );
    }

    // Right is phone or contains phone (e.g. "9999999999" or "9999999999 50k" or "Hi I need website 9999999999")
    const phoneCandidate = extractPotentialPhone(right);
    if (phoneCandidate) {
      const normPhone = normalizePhone(phoneCandidate);
      if (normPhone && normPhone.isValid) {
        const remainingRight = right.replace(phoneCandidate, "").trim();
        const budget = extractPotentialBudget(remainingRight);
        const nameCandidate = left.length > 0 && !extractPotentialPhone(left) ? left : null;

        return normalizeSingleLeadDraft(
          {
            name: nameCandidate,
            phone: normPhone.display,
            email: null,
            business: null,
            industryOrRequirement: null,
            budget,
            status: "New",
            notes: trimmed,
            confidence: { phone: "high", name: nameCandidate ? "high" : "review" },
          },
          trimmed
        );
      }
    }
  }

  // 4. Space separated Name and Phone: "Faiz 9999999999" or "Faiz 9999999999 25k"
  const phoneInLine = extractPotentialPhone(effectiveLine);
  if (phoneInLine) {
    const norm = normalizePhone(phoneInLine);
    if (norm && norm.isValid) {
      const beforeAndAfter = effectiveLine.split(phoneInLine);
      const before = (beforeAndAfter[0] || "").trim();
      const after = (beforeAndAfter.slice(1).join(phoneInLine) || "").trim();

      // Ensure no complex sentence structure (like "Call Faiz tomorrow at 9999999999")
      const lower = effectiveLine.toLowerCase();
      const hasComplexKeywords =
        lower.includes("tomorrow") ||
        lower.includes("follow up") ||
        lower.includes("meeting") ||
        lower.includes("urgent") ||
        lower.includes("proposal");

      if (!hasComplexKeywords) {
        const budget = extractPotentialBudget(after) ?? extractPotentialBudget(before);
        const nameCandidate = cleanStr(before || after.replace(/(?:budget\s*)?(?:₹\s*)?\d+(?:\.\d+)?\s*(?:k|lakh|thousand)?/i, ""), 120);

        return normalizeSingleLeadDraft(
          {
            name: nameCandidate,
            phone: norm.display,
            email: null,
            business: null,
            industryOrRequirement: null,
            budget,
            status: "New",
            notes: trimmed,
            confidence: { phone: "high", name: nameCandidate ? "high" : "review" },
          },
          trimmed
        );
      }
    }
  }

  return null;
}

/**
 * Builds the LLM system prompt for extracting multiple structured leads.
 */
function buildBulkSystemPrompt(timeContext: ReturnType<typeof getReferenceDateTimeContext>): string {
  return `You are an expert CRM sales lead extraction assistant for an Indian web agency.
Your task is to extract structured lead information for MULTIPLE leads from messy, unstructured text.

CRITICAL MULTI-LEAD SEPARATION RULES:
1. Identify each DISTINCT person/lead in the text.
2. Return a JSON object with a "leads" array where each element represents ONE distinct person.
3. NEVER combine different people or different phone numbers into one lead. Phone numbers are strong separation signals: 10 distinct phone numbers = 10 lead items.
4. If there are multiple phone numbers for different individuals, create a separate array item for each individual.
5. If only a single lead is present in the text, return an array with exactly one lead item.
6. Maximum allowed leads per request is ${MAX_BULK_LEADS_LIMIT}.

CRITICAL NO-HALLUCINATION RULES:
1. NEVER invent, assume, or fabricate any missing information.
2. If a field is NOT explicitly mentioned or directly deducible, return null for that field.
3. If only a phone number is given (e.g. "9876543210"), name MUST be null.
4. Do NOT guess budgets or requirements. If someone didn't state a budget, budget MUST be null.
5. Do NOT include "Lead Source" - all leads are Meta Ads leads.

RELATIVE TIME REFERENCE:
- Current Reference Date & Time: ${timeContext.formattedKolkata}
- Reference Date (YYYY-MM-DD): ${timeContext.todayDateStr}
- Reference Day of Week: ${timeContext.dayOfWeek}
- Business Timezone: Asia/Kolkata (IST)
- suggestedFollowUpDate MUST be YYYY-MM-DD or null.
- suggestedFollowUpTime MUST be 24-hour HH:MM or null.

INDIAN SALES CONVENTIONS:
- Budgets: Understand "25k" = 25000, "30 thousand" = 30000, "1.5L" or "1.5 lakh" = 150000. Numeric or null.
- Status: Choose one of ["New", "Contacted", "Qualified", "Proposal Sent", "Won", "Lost"]. Default to "New".
- Confidence: For each field, indicate "high" if directly and explicitly stated, or "review" if inferred or ambiguous.

OUTPUT FORMAT:
Return a JSON object with this exact structure:
{
  "leads": [
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
    }
  ]
}`;
}

/**
 * Main parser for bulk unstructured lead text.
 * Returns an array of StructuredLeadDraft objects.
 */
export async function parseBulkUnstructuredLeadText(
  rawInput: string
): Promise<StructuredLeadDraft[]> {
  const text = (rawInput || "").trim();
  if (!text) {
    throw new AIServiceError("Please provide lead details to structure.");
  }

  // 1. Initial line/candidate splitting & limit check
  const candidateItems = splitIntoRawCandidateItems(text);

  // If more than MAX_BULK_LEADS_LIMIT detected, reject cleanly with user-friendly error
  if (candidateItems.length > MAX_BULK_LEADS_LIMIT) {
    throw new AIServiceError(
      `Maximum ${MAX_BULK_LEADS_LIMIT} leads allowed per paste. Detected ${candidateItems.length} leads. Please split into smaller batches.`
    );
  }

  // 2. Deterministic Parsing First
  // If there are candidate items and EVERY item can be deterministically parsed into a valid lead draft
  if (candidateItems.length > 0) {
    const deterministicDrafts: StructuredLeadDraft[] = [];
    let allSucceeded = true;

    for (const item of candidateItems) {
      const draft = tryDeterministicParseLine(item);
      if (draft && (draft.phone || draft.name)) {
        deterministicDrafts.push(draft);
      } else {
        allSucceeded = false;
        break;
      }
    }

    if (allSucceeded && deterministicDrafts.length === candidateItems.length) {
      if (deterministicDrafts.length > MAX_BULK_LEADS_LIMIT) {
        throw new AIServiceError(
          `Maximum ${MAX_BULK_LEADS_LIMIT} leads allowed per paste. Detected ${deterministicDrafts.length} leads. Please split into smaller batches.`
        );
      }
      return deterministicDrafts;
    }
  }

  // 3. Fallback to Groq Multi-Lead Structuring
  const timeContext = getReferenceDateTimeContext();
  const systemPrompt = buildBulkSystemPrompt(timeContext);

  const { rawJson } = await requestGroqJson({
    systemPrompt,
    userPrompt: `Extract all distinct structured leads from this text:\n\n"""\n${text}\n"""`,
    temperature: 0.1,
  });

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawJson);
  } catch {
    throw new AIServiceError("AI returned malformed output. Please retry or use Manual Entry.");
  }

  // Support either { leads: [...] } or direct array [...] or single object {...}
  let extractedLeads: GroqLeadExtraction[] = [];

  const bulkParsed = GroqBulkLeadExtractionSchema.safeParse(parsedJson);
  if (bulkParsed.success && Array.isArray(bulkParsed.data.leads)) {
    extractedLeads = bulkParsed.data.leads;
  } else if (Array.isArray(parsedJson)) {
    for (const item of parsedJson) {
      const single = GroqLeadExtractionSchema.safeParse(item);
      if (single.success) extractedLeads.push(single.data);
    }
  } else {
    const singleParsed = GroqLeadExtractionSchema.safeParse(parsedJson);
    if (singleParsed.success) {
      extractedLeads = [singleParsed.data];
    }
  }

  if (extractedLeads.length === 0) {
    throw new AIServiceError("Could not extract any leads from the text. Please check the input.");
  }

  if (extractedLeads.length > MAX_BULK_LEADS_LIMIT) {
    throw new AIServiceError(
      `Maximum ${MAX_BULK_LEADS_LIMIT} leads allowed per paste. Extracted ${extractedLeads.length} leads. Please split into smaller batches.`
    );
  }

  return extractedLeads.map((ext) => normalizeSingleLeadDraft(ext, text));
}
