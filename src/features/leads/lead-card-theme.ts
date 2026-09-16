export type LeadVisualState =
  | "LOST"
  | "WASTE"
  | "WON"
  | "FOLLOW_UP_NOW"
  | "FUTURE_FOLLOW_UP"
  | "PROPOSAL_SENT"
  | "QUALIFIED"
  | "CONTACTED"
  | "NEW";

export type LeadLike = {
  status?: string | null;
  quickStatus?: string | null;
  isWaste?: boolean | null;
  operationalState?: string | null;
  nextFollowUpDate?: string | Date | null;
  followUps?: Array<{ scheduledAt: string | Date; status: string }>;
};

export type LeadTheme = {
  state: LeadVisualState;
  cardBg: string;
  leftBorder: string;
  borderBase: string;
  badgeLabel: string;
  badgeClass: string;
  accentColor:
    | "sky"
    | "emerald"
    | "amber"
    | "fuchsia"
    | "violet"
    | "indigo"
    | "rose"
    | "neutral";
  dotClass: string;
  hoverBorder: string;
};

export function getKolkataDateString(dateInput: Date | string): string | null {
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    if (!y || !m || !day) return null;
    return `${y}-${m}-${day}`;
  } catch {
    return null;
  }
}

/**
 * Visual Precedence:
 * 1. LOST
 * 2. WASTE
 * 3. WON
 * 4. FOLLOW_UP_NOW
 * 5. FUTURE_FOLLOW_UP
 * 6. PROPOSAL_SENT
 * 7. INTERESTED / QUALIFIED
 * 8. CALL_NOT_PICK
 * 9. CALL_AGAIN
 * 10. CONTACTED
 * 11. NEW
 */
export function getLeadVisualState(lead: LeadLike): LeadVisualState {
  const statusUpper = (lead.status || "").trim().toUpperCase().replace(/\s+/g, "_");
  const quickUpper = (lead.quickStatus || "").trim().toUpperCase();
  const opState = lead.operationalState;

  // 1. LOST
  if (statusUpper === "LOST" || quickUpper === "LOST" || opState === "LOST") {
    return "LOST";
  }

  // 2. WASTE
  if (lead.isWaste === true || opState === "WASTE") {
    return "WASTE";
  }

  // 3. WON
  if (statusUpper === "WON" || quickUpper === "WON") {
    return "WON";
  }

  // 4 & 5. FOLLOW_UP_NOW & FUTURE_FOLLOW_UP
  if (opState === "FOLLOW_UP_NOW") {
    return "FOLLOW_UP_NOW";
  }
  if (opState === "FUTURE_FOLLOW_UP") {
    return "FUTURE_FOLLOW_UP";
  }

  const todayStr = getKolkataDateString(new Date());

  if (lead.followUps && lead.followUps.length > 0 && todayStr) {
    const pending = lead.followUps.filter(
      (f) => f.status === "PENDING" || f.status === "Pending"
    );
    const hasOverdueOrToday = pending.some((f) => {
      const scheduledStr = getKolkataDateString(f.scheduledAt);
      return scheduledStr ? scheduledStr <= todayStr : false;
    });
    if (hasOverdueOrToday) {
      return "FOLLOW_UP_NOW";
    }
    const hasFuture = pending.some((f) => {
      const scheduledStr = getKolkataDateString(f.scheduledAt);
      return scheduledStr ? scheduledStr > todayStr : false;
    });
    if (hasFuture) {
      return "FUTURE_FOLLOW_UP";
    }
  }

  if (lead.nextFollowUpDate && todayStr) {
    const nextStr = getKolkataDateString(lead.nextFollowUpDate);
    if (nextStr) {
      if (nextStr <= todayStr) {
        return "FOLLOW_UP_NOW";
      } else {
        return "FUTURE_FOLLOW_UP";
      }
    }
  }

  // 6. PROPOSAL_SENT
  if (statusUpper === "PROPOSAL_SENT") {
    return "PROPOSAL_SENT";
  }

  // 7. QUALIFIED
  if (statusUpper === "QUALIFIED") {
    return "QUALIFIED";
  }

  // 8. CONTACTED
  if (statusUpper === "CONTACTED" || quickUpper === "CONTACTED") {
    return "CONTACTED";
  }

  // 9. NEW
  return "NEW";
}

