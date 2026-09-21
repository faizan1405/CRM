export type UndoActionType =
  | "LEAD_STATUS_CHANGE"
  | "LEAD_UPDATE"
  | "LEAD_CREATE"
  | "LEAD_DELETE"
  | "LEAD_RESTORE"
  | "LEAD_WASTE"
  | "LEAD_WASTE_RESTORE"
  | "LEAD_PIN"
  | "LEAD_QUICK_STATUS"
  | "FOLLOWUP_CREATE"
  | "FOLLOWUP_RESCHEDULE"
  | "FOLLOWUP_CANCEL"
  | "FOLLOWUP_COMPLETE"
  | "NOTE_ADD"
  | "NOTE_UPDATE"
  | "NOTE_DELETE"
  | "ACTIVITY_NOTE_CREATE"
  | "DEAL_CREATE"
  | "DEAL_UPDATE"
  | "DEAL_UPSERT"
  | "DEAL_DELETE"
  | "PAYMENT_CREATE"
  | "PAYMENT_UPDATE"
  | "PAYMENT_DELETE"
  | "PERSONAL_NOTE_CREATE"
  | "PERSONAL_NOTE_UPDATE"
  | "PERSONAL_NOTE_DELETE"
  | "PERSONAL_NOTE_PIN"
  | "PACKAGE_CREATE"
  | "PACKAGE_UPDATE"
  | "PACKAGE_DELETE"
  | "SAMPLE_CREATE"
  | "SAMPLE_UPDATE"
  | "SAMPLE_DELETE"
  | "TEMPLATE_CREATE"
  | "TEMPLATE_UPDATE"
  | "TEMPLATE_DELETE"
  | "TEMPLATE_TOGGLE"
  | "BULK_LEAD_IMPORT";

export type UndoEntityType =
  | "LEAD"
  | "FOLLOWUP"
  | "DEAL"
  | "PAYMENT"
  | "NOTE"
  | "ACTIVITY_NOTE"
  | "PERSONAL_NOTE"
  | "PACKAGE"
  | "SAMPLE"
  | "TEMPLATE"
  | "BULK_IMPORT";

export interface RecordUndoParams {
  actionType: UndoActionType;
  entityType: UndoEntityType;
  entityId: string;
  leadId?: string | null;
  beforeSnapshot?: Record<string, unknown> | null;
  afterSnapshot?: Record<string, unknown> | null;
  expectedUpdatedAt?: Date | null;
  description: string;
  createdByUserId?: string | null;
  userId?: string | null;
  ttlMinutes?: number;
}

export interface UndoActionResult<T = unknown> {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
  undoId?: string;
}

export interface PerformUndoResult {
  actionType: string;
  entityType: string;
  entityId: string;
  leadId?: string | null;
  description: string;
  success?: boolean;
  [key: string]: any;
}
