export const leadStatuses = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Won",
  "Lost",
] as const;

export type LeadStatus = (typeof leadStatuses)[number];

export type QuickStatusType = "NONE" | "CONTACTED" | "INTERESTED" | "CALL_NOT_PICK" | "CALL_AGAIN";

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
  quickStatus?: QuickStatusType;
  latestNote?: string;
  quotedAmount: number | null;
  lastContactDate: string | null;
  nextFollowUpDate: string | null;
  activeFollowUp?: import("@/features/followups/types").FollowUp | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  isPinned?: boolean;
  mergedIntoLeadId?: string | null;
  mergedAt?: string | null;
  mergedInto?: { id: string; name: string; phone: string; status: string } | null;
  dealValue?: number | null;
  lastActivity?: { message: string; createdAt: string; type?: string } | null;
  isWaste?: boolean;
  operationalState?: LeadOperationalState;
  aiAttention?: import("@/features/ai-attention/types").AIAttentionLeadData;
  staleInfo?: import("@/lib/stale-leads").LeadStaleInfo;
};

export type NewLeadInput = Pick<
  Lead,
  "name" | "phone" | "email" | "business" | "industry" | "source" | "budget" | "status"
>;

export type LeadActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string; duplicateCandidate?: import("./ai-entry-types").DuplicateLeadCandidate | null };

export type MergeLeadsInput = {
  primaryLeadId: string;
  mergedLeadId: string;
  fieldResolutions: {
    name?: string;
    phone?: string;
    email?: string;
    business?: string;
    industry?: string;
    leadSource?: string;
    budget?: number | null;
    quotedAmount?: number | null;
    status?: LeadStatus;
  };
  survivingFollowUpId?: string;
};

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

export type LeadOperationalState =
  | "LOST"
  | "WASTE"
  | "FOLLOW_UP_NOW"
  | "FUTURE_FOLLOW_UP"
  | "ACTIVE_NEUTRAL";
