import type {
  NotificationType as PrismaNotificationType,
  NotificationPriority as PrismaNotificationPriority,
  NotificationStatus as PrismaNotificationStatus,
} from "@prisma/client";

export type NotificationTypeKey =
  | "overdue_followup"
  | "followup_due_today"
  | "new_lead_uncontacted"
  | "lead_becoming_stale"
  | "hot_lead_attention"
  | "high_value_opportunity"
  | "proposal_needs_followup"
  | "ai_recommended_action"
  | "missed_followup";

export type NotificationPriorityKey = "critical" | "important" | "normal";

export type NotificationStatusKey = "unread" | "read" | "dismissed" | "resolved";

export type NotificationFilter =
  | "all"
  | "critical"
  | "important"
  | "today"
  | "overdue"
  | "ai_suggestions"
  | "resolved";

export const NOTIFICATION_TYPE_MAP: Record<NotificationTypeKey, PrismaNotificationType> = {
  overdue_followup: "OVERDUE_FOLLOWUP",
  followup_due_today: "FOLLOWUP_DUE_TODAY",
  new_lead_uncontacted: "NEW_LEAD_NOT_CONTACTED",
  lead_becoming_stale: "STALE_LEAD",
  hot_lead_attention: "HOT_LEAD_ATTENTION",
  high_value_opportunity: "HIGH_VALUE_OPPORTUNITY",
  proposal_needs_followup: "PROPOSAL_FOLLOWUP",
  ai_recommended_action: "AI_RECOMMENDED_ACTION",
  missed_followup: "MISSED_FOLLOWUP",
};

export const PRISMA_TO_TYPE_MAP: Record<PrismaNotificationType, NotificationTypeKey> = {
  OVERDUE_FOLLOWUP: "overdue_followup",
  FOLLOWUP_DUE_TODAY: "followup_due_today",
  NEW_LEAD_NOT_CONTACTED: "new_lead_uncontacted",
  STALE_LEAD: "lead_becoming_stale",
  HOT_LEAD_ATTENTION: "hot_lead_attention",
  HIGH_VALUE_OPPORTUNITY: "high_value_opportunity",
  PROPOSAL_FOLLOWUP: "proposal_needs_followup",
  AI_RECOMMENDED_ACTION: "ai_recommended_action",
  MISSED_FOLLOWUP: "missed_followup",
};

export const NOTIFICATION_TYPE_LABELS: Record<PrismaNotificationType, string> = {
  OVERDUE_FOLLOWUP: "Overdue Follow-up",
  FOLLOWUP_DUE_TODAY: "Follow-up Due Today",
  NEW_LEAD_NOT_CONTACTED: "New Lead Uncontacted",
  STALE_LEAD: "Lead Becoming Stale",
  HOT_LEAD_ATTENTION: "Hot Lead Attention",
  HIGH_VALUE_OPPORTUNITY: "High-Value Opportunity",
  PROPOSAL_FOLLOWUP: "Proposal Needs Follow-up",
  AI_RECOMMENDED_ACTION: "AI Recommended Action",
  MISSED_FOLLOWUP: "Missed Follow-up",
};

export const PRIORITY_MAP: Record<NotificationPriorityKey, PrismaNotificationPriority> = {
  critical: "CRITICAL",
  important: "IMPORTANT",
  normal: "NORMAL",
};

export const PRISMA_TO_PRIORITY_MAP: Record<PrismaNotificationPriority, NotificationPriorityKey> = {
  CRITICAL: "critical",
  IMPORTANT: "important",
  NORMAL: "normal",
};

export const STATUS_MAP: Record<NotificationStatusKey, PrismaNotificationStatus> = {
  unread: "UNREAD",
  read: "READ",
  resolved: "RESOLVED",
  dismissed: "DISMISSED",
};

export const PRISMA_TO_STATUS_MAP: Record<PrismaNotificationStatus, NotificationStatusKey> = {
  UNREAD: "unread",
  READ: "read",
  RESOLVED: "resolved",
  DISMISSED: "dismissed",
};

export interface SmartNotification {
  id: string;
  leadId: string;
  leadName: string;
  business?: string | null;
  phone?: string | null;
  type: NotificationTypeKey;
  rawType: PrismaNotificationType;
  typeLabel: string;
  priority: NotificationPriorityKey;
  rawPriority: PrismaNotificationPriority;
  reason: string;
  timestamp: string;
  recommendedAction: string;
  status: NotificationStatusKey;
  rawStatus: PrismaNotificationStatus;
  amount?: number | null;
  stage?: string | null;
  dueDate?: string | null;
  readAt?: string | null;
  resolvedAt?: string | null;
}

export interface NotificationActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
