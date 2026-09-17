const DEFAULT_FOLLOW_UP = "this is Faizan from Scale Flow. I’m following up regarding your website requirement.";

export function getTelephoneHref(phone: string) {
  const normalized = phone.trim().replace(/(?!^\+)\D/g, "");
  return `tel:${normalized}`;
}

/**
 * @deprecated Use WhatsAppButton or useWhatsApp().openWhatsApp instead for the global template picker.
 */
export function getWhatsAppHref(phone: string, name?: string, message?: string) {
  const number = phone.replace(/\D/g, "");
  const greeting = name?.trim() ? `Hi ${name.trim()}` : "Hi there";
  const text = message?.trim() || `${greeting}, ${DEFAULT_FOLLOW_UP}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
