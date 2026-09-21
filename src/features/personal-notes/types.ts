export interface PersonalNote {
  id: string;
  userId?: string;
  title: string;
  content: string;
  pinned: boolean;
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export type PersonalNoteActionResult<T = unknown> =
  | {
      success: true;
      data: T;
      undoId?: string;
      error?: undefined;
    }
  | {
      success: false;
      error: string;
      data?: undefined;
      undoId?: string;
    };

export type AITransformAction = "cleanup" | "organize" | "rewrite" | "summarize";

export interface AIPreviewState {
  originalText: string;
  previewText: string;
  action: AITransformAction;
  actionLabel: string;
}

export interface PersonalNotesProps {
  initialNotes?: PersonalNote[];
  onCreateNote?: (note: { title: string; content: string; pinned?: boolean }) => Promise<PersonalNote | void> | void;
  onUpdateNote?: (id: string, updates: Partial<PersonalNote>) => Promise<PersonalNote | void> | void;
  onDeleteNote?: (id: string) => Promise<void> | void;
  onPinNote?: (id: string, pinned: boolean) => Promise<void> | void;
  onAITransform?: (text: string, action: AITransformAction) => Promise<string> | string;
  onImproveNote?: (text: string) => Promise<string>;
}

