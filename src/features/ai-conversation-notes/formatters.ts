import type { StructuredCallNotesData } from "./types";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

/**
 * Formats a date string (YYYY-MM-DD or partial) into a readable date matching standard friendly format.
 */
export function formatFollowUpDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    // If already in friendly format (e.g. "Friday" or "18 Sep 2026")
    if (!dateStr.includes("-")) {
      return dateStr;
    }
    const [year, month, day] = dateStr.split("-").map(Number);
    if (!year || !month || !day) return dateStr;
    const monthName = MONTH_NAMES[month - 1] || "";
    return `${day} ${monthName} ${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Formats 24h time "16:00" to "4:00 PM"
 */
export function formatFollowUpTime(timeStr?: string | null): string {
  if (!timeStr) return "";
  // Check if already formatted like "4:00 PM"
  if (timeStr.toLowerCase().includes("am") || timeStr.toLowerCase().includes("pm")) {
    return timeStr;
  }
  const parts = timeStr.split(":");
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    if (!isNaN(hours)) {
      const ampm = hours >= 12 ? "PM" : "AM";
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes.padStart(2, "0")} ${ampm}`;
    }
  }
  return timeStr;
}

/**
 * Returns formatted follow-up string: e.g. "Friday — 4:00 PM" or "18 Sep 2026 — 4:00 PM"
 */
export function formatFollowUpCombined(dateStr?: string | null, timeStr?: string | null): string {
  const formattedDate = formatFollowUpDate(dateStr);
  const formattedTime = formatFollowUpTime(timeStr);

  if (formattedDate && formattedTime) {
    return `${formattedDate} — ${formattedTime}`;
  }
  if (formattedDate) return formattedDate;
  if (formattedTime) return formattedTime;
  return "";
}

/**
 * Formats structured call note data into clean text output suitable for Phase 5 Lead Activity Notes.
 */
export function formatStructuredCallNote(data: StructuredCallNotesData): string {
  const lines: string[] = [];

  if (data.requirement) {
    lines.push(`Requirement: ${data.requirement.trim()}`);
  }
  if (data.budget) {
    lines.push(`Budget: ${data.budget.trim()}`);
  }
  if (data.interestLevel) {
    lines.push(`Interest: ${data.interestLevel.trim()}`);
  }
  if (data.decisionFactor) {
    lines.push(`Decision: ${data.decisionFactor.trim()}`);
  }
  if (data.objections) {
    lines.push(`Objections: ${data.objections.trim()}`);
  }
  if (data.importantDetails) {
    lines.push(`Important Details: ${data.importantDetails.trim()}`);
  }
  if (data.nextAction) {
    lines.push(`Next Action: ${data.nextAction.trim()}`);
  }

  const followUp = formatFollowUpCombined(data.suggestedFollowUpDate, data.suggestedFollowUpTime);
  if (followUp) {
    lines.push(`Follow-up: ${followUp}`);
  }

  if (data.tags && data.tags.length > 0) {
    lines.push(`Tags: ${data.tags.join(", ")}`);
  }

  return lines.join("\n");
}
