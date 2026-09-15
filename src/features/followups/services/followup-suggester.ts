import { db } from "@/lib/db";
import type { SuggestedFollowUpResult } from "@/features/ai-conversation-notes/types";

/**
 * Formats a Date into YYYY-MM-DD and HH:mm in Asia/Kolkata timezone
 */
function getIndiaDateTimeParts(date: Date) {
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

  const timeStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return { dateStr, timeStr };
}

/**
 * Authenticated calculation for suggesting the next follow-up for a lead.
 * Uses real CRM facts: status, stage age, pending follow-ups, AI insights, and recent notes.
 * Business timezone: Asia/Kolkata.
 * DOES NOT schedule or write to DB automatically.
 */
export async function suggestNextFollowUp(leadId: string): Promise<SuggestedFollowUpResult> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: {
      followUps: {
        where: { status: "PENDING" },
        orderBy: { scheduledAt: "asc" },
      },
      aiInsight: true,
      activities: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });

  if (!lead) {
    throw new Error("Lead not found.");
  }

  const now = new Date();
  const pendingFollowUps = lead.followUps;
  const existingPending = pendingFollowUps[0];

  // If lead is closed (WON or LOST), no follow-up is needed
  if (lead.status === "WON" || lead.status === "LOST") {
    return {
      suggestedDate: null,
      suggestedTime: null,
      suggestedType: "OTHER",
      reason: `Lead is already marked as ${lead.status}. No ongoing sales follow-up is required.`,
      recommendedMessage: null,
      hasExistingPendingFollowUp: false,
      existingPendingFollowUpId: null,
    };
  }

  // If an appropriate future pending follow-up already exists, avoid suggesting duplicates
  if (existingPending && existingPending.scheduledAt.getTime() > now.getTime()) {
    const { dateStr, timeStr } = getIndiaDateTimeParts(existingPending.scheduledAt);
    return {
      suggestedDate: dateStr,
      suggestedTime: timeStr,
      suggestedType: existingPending.type,
      reason: `A pending follow-up is already scheduled for ${dateStr} at ${timeStr}.`,
      recommendedMessage: existingPending.note || lead.aiInsight?.recommendedAction || null,
      hasExistingPendingFollowUp: true,
      existingPendingFollowUpId: existingPending.id,
    };
  }

  // Calculate target date based on status, priority, and attention engine facts
  const targetDate = new Date(now);
  let defaultHour = 11; // 11:00 AM IST
  let daysToAdd = 1;
  let suggestedType: "CALL" | "WHATSAPP" | "EMAIL" | "OTHER" = "CALL";
  let reason = "";

  const isOverdue = existingPending && existingPending.scheduledAt.getTime() <= now.getTime();
  const priority = lead.aiInsight?.priority || "NORMAL";

  if (isOverdue) {
    // Overdue: suggest prompt catch-up today or tomorrow morning
    daysToAdd = 0;
    defaultHour = Math.min(18, Math.max(10, now.getUTCHours() + 6)); // approximate afternoon IST
    suggestedType = "CALL";
    reason = `Previous follow-up is overdue. Prompt reconnect recommended to keep deal active.`;
  } else if (priority === "CRITICAL" || lead.status === "NEW") {
    // New or Critical: fast turnaround (today or tomorrow)
    daysToAdd = lead.status === "NEW" ? 0 : 1;
    defaultHour = 11;
    suggestedType = lead.status === "NEW" ? "CALL" : "WHATSAPP";
    reason =
      lead.status === "NEW"
        ? "New lead requiring initial discovery call within 24 hours."
        : "Critical priority lead requiring prompt engagement.";
  } else if (lead.status === "PROPOSAL_SENT") {
    // Proposal sent: 2-3 business days
    daysToAdd = 2;
    defaultHour = 15; // 3:00 PM IST
    suggestedType = "CALL";
    reason = "Proposal sent; follow up to address quotation questions and decision timeline.";
  } else if (lead.status === "QUALIFIED") {
    daysToAdd = 2;
    defaultHour = 14;
    suggestedType = "CALL";
    reason = "Lead qualified; connect to present proposal or schedule solution review.";
  } else if (lead.status === "CONTACTED") {
    daysToAdd = 1;
    defaultHour = 12;
    suggestedType = "WHATSAPP";
    reason = "Initial contact made; follow up with relevant portfolio/details.";
  }

  // Advance day in IST
  targetDate.setDate(targetDate.getDate() + daysToAdd);
  // Avoid scheduling on Sunday (advance to Monday)
  if (targetDate.getDay() === 0) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  const { dateStr } = getIndiaDateTimeParts(targetDate);
  const timeStr = `${String(defaultHour).padStart(2, "0")}:00`;

  let recommendedMessage = lead.aiInsight?.recommendedAction || null;
  if (!recommendedMessage) {
    if (lead.status === "PROPOSAL_SENT") {
      recommendedMessage = "Hi, checking in to see if you had any questions on the proposal sent.";
    } else if (lead.status === "NEW") {
      recommendedMessage = "Call to introduce our solutions and understand core requirements.";
    }
  }

  return {
    suggestedDate: dateStr,
    suggestedTime: timeStr,
    suggestedType,
    reason,
    recommendedMessage,
    hasExistingPendingFollowUp: Boolean(isOverdue),
    existingPendingFollowUpId: isOverdue ? existingPending.id : null,
  };
}
