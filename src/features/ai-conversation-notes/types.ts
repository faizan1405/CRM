export type InterestLevel = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export type QuickTag =
  | "Interested"
  | "Price Concern"
  | "Follow-up Required"
  | "Decision Maker"
  | "No Response"
  | string;

export interface StructuredCallNotesData {
  requirement: string | null;
  budget: string | null;
  interestLevel: InterestLevel;
  decisionFactor: string | null;
  objections: string | null;
  importantDetails: string | null;
  nextAction: string | null;
  suggestedFollowUpDate: string | null; // e.g. "YYYY-MM-DD" or descriptive
  suggestedFollowUpTime: string | null; // e.g. "16:00" or "4:00 PM"
  tags: string[];
  rawNote: string;
}

export interface CallNotesActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ApplyCallNotesInput {
  leadId: string;
  rawNote: string;
  structuredData?: Partial<StructuredCallNotesData> | null;
  formattedNote?: string;
  appliedType?: "structured" | "original";
}

export interface SuggestedFollowUpResult {
  suggestedDate: string | null; // YYYY-MM-DD
  suggestedTime: string | null; // HH:mm
  suggestedType: "CALL" | "WHATSAPP" | "EMAIL" | "OTHER";
  reason: string;
  recommendedMessage?: string | null;
  hasExistingPendingFollowUp: boolean;
  existingPendingFollowUpId?: string | null;
}
