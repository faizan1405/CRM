import type { DuplicateLeadCandidate, StructuredLeadDraft, StructuredLeadResult } from "./ai-entry-types";

export type BulkParsedItem = StructuredLeadDraft & {
  id?: string;
  itemStatus?: "READY" | "DUPLICATE_PHONE" | "DUPLICATE_EMAIL" | "INVALID" | "NEEDS_REVIEW";
  possibleDuplicate?: DuplicateLeadCandidate | null;
  validationErrors?: string[];
};
export type ReviewLeadResult = StructuredLeadResult & Pick<BulkParsedItem, "itemStatus" | "validationErrors">;

/** Frontend adapter contract for Agent A; the single-lead backend stays intact. */
export type BulkStructureLeadResponse =
  | { success: true; data: StructuredLeadResult | ReviewLeadResult[] | BulkParsedItem[] | { leads: ReviewLeadResult[] } | { drafts: BulkParsedItem[] } }
  | { success: false; error: string };
export type BulkStructureLeadCallback = (input: string) => Promise<BulkStructureLeadResponse>;
