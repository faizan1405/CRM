import type {
  LeadStatus, QuickStatus, FollowUpType, FollowUpStatus, LeadLossReason, DealStatus, PaymentType, PaymentMethod, NotificationPriority,
} from "./types";

export const LEAD_STAGES: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "WON", "LOST"];

export const leadStatusLabel: Record<LeadStatus, string> = {
  NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified", PROPOSAL_SENT: "Proposal Sent", WON: "Won", LOST: "Lost",
};
export const quickStatusLabel: Record<QuickStatus, string> = {
  NONE: "No quick status", CONTACTED: "Contacted", INTERESTED: "Interested", CALL_NOT_PICK: "Call not picked", CALL_AGAIN: "Call again",
};
export const followUpTypeLabel: Record<FollowUpType, string> = { CALL: "Call", WHATSAPP: "WhatsApp", EMAIL: "Email", OTHER: "Other" };
export const followUpStatusLabel: Record<FollowUpStatus, string> = { PENDING: "Pending", COMPLETED: "Completed", CANCELLED: "Cancelled" };
export const lossReasonLabel: Record<LeadLossReason, string> = {
  PRICE: "Price", NO_RESPONSE: "No response", TIMING: "Timing", COMPETITOR: "Went with competitor", TRUST: "Trust",
  NOT_QUALIFIED: "Not qualified", REQUIREMENT_CHANGED: "Requirement changed", NO_URGENCY: "No urgency", OTHER: "Other",
};
export const dealStatusLabel: Record<DealStatus, string> = { NO_DEAL: "No deal", NEGOTIATING: "Negotiating", CONFIRMED: "Confirmed", COMPLETED: "Completed" };
export const paymentTypeLabel: Record<PaymentType, string> = { ADVANCE: "Advance", PARTIAL: "Partial", FINAL: "Final", CUSTOM: "Custom" };
export const paymentMethodLabel: Record<PaymentMethod, string> = { UPI: "UPI", BANK_TRANSFER: "Bank transfer", CASH: "Cash", CARD: "Card", PAYPAL: "PayPal", OTHER: "Other" };
export const notificationPriorityLabel: Record<NotificationPriority, string> = { CRITICAL: "Critical", IMPORTANT: "Important", NORMAL: "Normal" };

/** Visual tone per value — consumed by <Pill>. */
export type Tone = "neutral" | "info" | "primary" | "warning" | "success" | "danger";
export const leadStatusTone: Record<LeadStatus, Tone> = { NEW: "info", CONTACTED: "neutral", QUALIFIED: "primary", PROPOSAL_SENT: "warning", WON: "success", LOST: "danger" };
export const quickStatusTone: Record<QuickStatus, Tone> = { NONE: "neutral", CONTACTED: "neutral", INTERESTED: "success", CALL_NOT_PICK: "danger", CALL_AGAIN: "warning" };
export const dealStatusTone: Record<DealStatus, Tone> = { NO_DEAL: "neutral", NEGOTIATING: "warning", CONFIRMED: "primary", COMPLETED: "success" };
export const followUpStatusTone: Record<FollowUpStatus, Tone> = { PENDING: "info", COMPLETED: "success", CANCELLED: "neutral" };
export const notificationPriorityTone: Record<NotificationPriority, Tone> = { CRITICAL: "danger", IMPORTANT: "warning", NORMAL: "neutral" };

/** Tailwind background class for stage swatches/bars. */
export const stageSwatch: Record<LeadStatus, string> = {
  NEW: "bg-info", CONTACTED: "bg-subtle", QUALIFIED: "bg-chart-2", PROPOSAL_SENT: "bg-warning", WON: "bg-primary", LOST: "bg-destructive",
};
