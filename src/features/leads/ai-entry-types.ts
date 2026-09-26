import type { Lead, LeadStatus } from "./types";

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
  email?: string | null;
  business?: string | null;
  status?: string | null;
  confidence?: "high" | "review" | null;
  reason?: string | null;
  matchedBy?: "phone" | "email" | "phone_and_email";
  isDeleted?: boolean;
  lastActivityText?: string | null;
  createdAt?: string | null;
};

export type StructuredLeadResult = {
  draft: StructuredLeadDraft;
  possibleDuplicate?: DuplicateLeadCandidate | null;
};

export type StructureLeadResponse =
  | { success: true; data: StructuredLeadResult }
  | { success: false; error: string };

export type StructureLeadCallback = (unstructuredText: string) => Promise<StructureLeadResponse>;

// ─── Phase 11: Bulk Lead Entry Types ──────────────────────────────────────────

export type BulkLeadItemStatus =
  | "READY"
  | "DUPLICATE_PHONE"
  | "DUPLICATE_EMAIL"
  | "INVALID"
  | "NEEDS_REVIEW";

export type BulkLeadDraftItem = StructuredLeadDraft & {
  id: string;
  itemStatus: BulkLeadItemStatus;
  possibleDuplicate?: DuplicateLeadCandidate | null;
  validationErrors?: string[];
};

export type BulkLeadReviewDTO = {
  drafts: BulkLeadDraftItem[];
  totalCount: number;
  validCount: number;
  duplicateCount: number;
  invalidCount: number;
};

export type BulkStructureLeadResponse =
  | { success: true; data: BulkLeadReviewDTO }
  | { success: false; error: string };

export type BulkCreateItemAction = "CREATE" | "UPDATE_EXISTING" | "SKIP";

export type BulkCreateLeadItem = {
  draft: StructuredLeadDraft;
  action?: BulkCreateItemAction;
  targetLeadId?: string | null;
  customNotes?: string | null;
};

export type BulkCreateItemOutcome = "created" | "updated" | "skipped" | "failed";

export type BulkCreateItemResult = {
  index: number;
  leadId?: string;
  name?: string | null;
  phone?: string | null;
  outcome: BulkCreateItemOutcome;
  message?: string;
  error?: string;
  lead?: Lead;
};

export type BulkCreateResponse = {
  success: boolean;
  results: BulkCreateItemResult[];
  summary: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  error?: string;
  undoId?: string;
};
