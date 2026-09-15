import { normalizePhone } from "@/features/leads/ai-parser/phone-utils";
import { parseBudget } from "@/features/leads/ai-parser/budget-utils";
import type { MetaLeadRawResponse, NormalizedMetaLead } from "../types";

function cleanKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function getFieldValue(rawValues?: string[]): string | null {
  if (!rawValues || rawValues.length === 0) return null;
  const first = rawValues[0]?.trim();
  return first || null;
}

export function normalizeMetaLeadPayload(raw: MetaLeadRawResponse): NormalizedMetaLead {
  const metaLeadId = raw.id;
  const fieldData = raw.field_data || [];

  const fieldMap = new Map<string, string>();
  for (const item of fieldData) {
    const val = getFieldValue(item.values);
    if (val) {
      fieldMap.set(cleanKey(item.name), val);
    }
  }

  // 1. Resolve Name
  let name: string | null = null;
  const nameKeys = ["full_name", "name", "your_name", "contact_name", "client_name"];
  for (const key of nameKeys) {
    if (fieldMap.has(key)) {
      name = fieldMap.get(key)!;
      break;
    }
  }

  if (!name) {
    const firstName = fieldMap.get("first_name") || "";
    const lastName = fieldMap.get("last_name") || "";
    if (firstName || lastName) {
      name = `${firstName} ${lastName}`.trim();
    }
  }

  if (!name) {
    name = `Meta Lead ${metaLeadId.slice(-6)}`;
  }

  // 2. Resolve Phone
  let phone = "";
  const phoneKeys = [
    "phone_number",
    "phone",
    "mobile_number",
    "mobile",
    "contact_number",
    "whatsapp_number",
    "phone_no",
  ];
  for (const key of phoneKeys) {
    if (fieldMap.has(key)) {
      phone = fieldMap.get(key)!;
      break;
    }
  }

  // Normalize phone if present
  if (phone) {
    const phoneNorm = normalizePhone(phone);
    if (phoneNorm?.raw) {
      phone = phoneNorm.raw;
    }
  } else {
    // If Meta ad form had no phone
    phone = "Not Provided";
  }

  // 3. Resolve Email
  let email: string | null = null;
  const emailKeys = ["email", "email_address", "work_email", "contact_email", "your_email"];
  for (const key of emailKeys) {
    if (fieldMap.has(key)) {
      email = fieldMap.get(key)!.toLowerCase();
      break;
    }
  }

  // 4. Resolve Business / Company
  let business: string | null = null;
  const businessKeys = [
    "company_name",
    "business_name",
    "company",
    "business",
    "organization_name",
    "organization",
    "agency_name",
    "firm_name",
  ];
  for (const key of businessKeys) {
    if (fieldMap.has(key)) {
      business = fieldMap.get(key)!;
      break;
    }
  }

  // 5. Resolve Industry
  let industry: string | null = null;
  const industryKeys = ["industry", "business_type", "sector", "domain", "niche"];
  for (const key of industryKeys) {
    if (fieldMap.has(key)) {
      industry = fieldMap.get(key)!;
      break;
    }
  }

  // 6. Resolve Budget
  let budget: number | null = null;
  const budgetKeys = ["budget", "estimated_budget", "project_budget", "investment_capacity", "annual_budget"];
  for (const key of budgetKeys) {
    if (fieldMap.has(key)) {
      budget = parseBudget(fieldMap.get(key)!);
      if (budget !== null) break;
    }
  }

  // 7. Custom Questions & Answers
  const standardKeyPrefixes = new Set([
    "full_name",
    "name",
    "your_name",
    "contact_name",
    "client_name",
    "first_name",
    "last_name",
    "phone_number",
    "phone",
    "mobile_number",
    "mobile",
    "contact_number",
    "whatsapp_number",
    "phone_no",
    "email",
    "email_address",
    "work_email",
    "contact_email",
    "your_email",
    "company_name",
    "business_name",
    "company",
    "business",
    "organization_name",
    "organization",
    "agency_name",
    "firm_name",
    "industry",
    "business_type",
    "sector",
    "domain",
    "niche",
    "budget",
    "estimated_budget",
    "project_budget",
    "investment_capacity",
    "annual_budget",
  ]);

  const customAnswers: Record<string, string> = {};
  for (const item of fieldData) {
    const k = cleanKey(item.name);
    if (!standardKeyPrefixes.has(k)) {
      const val = getFieldValue(item.values);
      if (val) {
        customAnswers[item.name] = val;
      }
    }
  }

  // Build notes
  const notesLines: string[] = [];
  
  if (raw.campaign_name || raw.ad_name || raw.form_id) {
    notesLines.push("📌 [Meta Ad Details]");
    if (raw.campaign_name) notesLines.push(`• Campaign: ${raw.campaign_name}`);
    if (raw.adset_name) notesLines.push(`• Ad Set: ${raw.adset_name}`);
    if (raw.ad_name) notesLines.push(`• Ad: ${raw.ad_name}`);
    if (raw.form_id) notesLines.push(`• Form ID: ${raw.form_id}`);
  }

  const customEntries = Object.entries(customAnswers);
  if (customEntries.length > 0) {
    if (notesLines.length > 0) notesLines.push("");
    notesLines.push("📋 [Form Questions]");
    for (const [q, a] of customEntries) {
      notesLines.push(`• ${q}: ${a}`);
    }
  }

  const notes = notesLines.length > 0 ? notesLines.join("\n") : null;

  return {
    metaLeadId,
    name,
    phone,
    email,
    business,
    industry,
    budget,
    notes,
    formId: raw.form_id || null,
    pageId: raw.page_id || null,
    adId: raw.ad_id || null,
    adsetId: raw.adset_id || null,
    campaignId: raw.campaign_id || null,
    customAnswers,
  };
}
