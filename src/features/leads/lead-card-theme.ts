import type { LeadStatus } from "@/features/leads/types";

export type LeadVisualState =
  | "LOST"
  | "WASTE"
  | "WON"
  | "FOLLOW_UP_NOW"
  | "FUTURE_FOLLOW_UP"
  | "PROPOSAL_SENT"
  | "INTERESTED"
  | "CALL_NOT_PICK"
  | "CALL_AGAIN"
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
    | "blue"
    | "green"
    | "yellow"
    | "purple"
    | "lavender"
    | "pink"
    | "violet"
    | "indigo"
    | "emerald"
    | "red"
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

  // 7. INTERESTED / QUALIFIED
  if (quickUpper === "INTERESTED" || statusUpper === "QUALIFIED") {
    return "INTERESTED";
  }

  // 8. CALL_NOT_PICK
  if (quickUpper === "CALL_NOT_PICK") {
    return "CALL_NOT_PICK";
  }

  // 9. CALL_AGAIN
  if (quickUpper === "CALL_AGAIN") {
    return "CALL_AGAIN";
  }

  // 10. CONTACTED
  if (quickUpper === "CONTACTED" || statusUpper === "CONTACTED") {
    return "CONTACTED";
  }

  // 11. NEW
  return "NEW";
}

export const LEAD_THEMES: Record<LeadVisualState, LeadTheme> = {
  NEW: {
    state: "NEW",
    cardBg: "bg-blue-50/40",
    leftBorder: "border-l-4 border-l-blue-500",
    borderBase: "border-slate-200/80",
    badgeLabel: "New",
    badgeClass: "bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-200",
    accentColor: "blue",
    dotClass: "bg-blue-500",
    hoverBorder: "hover:border-blue-300",
  },
  FOLLOW_UP_NOW: {
    state: "FOLLOW_UP_NOW",
    cardBg: "bg-emerald-50/40",
    leftBorder: "border-l-4 border-l-emerald-500",
    borderBase: "border-slate-200/80",
    badgeLabel: "Follow up now",
    badgeClass: "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200",
    accentColor: "green",
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
    accentColor: "yellow",
    dotClass: "bg-amber-500",
    hoverBorder: "hover:border-amber-300",
  },
  INTERESTED: {
    state: "INTERESTED",
    cardBg: "bg-purple-50/40",
    leftBorder: "border-l-4 border-l-purple-500",
    borderBase: "border-slate-200/80",
    badgeLabel: "Interested",
    badgeClass: "bg-purple-100 text-purple-800 ring-1 ring-inset ring-purple-200",
    accentColor: "purple",
    dotClass: "bg-purple-500",
    hoverBorder: "hover:border-purple-300",
  },
  CONTACTED: {
    state: "CONTACTED",
    cardBg: "bg-indigo-50/30",
    leftBorder: "border-l-4 border-l-indigo-400",
    borderBase: "border-slate-200/80",
    badgeLabel: "Contacted",
    badgeClass: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200",
    accentColor: "lavender",
    dotClass: "bg-indigo-400",
    hoverBorder: "hover:border-indigo-300",
  },
  CALL_NOT_PICK: {
    state: "CALL_NOT_PICK",
    cardBg: "bg-pink-50/40",
    leftBorder: "border-l-4 border-l-pink-500",
    borderBase: "border-slate-200/80",
    badgeLabel: "Call not pick",
    badgeClass: "bg-pink-100 text-pink-800 ring-1 ring-inset ring-pink-200",
    accentColor: "pink",
    dotClass: "bg-pink-400",
    hoverBorder: "hover:border-pink-300",
  },
  CALL_AGAIN: {
    state: "CALL_AGAIN",
    cardBg: "bg-violet-50/40",
    leftBorder: "border-l-4 border-l-violet-500",
    borderBase: "border-slate-200/80",
    badgeLabel: "Call again",
    badgeClass: "bg-violet-100 text-violet-800 ring-1 ring-inset ring-violet-200",
    accentColor: "violet",
    dotClass: "bg-violet-500",
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
    accentColor: "red",
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

export type CanonicalLeadTheme = {
  status: LeadStatus;
  rowBg: string;
  rowHoverBg: string;
  cardBg: string;
  cardHoverBg: string;
  leftBorder: string;
  borderBase: string;
  hoverBorder: string;
  accentColor: "blue" | "slate" | "purple" | "amber" | "green" | "red";
};

export const CANONICAL_LEAD_THEMES: Record<LeadStatus, CanonicalLeadTheme> = {
  New: {
    status: "New",
    rowBg: "bg-blue-50/40",
    rowHoverBg: "hover:bg-blue-50/70",
    cardBg: "bg-blue-50/40",
    cardHoverBg: "hover:bg-blue-50/70",
    leftBorder: "border-l-4 border-l-blue-500",
    borderBase: "border-blue-200/60",
    hoverBorder: "hover:border-blue-300",
    accentColor: "blue",
  },
  Contacted: {
    status: "Contacted",
    rowBg: "bg-slate-50/60",
    rowHoverBg: "hover:bg-slate-100/70",
    cardBg: "bg-slate-50/60",
    cardHoverBg: "hover:bg-slate-100/70",
    leftBorder: "border-l-4 border-l-slate-400",
    borderBase: "border-slate-200/80",
    hoverBorder: "hover:border-slate-300",
    accentColor: "slate",
  },
  Qualified: {
    status: "Qualified",
    rowBg: "bg-purple-50/35",
    rowHoverBg: "hover:bg-purple-50/70",
    cardBg: "bg-purple-50/40",
    cardHoverBg: "hover:bg-purple-50/70",
    leftBorder: "border-l-4 border-l-purple-500",
    borderBase: "border-purple-200/60",
    hoverBorder: "hover:border-purple-300",
    accentColor: "purple",
  },
  "Proposal Sent": {
    status: "Proposal Sent",
    rowBg: "bg-amber-50/40",
    rowHoverBg: "hover:bg-amber-50/70",
    cardBg: "bg-amber-50/40",
    cardHoverBg: "hover:bg-amber-50/70",
    leftBorder: "border-l-4 border-l-amber-500",
    borderBase: "border-amber-200/60",
    hoverBorder: "hover:border-amber-300",
    accentColor: "amber",
  },
  Won: {
    status: "Won",
    rowBg: "bg-emerald-50/35",
    rowHoverBg: "hover:bg-emerald-50/70",
    cardBg: "bg-emerald-50/45",
    cardHoverBg: "hover:bg-emerald-50/70",
    leftBorder: "border-l-4 border-l-emerald-600",
    borderBase: "border-emerald-200/60",
    hoverBorder: "hover:border-emerald-400",
    accentColor: "green",
  },
  Lost: {
    status: "Lost",
    rowBg: "bg-rose-50/35",
    rowHoverBg: "hover:bg-rose-50/70",
    cardBg: "bg-rose-50/40",
    cardHoverBg: "hover:bg-rose-50/70",
    leftBorder: "border-l-4 border-l-rose-500",
    borderBase: "border-rose-200/60",
    hoverBorder: "hover:border-rose-300",
    accentColor: "red",
  },
};

export function normalizeCanonicalStatus(status?: string | null): LeadStatus {
  if (!status) return "New";
  const s = status.trim().toUpperCase().replace(/\s+/g, "_");
  if (s === "CONTACTED") return "Contacted";
  if (s === "QUALIFIED" || s === "INTERESTED") return "Qualified";
  if (s === "PROPOSAL_SENT" || s === "PROPOSAL") return "Proposal Sent";
  if (s === "WON") return "Won";
  if (s === "LOST") return "Lost";
  return "New";
}

export function getCanonicalLeadTheme(
  statusOrLead?: LeadStatus | LeadLike | string | null
): CanonicalLeadTheme {
  const statusStr =
    typeof statusOrLead === "object" && statusOrLead !== null
      ? statusOrLead.status
      : statusOrLead;
  const canonical = normalizeCanonicalStatus(statusStr);
  return CANONICAL_LEAD_THEMES[canonical];
}

