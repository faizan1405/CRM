export const typeStyles: Record<string, { bg: string; text: string }> = {
  Call: { bg: "bg-blue-50", text: "text-blue-700" },
  WhatsApp: { bg: "bg-emerald-50", text: "text-emerald-700" },
  Email: { bg: "bg-violet-50", text: "text-violet-700" },
  Other: { bg: "bg-slate-100", text: "text-slate-600" },
};

export function getTypeIcon(type: string): string {
  switch (type) {
    case "Call": return "\u{1F4DE}";
    case "WhatsApp": return "\u{1F4AC}";
    case "Email": return "\u{2709}\u{FE0F}";
    default: return "\u{1F4CB}";
  }
}
