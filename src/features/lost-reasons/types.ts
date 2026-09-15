import type { LeadLossReason as PrismaLeadLossReason } from "@prisma/client";
export type { PrismaLeadLossReason };

export const LOST_REASONS = [
  "PRICE",
  "NO_RESPONSE",
  "TIMING",
  "COMPETITOR",
  "TRUST",
  "NOT_QUALIFIED",
  "REQUIREMENT_CHANGED",
  "NO_URGENCY",
  "OTHER",
] as const;

export type LostReasonCode = (typeof LOST_REASONS)[number];

export const LOST_REASON_LABELS: Record<PrismaLeadLossReason, string> = {
  PRICE: "Price",
  NO_RESPONSE: "No Response",
  TIMING: "Timing",
  COMPETITOR: "Competitor",
  TRUST: "Trust",
  NOT_QUALIFIED: "Not Qualified",
  REQUIREMENT_CHANGED: "Requirement Changed",
  NO_URGENCY: "No Urgency",
  OTHER: "Other",
};

export const UI_TO_PRISMA_LOST_REASON: Record<string, PrismaLeadLossReason> = {
  Price: "PRICE",
  "No Response": "NO_RESPONSE",
  Timing: "TIMING",
  Competitor: "COMPETITOR",
  Trust: "TRUST",
  "Not Qualified": "NOT_QUALIFIED",
  "Requirement Changed": "REQUIREMENT_CHANGED",
  "No Urgency": "NO_URGENCY",
  Other: "OTHER",
  PRICE: "PRICE",
  NO_RESPONSE: "NO_RESPONSE",
  TIMING: "TIMING",
  COMPETITOR: "COMPETITOR",
  TRUST: "TRUST",
  NOT_QUALIFIED: "NOT_QUALIFIED",
  REQUIREMENT_CHANGED: "REQUIREMENT_CHANGED",
  NO_URGENCY: "NO_URGENCY",
  OTHER: "OTHER",
};

export interface LeadLossRecord {
  id: string;
  leadId: string;
  reason: PrismaLeadLossReason;
  reasonLabel: string;
  note: string | null;
  lostAt: string;
  createdByUserId?: string | null;
  createdAt: string;
}

export interface LostReasonMeta {
  reason: PrismaLeadLossReason;
  label: string;
  shortCode: string;
  description: string;
  iconName:
    | "DollarSign"
    | "PhoneOff"
    | "Clock"
    | "Users"
    | "ShieldAlert"
    | "UserX"
    | "RefreshCw"
    | "Hourglass"
    | "HelpCircle";
}

export const LOST_REASON_DETAILS: Record<PrismaLeadLossReason, LostReasonMeta> = {
  PRICE: {
    reason: "PRICE",
    label: "Price",
    shortCode: "PRC",
    description: "Quotation above budget, discount declined, or pricing mismatch",
    iconName: "DollarSign",
  },
  NO_RESPONSE: {
    reason: "NO_RESPONSE",
    label: "No Response",
    shortCode: "NRP",
    description: "Ghosted after outreach, calls unanswered, or uncontactable",
    iconName: "PhoneOff",
  },
  TIMING: {
    reason: "TIMING",
    label: "Timing",
    shortCode: "TMG",
    description: "Not ready to purchase right now; postponed to future timeline",
    iconName: "Clock",
  },
  COMPETITOR: {
    reason: "COMPETITOR",
    label: "Competitor",
    shortCode: "CMP",
    description: "Selected competitor or alternate market solution",
    iconName: "Users",
  },
  TRUST: {
    reason: "TRUST",
    label: "Trust",
    shortCode: "TRS",
    description: "Confidence issues regarding delivery, brand proof, or reliability",
    iconName: "ShieldAlert",
  },
  NOT_QUALIFIED: {
    reason: "NOT_QUALIFIED",
    label: "Not Qualified",
    shortCode: "NQL",
    description: "Does not match ICP, lack of requisite infrastructure or budget",
    iconName: "UserX",
  },
  REQUIREMENT_CHANGED: {
    reason: "REQUIREMENT_CHANGED",
    label: "Requirement Changed",
    shortCode: "RQC",
    description: "Project scope shifted, tech stack altered, or internal revamp",
    iconName: "RefreshCw",
  },
  NO_URGENCY: {
    reason: "NO_URGENCY",
    label: "No Urgency",
    shortCode: "NUR",
    description: "No pressing problem or immediate priority for leadership",
    iconName: "Hourglass",
  },
  OTHER: {
    reason: "OTHER",
    label: "Other",
    shortCode: "OTH",
    description: "Custom circumstances requiring explicit explanatory note",
    iconName: "HelpCircle",
  },
};

export interface LostReasonSubmission {
  reason: PrismaLeadLossReason;
  notes?: string;
  leadId?: string;
  leadName?: string;
  confirmedAt: string;
}

export interface LostReasonDialogProps {
  isOpen: boolean;
  leadName?: string;
  leadId?: string;
  initialReason?: PrismaLeadLossReason | null;
  initialNotes?: string;
  onConfirm: (data: LostReasonSubmission) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export interface LostLeadDetailProps {
  reason: PrismaLeadLossReason | string;
  lostAt?: string | Date;
  notes?: string | null;
  leadName?: string;
  className?: string;
  compact?: boolean;
}

export interface LostReasonStat {
  reason: PrismaLeadLossReason;
  label: string;
  count: number;
  percentage: number;
}

export interface LostReasonsAnalyticsData {
  totalLost: number;
  period: "7d" | "30d" | "90d" | "all";
  breakdown: LostReasonStat[];
  topReason: LostReasonStat | null;
  aiInsight?: string | null;
}

export interface LostReasonActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface LostReasonsAnalyticsProps {
  data?: LostReasonsAnalyticsData;
  period?: string;
  onPeriodChange?: (period: string) => void;
  className?: string;
}
