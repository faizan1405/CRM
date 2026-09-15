export function parseBudget(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;

  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0 || input > 9_999_999_999.99) return null;
    return Math.round(input * 100) / 100;
  }

  const str = String(input).trim();
  if (!str) return null;

  // Clean currency symbols and prefixes
  const normalized = str
    .replace(/[₹$,]/g, "")
    .replace(/(?:rs\.?|inr)/gi, "")
    .replace(/\b(around|approx|approximately|budget|upto|up to|nearly)\b/gi, "")
    .trim();

  // 1) Check for Lakhs / L: e.g. "1.5L", "2 lakh", "2.5 lakhs"
  const lakhMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:lakhs?|l)\b/i);
  if (lakhMatch && lakhMatch[1]) {
    const val = Number(lakhMatch[1]) * 100_000;
    return val <= 9_999_999_999.99 ? val : null;
  }

  // 2) Check for Thousands / K: e.g. "25k", "25 K", "30 thousand"
  const kMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:k|thousand)\b/i);
  if (kMatch && kMatch[1]) {
    const val = Number(kMatch[1]) * 1_000;
    return val <= 9_999_999_999.99 ? val : null;
  }

  // 3) Plain numeric or decimal: e.g. "25000", "50000.00"
  const numMatch = normalized.match(/^(\d+(?:\.\d{1,2})?)$/);
  if (numMatch && numMatch[1]) {
    const val = Number(numMatch[1]);
    if (Number.isFinite(val) && val >= 0 && val <= 9_999_999_999.99) {
      return val;
    }
  }

  return null;
}

export function extractPotentialBudget(text: string): number | null {
  if (!text) return null;

  const regex = /(?:(?:around|approx|budget|quote|quoted)?\s*(?:₹|Rs\.?|INR)?\s*(\d+(?:\.\d+)?)\s*(?:k|thousand|lakhs?|l)\b)|(?:(?:₹|Rs\.?)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?))/i;
  const match = text.match(regex);
  if (match) {
    return parseBudget(match[0]);
  }

  return null;
}
