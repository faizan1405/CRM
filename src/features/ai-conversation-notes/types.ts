export type InterestLevel = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN" | string;

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
  interestLevel: InterestLevel | null;
  decisionFactor: string | null;
  objections: string | null;
  importantDetails: string | null;
  nextAction: string | null;
  suggestedFollowUpDate: string | null; // e.g. YYYY-MM-DD or descriptive date
  suggestedFollowUpTime: string | null; // e.g. HH:mm or 4:00 PM
  tags: string[];
  rawNote?: string;
}

export type StructuredFieldKey = keyof Omit<StructuredCallNotesData, "tags" | "rawNote">;

export interface CallNotesWorkflowResult {
  appliedType: "structured" | "original";
  formattedOutput: string;
  structuredData: StructuredCallNotesData | null;
  rawNote: string;
  appliedAt: string;
}

export interface AIConversationNotesProps {
  initialRawNote?: string;
  availableTags?: string[];
  onStructureNotes?: (rawNote: string) => Promise<StructuredCallNotesData>;
  onApplyStructured?: (result: CallNotesWorkflowResult) => void;
  onKeepOriginal?: (result: CallNotesWorkflowResult) => void;
  className?: string;
  disabled?: boolean;
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
