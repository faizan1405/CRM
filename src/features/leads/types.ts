export const leadStatuses = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Won",
  "Lost",
] as const;

export type LeadStatus = (typeof leadStatuses)[number];

export type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  business: string;
  industry: string;
  source: string;
  budget: number | null;
  status: LeadStatus;
  quotedAmount: number | null;
  lastContactDate: string | null;
  nextFollowUpDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  aiAttention?: import("@/features/ai-attention/types").AIAttentionLeadData;
};

export type NewLeadInput = Pick<
  Lead,
  "name" | "phone" | "email" | "business" | "industry" | "source" | "budget" | "status"
>;

export type LeadActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export const statusToDatabase = {
  New: "NEW",
  Contacted: "CONTACTED",
  Qualified: "QUALIFIED",
  "Proposal Sent": "PROPOSAL_SENT",
  Won: "WON",
  Lost: "LOST",
} as const;

export type DatabaseLeadStatus = (typeof statusToDatabase)[LeadStatus];

export const statusFromDatabase: Record<DatabaseLeadStatus, LeadStatus> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL_SENT: "Proposal Sent",
  WON: "Won",
  LOST: "Lost",
};
