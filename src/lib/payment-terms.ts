/**
 * Canonical Business Payment Terms Configuration
 *
 * Single source of truth for commercial payment terms across all
 * newly generated WhatsApp messaging, packages, proposals, and sales collaterals.
 */

export interface PaymentTermsConfig {
  advancePercent: number;
  finalPercent: number;
  finalTiming: string;
}

export const DEFAULT_PAYMENT_TERMS: PaymentTermsConfig = Object.freeze({
  advancePercent: 30,
  finalPercent: 70,
  finalTiming: "before final delivery",
});

let currentPaymentTerms: PaymentTermsConfig = { ...DEFAULT_PAYMENT_TERMS };

/**
 * Proxy object for direct property access (e.g. PAYMENT_TERMS.advancePercent)
 * while keeping reactive mutations synchronized.
 */
export const PAYMENT_TERMS: PaymentTermsConfig = new Proxy(
  { ...DEFAULT_PAYMENT_TERMS },
  {
    get(_target, prop) {
      return currentPaymentTerms[prop as keyof PaymentTermsConfig];
    },
    set(_target, prop, value) {
      (currentPaymentTerms as unknown as Record<string, unknown>)[prop as string] = value;
      return true;
    },
  }
);

/**
 * Returns the current canonical payment terms.
 */
export function getPaymentTerms(): PaymentTermsConfig {
  return currentPaymentTerms;
}

/**
 * Updates the canonical payment terms dynamically.
 * All newly generated messages automatically reflect the updated values.
 */
export function setPaymentTerms(terms: Partial<PaymentTermsConfig>): PaymentTermsConfig {
  currentPaymentTerms = {
    ...currentPaymentTerms,
    ...terms,
  };
  return currentPaymentTerms;
}

/**
 * Restores canonical payment terms to default:
 * 30% advance and 70% before final delivery.
 */
export function resetPaymentTerms(): PaymentTermsConfig {
  currentPaymentTerms = { ...DEFAULT_PAYMENT_TERMS };
  return currentPaymentTerms;
}

/**
 * Returns the canonical payment terms sentence:
 * "Payment Terms: 30% advance and 70% before final delivery."
 */
export function formatPaymentTermsSentence(terms: PaymentTermsConfig = getPaymentTerms()): string {
  return `Payment Terms: ${terms.advancePercent}% advance and ${terms.finalPercent}% ${terms.finalTiming}.`;
}

/**
 * Returns the canonical payment terms breakdown text:
 * "30% advance and 70% before final delivery"
 */
export function formatPaymentTermsText(terms: PaymentTermsConfig = getPaymentTerms()): string {
  return `${terms.advancePercent}% advance and ${terms.finalPercent}% ${terms.finalTiming}`;
}

/**
 * Checks whether text already contains payment terms to prevent duplicate insertion.
 */
export function hasPaymentTerms(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  if (lower.includes("payment terms")) return true;
  if (/advance.*(?:delivery|handover|completion)/i.test(text)) return true;
  if (/\d+%\s*advance/i.test(text) && /\d+%/i.test(text)) return true;
  return false;
}

/**
 * Determines whether a message or template is relevant for payment terms.
 *
 * Relevant messages:
 * - Package / Pricing messages
 * - Proposal / quotation-related messages
 * - Deal confirmation messages
 * - Custom package/business offer messages where payment terms are relevant
 * - Other current sales templates that explicitly discuss price, deal amount, proposal, or project confirmation
 *
 * Excluded:
 * - Introduction
 * - Call-back
 * - Simple follow-up
 * - Website sample sharing
 * - Casual custom messages
 * - Messages where payment/pricing is unrelated
 */
export function isPaymentTermsRelevant({
  title,
  category,
  content,
}: {
  title?: string;
  category?: string;
  content?: string;
}): boolean {
  const t = (title || "").toLowerCase().trim();
  const c = (category || "").toLowerCase().trim();
  const body = (content || "").toLowerCase();

  // 1. Explicit Exclusions
  const excludedTitles = [
    "introduction",
    "initial outreach",
    "call-back",
    "callback",
    "post-call summary",
    "website samples",
    "simple follow-up",
    "no response check-in",
    "final follow-up / break-up",
    "final follow-up",
  ];
  if (excludedTitles.includes(t)) {
    return false;
  }

  // Simple follow-up exclusion: only include if explicitly discussing quotation/proposal/pricing
  if (t === "follow-up" || t === "follow up") {
    const hasExplicitCommercial =
      body.includes("proposal") ||
      body.includes("quotation") ||
      body.includes("package") ||
      body.includes("pricing");
    if (!hasExplicitCommercial) {
      return false;
    }
  }

  // 2. Explicit Inclusions by Title
  if (
    t.includes("package") ||
    t.includes("pricing") ||
    t.includes("proposal") ||
    t.includes("quotation") ||
    t.includes("quote") ||
    t.includes("deal confirmation") ||
    t.includes("project confirmation") ||
    t.includes("commercial offer")
  ) {
    return true;
  }

  // 3. Inclusions by Category
  if (
    c === "quotation_sent" ||
    c === "quotation_followup" ||
    c === "quotation_follow_up" ||
    c === "proposal"
  ) {
    return true;
  }

  // 4. Inclusions by Dynamic Placeholder
  if (
    body.includes("{{packagepricinglinks}}") ||
    body.includes("{paymentterms}") ||
    body.includes("{{paymentterms}}")
  ) {
    return true;
  }

  // 5. Inclusions by Commercial Content (price, quote, or project confirmation)
  const mentionsCommercialIntent =
    body.includes("proposal") ||
    body.includes("quotation") ||
    body.includes("formal quote") ||
    body.includes("commercial offer") ||
    body.includes("project confirmation") ||
    body.includes("deal confirmation");

  const mentionsPriceOrBudget =
    body.includes("₹") ||
    body.includes("budget") ||
    body.includes("package") ||
    body.includes("quotedamount") ||
    body.includes("investment");

  if (mentionsCommercialIntent && mentionsPriceOrBudget) {
    return true;
  }

  return false;
}

/**
 * Safely attaches canonical payment terms to a message if relevant and not already present.
 */
export function attachPaymentTermsIfRelevant(
  message: string,
  context: { title?: string; category?: string }
): string {
  if (!message || !message.trim()) return message;
  if (hasPaymentTerms(message)) return message;
  if (!isPaymentTermsRelevant({ title: context.title, category: context.category, content: message })) {
    return message;
  }

  const termsSentence = formatPaymentTermsSentence();
  return `${message.trim()}\n\n${termsSentence}`;
}
