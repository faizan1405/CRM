export type NormalizedPhone = {
  raw: string;
  display: string;
  comparisonDigits: string;
  whatsappDigits: string;
  isIndian: boolean;
  isValid: boolean;
};

export function normalizePhone(input: string | null | undefined): NormalizedPhone | null {
  if (!input || typeof input !== "string") return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  const allDigits = trimmed.replace(/\D/g, "");
  if (!allDigits || allDigits.length < 7) {
    return {
      raw: trimmed,
      display: trimmed,
      comparisonDigits: allDigits,
      whatsappDigits: allDigits,
      isIndian: false,
      isValid: false,
    };
  }

  // 1) Indian 10-digit: 10 digits starting with 6, 7, 8, or 9
  if (allDigits.length === 10 && /^[6-9]\d{9}$/.test(allDigits)) {
    const p1 = allDigits.slice(0, 5);
    const p2 = allDigits.slice(5);
    return {
      raw: trimmed,
      display: `+91 ${p1} ${p2}`,
      comparisonDigits: allDigits,
      whatsappDigits: `91${allDigits}`,
      isIndian: true,
      isValid: true,
    };
  }

  // 2) Indian 11-digit with leading 0: 09876543210
  if (allDigits.length === 11 && allDigits.startsWith("0") && /^[6-9]/.test(allDigits.slice(1))) {
    const tenDigits = allDigits.slice(1);
    const p1 = tenDigits.slice(0, 5);
    const p2 = tenDigits.slice(5);
    return {
      raw: trimmed,
      display: `+91 ${p1} ${p2}`,
      comparisonDigits: tenDigits,
      whatsappDigits: `91${tenDigits}`,
      isIndian: true,
      isValid: true,
    };
  }

  // 3) Indian 12-digit with 91 prefix: 919876543210 or +919876543210
  if (allDigits.length === 12 && allDigits.startsWith("91") && /^[6-9]/.test(allDigits.slice(2))) {
    const tenDigits = allDigits.slice(2);
    const p1 = tenDigits.slice(0, 5);
    const p2 = tenDigits.slice(5);
    return {
      raw: trimmed,
      display: `+91 ${p1} ${p2}`,
      comparisonDigits: tenDigits,
      whatsappDigits: allDigits,
      isIndian: true,
      isValid: true,
    };
  }

  // 4) International numbers
  const startsWithPlus = trimmed.startsWith("+");
  const display = startsWithPlus ? `+${allDigits}` : trimmed;

  return {
    raw: trimmed,
    display,
    comparisonDigits: allDigits,
    whatsappDigits: allDigits,
    isIndian: false,
    isValid: allDigits.length >= 7 && allDigits.length <= 15,
  };
}

export function extractPotentialPhone(text: string): string | null {
  if (!text) return null;

  const plus91Match = text.match(/(?:\+91|91)[\s\-]?[6-9]\d{4}[\s\-]?\d{5}\b/);
  if (plus91Match) return plus91Match[0];

  const zeroMatch = text.match(/\b0[6-9]\d{4}[\s\-]?\d{5}\b/);
  if (zeroMatch) return zeroMatch[0];

  const plainMatch = text.match(/\b[6-9]\d{4}[\s\-]?\d{5}\b/);
  if (plainMatch) return plainMatch[0];

  const intlMatch = text.match(/\+\d{1,3}[\s\-]?\d{2,4}[\s\-]?\d{3,4}[\s\-]?\d{0,4}\b/);
  if (intlMatch) return intlMatch[0];

  return null;
}
