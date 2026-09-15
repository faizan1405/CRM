import type { LeadLossReason as PrismaLeadLossReason } from "@prisma/client";

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
}

export interface LostReasonActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
