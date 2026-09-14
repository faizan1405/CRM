import type { LeadStatus } from "./types";

export type AIFieldConfidence = "high" | "review";

export type StructuredLeadField =
  | "name"
  | "phone"
  | "email"
  | "business"
  | "industryOrRequirement"
  | "budget"
  | "status"
  | "notes"
  | "suggestedFollowUpDate"
  | "suggestedFollowUpTime";

export type StructuredLeadDraft = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  business?: string | null;
  industryOrRequirement?: string | null;
  budget?: number | null;
  status?: LeadStatus | null;
  notes?: string | null;
  suggestedFollowUpDate?: string | null;
  suggestedFollowUpTime?: string | null;
  confidence?: Partial<Record<StructuredLeadField, AIFieldConfidence>>;
  rawInput?: string;
};

export type DuplicateLeadCandidate = {
  id: string;
  name: string;
  phone: string;
  business?: string | null;
  status?: string | null;
  confidence?: "high" | "review" | null;
  reason?: string | null;
};

export type StructuredLeadResult = {
  draft: StructuredLeadDraft;
  possibleDuplicate?: DuplicateLeadCandidate | null;
};

export type StructureLeadResponse =
  | { success: true; data: StructuredLeadResult }
  | { success: false; error: string };

export type StructureLeadCallback = (unstructuredText: string) => Promise<StructureLeadResponse>;
