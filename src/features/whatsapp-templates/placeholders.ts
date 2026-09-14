import type { PlaceholderInfo, WhatsAppComposerLead } from "./types";

export const SUPPORTED_PLACEHOLDERS: PlaceholderInfo[] = [
  {
    key: "{name}",
    label: "Lead Name",
    sampleValue: "Rahul Sharma",
    description: "Full name or first name of the lead",
  },
  {
    key: "{business}",
    label: "Business Name",
    sampleValue: "Apex Logistics",
    description: "Company or business name",
  },
  {
    key: "{requirement}",
    label: "Requirement",
    sampleValue: "Web App & CRM Solution",
    description: "Project or service requirement",
  },
  {
    key: "{budget}",
    label: "Budget",
    sampleValue: "₹45,000",
    description: "Budget or quotation amount",
  },
  {
    key: "{followUpDate}",
    label: "Follow-up Date",
    sampleValue: "Tomorrow, 16 Sep",
    description: "Scheduled follow-up date",
  },
  {
    key: "{followUpTime}",
    label: "Follow-up Time",
    sampleValue: "11:30 AM",
    description: "Scheduled follow-up time",
  },
];


export const ALLOWED_PLACEHOLDER_KEYS = new Set(SUPPORTED_PLACEHOLDERS.map((p) => p.key));

/**
 * Validates that template text only contains supported placeholders.
 * Returns null if valid, or an error message if unsupported placeholders are found.
 */
export function validateTemplatePlaceholders(text: string): string | null {
  if (!text) return null;
  const matches = text.match(/\{[^{}]+\}/g);
  if (!matches) return null;

  const unknown = matches.filter((m) => !ALLOWED_PLACEHOLDER_KEYS.has(m));
  if (unknown.length > 0) {
    const uniqueUnknown = Array.from(new Set(unknown));
    return `Unsupported placeholder(s): ${uniqueUnknown.join(", ")}. Allowed placeholders are: ${Array.from(
      ALLOWED_PLACEHOLDER_KEYS
    ).join(", ")}`;
  }

  return null;
}

/**
 * Formats a budget number or string cleanly in Indian Rupee notation
 */
export function formatBudget(budget: number | string | null | undefined): string | null {
  if (budget === null || budget === undefined || budget === "") return null;
  if (typeof budget === "number") {
    if (isNaN(budget) || budget <= 0) return null;
    return `₹${budget.toLocaleString("en-IN")}`;
  }
  const str = String(budget).trim();
  if (!str) return null;
  const num = Number(str.replace(/[^0-9.]/g, ""));
  if (!isNaN(num) && num > 0) {
    return `₹${num.toLocaleString("en-IN")}`;
  }
  return str;
}

/**
 * Renders a template message with lead data, ensuring natural degradation if values are missing.
 * Prevents awkward outputs like "Your budget is " or "at {business}".
 */
export function renderWhatsAppMessage(
  templateText: string,
  lead?: WhatsAppComposerLead | null
): string {
  if (!templateText) return "";
  let rendered = templateText;

  // 1. Lead Name
  const name = lead?.name?.trim() || "";
  if (name) {
    rendered = rendered.replaceAll("{name}", name);
  } else {
    // If name is missing, gracefully replace "{name}" with neutral greeting or omit
    rendered = rendered
      .replace(/Hi\s+\{name\},?/gi, "Hi,")
      .replace(/Hello\s+\{name\},?/gi, "Hello,")
      .replace(/Dear\s+\{name\},?/gi, "Hello,")
      .replaceAll("{name}", "there");
  }

  // 2. Business Name
  const business = lead?.business?.trim() || "";
  if (business) {
    rendered = rendered.replaceAll("{business}", business);
  } else {
    // Natural degradation for missing business:
    // e.g. "at {business}" -> ""
    // "for {business}" -> "for your business"
    rendered = rendered
      .replace(/(?:team\s+at|at)\s+\{business\}/gi, "your team")
      .replace(/for\s+\{business\}/gi, "for your business")
      .replaceAll("{business}", "your business");
  }

  // 3. Requirement
  const requirement = lead?.requirement?.trim() || "";
  if (requirement) {
    rendered = rendered.replaceAll("{requirement}", requirement);
  } else {
    rendered = rendered
      .replace(/regarding\s+(?:your\s+)?\{requirement\}/gi, "regarding your requirement")
      .replace(/for\s+(?:your\s+)?\{requirement\}/gi, "for your project")
      .replaceAll("{requirement}", "your project");
  }

  // 4. Budget
  const budgetFormatted = formatBudget(lead?.budget);
  if (budgetFormatted) {
    rendered = rendered.replaceAll("{budget}", budgetFormatted);
  } else {
    // Natural degradation for missing budget:
    // "Your budget is {budget}." -> ""
    // "with a budget of {budget}" -> ""
    // "for your budget of {budget}" -> ""
    // "budget of {budget}" -> ""
    rendered = rendered
      .replace(/(?:Your|The)?\s*budget\s+is\s+\{budget\}[.,]?\s*/gi, "")
      .replace(/(?:with|for)\s+a\s+budget\s+of\s+\{budget\}[.,]?\s*/gi, "")
      .replace(/for\s+your\s+budget\s+of\s+\{budget\}[.,]?\s*/gi, "")
      .replace(/budget\s*(?::|of|-)\s*\{budget\}[.,]?\s*/gi, "")
      .replace(/around\s+\{budget\}[.,]?\s*/gi, "")
      .replaceAll("{budget}", "discussed budget");
  }

  // 5. Follow-up Date & Time
  const followUpDate = lead?.followUpDate?.trim() || "";
  const followUpTime = lead?.followUpTime?.trim() || "";

  if (followUpDate) {
    rendered = rendered.replaceAll("{followUpDate}", followUpDate);
  } else {
    rendered = rendered
      .replace(/on\s+\{followUpDate\}/gi, "soon")
      .replaceAll("{followUpDate}", "our upcoming discussion");
  }

  if (followUpTime) {
    rendered = rendered.replaceAll("{followUpTime}", followUpTime);
  } else {
    rendered = rendered
      .replace(/at\s+\{followUpTime\}/gi, "")
      .replaceAll("{followUpTime}", "convenient time");
  }

  // Final cleanup: collapse extra spaces and clean dangling punctuation
  rendered = rendered
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ \./g, ".")
    .replace(/ ,/g, ",")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();

  return rendered;
/**
 * Sample preview map for visual demonstration in template manager
 */
export const SAMPLE_PREVIEW_VALUES: Record<string, string> = {
  "{name}": "Rahul",
  "{business}": "Apex Logistics",
  "{requirement}": "Custom CRM System",
  "{budget}": "₹45,000",
  "{followUpDate}": "Tomorrow (16 Sep)",
  "{followUpTime}": "11:30 AM",
};

/**
 * Replaces placeholders with values from a given lead or fallback preview values
 */
export function interpolatePlaceholders(
  templateText: string,
  lead?: WhatsAppComposerLead | null,
  fallbackToSamples = true
): string {
  if (!templateText) return "";

  if (lead) {
     return renderWhatsAppMessage(templateText, lead);
  }

  if (fallbackToSamples) {
    let result = templateText;
    for (const [key, value] of Object.entries(SAMPLE_PREVIEW_VALUES)) {
      result = result.replaceAll(key, value);
    }
    return result;
  }
  return templateText;
}
