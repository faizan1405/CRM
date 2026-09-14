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
};

export type NewLeadInput = Pick<
  Lead,
  "name" | "phone" | "email" | "business" | "industry" | "source" | "budget" | "status"
>;
