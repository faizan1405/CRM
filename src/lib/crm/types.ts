/**
 * Presentation types mirroring the production Scale Flow CRM schema.
 * Dates are ISO strings ("YYYY-MM-DD" or full ISO) and money values are plain numbers in INR.
 */

export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL_SENT" | "WON" | "LOST";
export type QuickStatus = "NONE" | "CONTACTED" | "INTERESTED" | "CALL_NOT_PICK" | "CALL_AGAIN";
export type FollowUpType = "CALL" | "WHATSAPP" | "EMAIL" | "OTHER";
export type FollowUpStatus = "PENDING" | "COMPLETED" | "CANCELLED";
export type LeadLossReason = "PRICE" | "NO_RESPONSE" | "TIMING" | "COMPETITOR" | "TRUST" | "NOT_QUALIFIED" | "REQUIREMENT_CHANGED" | "NO_URGENCY" | "OTHER";
export type DealStatus = "NO_DEAL" | "NEGOTIATING" | "CONFIRMED" | "COMPLETED";
export type PaymentType = "ADVANCE" | "PARTIAL" | "FINAL" | "CUSTOM";
export type PaymentMethod = "UPI" | "BANK_TRANSFER" | "CASH" | "CARD" | "PAYPAL" | "OTHER";
export type NotificationPriority = "CRITICAL" | "IMPORTANT" | "NORMAL";
export type NotificationStatus = "UNREAD" | "READ" | "RESOLVED" | "DISMISSED";
export type NotificationType =
  | "OVERDUE_FOLLOWUP" | "FOLLOWUP_DUE_TODAY" | "NEW_LEAD_NOT_CONTACTED" | "STALE_LEAD" | "HOT_LEAD_ATTENTION"
  | "HIGH_VALUE_OPPORTUNITY" | "PROPOSAL_FOLLOWUP" | "AI_RECOMMENDED_ACTION" | "MISSED_FOLLOWUP";
export type ActivityType =
  | "LEAD_CREATED" | "LEAD_UPDATED" | "STATUS_CHANGED" | "NOTE_ADDED" | "FOLLOWUP_CREATED"
  | "FOLLOWUP_RESCHEDULED" | "FOLLOWUP_COMPLETED" | "FOLLOWUP_CANCELLED" | "WHATSAPP_OPENED" | "LEAD_MERGED";

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  business: string | null;
  industry: string | null;
  leadSource: string | null;
  budget: number | null;
  status: LeadStatus;
  quickStatus: QuickStatus;
  isPinned: boolean;
  quotedAmount: number | null;
  lastContactDate: string | null;
  nextFollowUpDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface FollowUp {
  id: string;
  leadId: string;
  scheduledAt: string; // ISO date-time
  type: FollowUpType;
  status: FollowUpStatus;
  note: string | null;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  type: ActivityType;
  description: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  amount: number;
  paymentDate: string;
  type: PaymentType;
  method: PaymentMethod;
  reference: string | null;
  note: string | null;
}

export interface Deal {
  id: string;
  leadId: string | null;
  clientNameSnapshot: string | null;
  companyNameSnapshot: string | null;
  projectName: string | null;
  quotedAmount: number | null;
  finalAmount: number;
  status: DealStatus;
  nextPaymentDueDate: string | null;
  nextPaymentDueAmount: number | null;
  payments: Payment[];
  notes: string | null;
}

export interface PersonalNote {
  id: string;
  title: string | null;
  content: string;
  isPinned: boolean;
  updatedAt: string;
}

export interface SalesNotification {
  id: string;
  leadId: string | null;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  reason: string;
  recommendedAction: string;
  status: NotificationStatus;
  createdAt: string;
}