export const LEAD_THEMES: Record<LeadVisualState, LeadTheme> = {
  NEW: {
    state: "NEW",
    cardBg: "bg-sky-50/40",
    leftBorder: "border-l-4 border-l-sky-500",
    borderBase: "border-slate-200/80",
    badgeLabel: "New",
    badgeClass: "bg-sky-100 text-sky-800 ring-1 ring-inset ring-sky-200",
    accentColor: "sky",
    dotClass: "bg-sky-500",
    hoverBorder: "hover:border-sky-300",
  },
  FOLLOW_UP_NOW: {
    state: "FOLLOW_UP_NOW",
    cardBg: "bg-emerald-50/40",
    leftBorder: "border-l-4 border-l-emerald-500",
    borderBase: "border-slate-200/80",
    badgeLabel: "Follow up now",
    badgeClass: "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200",
    accentColor: "emerald",
    dotClass: "bg-emerald-500",
    hoverBorder: "hover:border-emerald-300",
  },
  FUTURE_FOLLOW_UP: {
    state: "FUTURE_FOLLOW_UP",
    cardBg: "bg-amber-50/40",
    leftBorder: "border-l-4 border-l-amber-500",
    borderBase: "border-slate-200/80",
    badgeLabel: "Future follow-up",
    badgeClass: "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200",
    accentColor: "amber",
    dotClass: "bg-amber-500",
    hoverBorder: "hover:border-amber-300",
  },
  QUALIFIED: {
    state: "QUALIFIED",
    cardBg: "bg-fuchsia-50/40",
    leftBorder: "border-l-4 border-l-fuchsia-500",
    borderBase: "border-slate-200/80",
    badgeLabel: "Qualified",
    badgeClass: "bg-fuchsia-100 text-fuchsia-800 ring-1 ring-inset ring-fuchsia-200",
    accentColor: "fuchsia",
    dotClass: "bg-fuchsia-500",
    hoverBorder: "hover:border-fuchsia-300",
  },
  CONTACTED: {
    state: "CONTACTED",
    cardBg: "bg-violet-50/30",
    leftBorder: "border-l-4 border-l-violet-400",
    borderBase: "border-slate-200/80",
    badgeLabel: "Contacted",
    badgeClass: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200",
    accentColor: "violet",
    dotClass: "bg-violet-400",
    hoverBorder: "hover:border-violet-300",
  },
  PROPOSAL_SENT: {
    state: "PROPOSAL_SENT",
    cardBg: "bg-indigo-50/40",
    leftBorder: "border-l-4 border-l-indigo-500",
    borderBase: "border-slate-200/80",
    badgeLabel: "Proposal sent",
    badgeClass: "bg-indigo-100 text-indigo-800 ring-1 ring-inset ring-indigo-200",
    accentColor: "indigo",
    dotClass: "bg-indigo-500",
    hoverBorder: "hover:border-indigo-300",
  },
  WON: {
    state: "WON",
    cardBg: "bg-emerald-50/50",
    leftBorder: "border-l-4 border-l-emerald-600",
    borderBase: "border-slate-200/80",
    badgeLabel: "Won",
    badgeClass: "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-300",
    accentColor: "emerald",
    dotClass: "bg-emerald-600",
    hoverBorder: "hover:border-emerald-400",
  },
  LOST: {
    state: "LOST",
    cardBg: "bg-rose-50/40",
    leftBorder: "border-l-4 border-l-rose-500",
    borderBase: "border-slate-200/80",
    badgeLabel: "Lost",
    badgeClass: "bg-rose-100 text-rose-800 ring-1 ring-inset ring-rose-200",
    accentColor: "rose",
    dotClass: "bg-rose-500",
    hoverBorder: "hover:border-rose-300",
  },
  WASTE: {
    state: "WASTE",
    cardBg: "bg-slate-50/70",
    leftBorder: "border-l-4 border-l-slate-400",
    borderBase: "border-slate-200/80",
    badgeLabel: "Waste",
    badgeClass: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
    accentColor: "neutral",
    dotClass: "bg-slate-400",
    hoverBorder: "hover:border-slate-300",
  },
};

export function getLeadCardTheme(lead: LeadLike): LeadTheme {
  const visualState = getLeadVisualState(lead);
  return LEAD_THEMES[visualState];
}
