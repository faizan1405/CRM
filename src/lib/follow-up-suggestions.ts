import { DEFAULT_TIME, getPresetDate } from "./date-presets";
import type { FollowUp, FollowUpType } from "@/features/followups/types";

export type SalesOutcomeType =
  | "NOT_PICKED"
  | "INTERESTED"
  | "PROPOSAL_SENT"
  | "CALL_BACK";

export type FollowUpSuggestion = {
  outcome: SalesOutcomeType;
  presetId: "tomorrow" | "+2" | "+3" | null;
  daysToAdd: number | null;
  suggestedDate: string; // YYYY-MM-DD in Asia/Kolkata
  suggestedTime: string; // HH:mm in Asia/Kolkata
  displayDateLabel: string; // e.g. "Tomorrow", "+2 Days", "+3 Days"
  displayFullLabel: string; // e.g. "Tomorrow · 10:00 AM", "+2 Days · 10:00 AM"
  requiresExactDateTime: boolean;
  defaultType: FollowUpType;
};

/**
 * Formats a 24-hour HH:mm time string into 12-hour format with AM/PM (e.g., "10:00 AM", "3:00 PM").
 */
export function formatTimeIST(timeStr?: string): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  const hour = parseInt(parts[0], 10);
  const min = parseInt(parts[1] || "0", 10);
  if (isNaN(hour) || isNaN(min)) return timeStr;

  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const minPadded = String(min).padStart(2, "0");
  return `${hour12}:${minPadded} ${period}`;
}

/**
 * Formats a date for the duplicate follow-up warning in IST:
 * e.g., "Existing follow-up scheduled for 22 Sep, 3:00 PM."
 */
const MONTHS_3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatFollowUpWarning(scheduledAt: string | Date): string {
  const d = new Date(scheduledAt);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const parts = formatter.formatToParts(d);
  const day = parts.find((p) => p.type === "day")?.value || "";
  const monthIdx = parseInt(parts.find((p) => p.type === "month")?.value || "1", 10) - 1;
  const monthName = MONTHS_3[monthIdx] || "Sep";
  const hour = parts.find((p) => p.type === "hour")?.value || "";
  const minute = parts.find((p) => p.type === "minute")?.value || "00";
  const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value?.toUpperCase() || "AM";

  return `Existing follow-up scheduled for ${day} ${monthName}, ${hour}:${minute} ${dayPeriod}.`;
}

/**
 * Checks if a lead has an active (pending) future follow-up.
 */
export function getActiveFutureFollowUp(lead: {
  activeFollowUp?: FollowUp | null;
  followUps?: Array<{ id?: string; scheduledAt: string | Date; status: string; type?: string }>;
} | null | undefined): FollowUp | null {
  if (!lead) return null;
  if (lead.activeFollowUp) {
    const status = String(lead.activeFollowUp.status).toUpperCase();
    if (status === "PENDING") {
      return lead.activeFollowUp;
    }
  }
  if (lead.followUps && Array.isArray(lead.followUps)) {
    const pending = lead.followUps.find(
      (f) => String(f.status).toUpperCase() === "PENDING"
    );
    if (pending) {
      return {
        id: pending.id || "",
        leadId: "",
        scheduledAt: new Date(pending.scheduledAt).toISOString(),
        type: (pending.type as FollowUpType) || "Call",
        status: "Pending",
        note: "",
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  }
  return null;
}

/**
 * Centralized Rules for Smart Follow-up Suggestions:
 * - NOT_PICKED &rarr; Tomorrow
 * - INTERESTED &rarr; +2 Days
 * - PROPOSAL_SENT &rarr; +3 Days
 * - CALL_BACK &rarr; requires exact date and time (no silent default)
 */
export function getFollowUpSuggestion(
  outcome: SalesOutcomeType,
  explicitTime?: string
): FollowUpSuggestion {
  const time = explicitTime || DEFAULT_TIME;
  const timeLabel = formatTimeIST(time);

  switch (outcome) {
    case "NOT_PICKED": {
      const suggestedDate = getPresetDate(1);
      return {
        outcome: "NOT_PICKED",
        presetId: "tomorrow",
        daysToAdd: 1,
        suggestedDate,
        suggestedTime: time,
        displayDateLabel: "Tomorrow",
        displayFullLabel: `Tomorrow · ${timeLabel}`,
        requiresExactDateTime: false,
        defaultType: "Call",
      };
    }
    case "INTERESTED": {
      const suggestedDate = getPresetDate(2);
      return {
        outcome: "INTERESTED",
        presetId: "+2",
        daysToAdd: 2,
        suggestedDate,
        suggestedTime: time,
        displayDateLabel: "+2 Days",
        displayFullLabel: `+2 Days · ${timeLabel}`,
        requiresExactDateTime: false,
        defaultType: "Call",
      };
    }
    case "PROPOSAL_SENT": {
      const suggestedDate = getPresetDate(3);
      return {
        outcome: "PROPOSAL_SENT",
        presetId: "+3",
        daysToAdd: 3,
        suggestedDate,
        suggestedTime: time,
        displayDateLabel: "+3 Days",
        displayFullLabel: `+3 Days · ${timeLabel}`,
        requiresExactDateTime: false,
        defaultType: "Call",
      };
    }
    case "CALL_BACK": {
      return {
        outcome: "CALL_BACK",
        presetId: null,
        daysToAdd: null,
        suggestedDate: "",
        suggestedTime: explicitTime || "",
        displayDateLabel: "Choose callback date",
        displayFullLabel: "Choose callback date and time",
        requiresExactDateTime: true,
        defaultType: "Call",
      };
    }
  }
}
