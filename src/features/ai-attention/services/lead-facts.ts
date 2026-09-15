import { db } from "@/lib/db";
import { STALE_THRESHOLDS_DAYS } from "../constants";
import type { CalculatedLeadFacts } from "../types";

export function formatTimeAgo(date: Date, now: Date = new Date()): string {
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) {
    return diffMinutes <= 1 ? "just now" : `${diffMinutes} minutes ago`;
  }
  if (diffHours < 24) {
    return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
  }
  return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
}

export function formatDurationText(date: Date, now: Date = new Date()): string {
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays >= 1) {
    return `${diffDays} ${diffDays === 1 ? "day" : "days"}`;
  }
  return `${diffHours} ${diffHours === 1 ? "hour" : "hours"}`;
}

export async function calculateLeadFacts(leadId: string): Promise<CalculatedLeadFacts | null> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: {
      activities: {
        orderBy: { createdAt: "desc" },
      },
      followUps: {
        orderBy: { scheduledAt: "asc" },
      },
    },
  });

  if (!lead) return null;

  return computeLeadFactsSync(lead);
}

export function computeLeadFactsSync(lead: {
  id: string;
  name: string;
  status: string;
  budget: import("@prisma/client").Prisma.Decimal | number | null;
  quotedAmount: import("@prisma/client").Prisma.Decimal | number | null;
  createdAt: Date;
  updatedAt: Date;
  lastContactDate: Date | null;
  activities?: Array<{
    type: string;
    message: string;
    metadata?: import("@prisma/client").Prisma.JsonValue;
    createdAt: Date;
  }>;
  followUps?: Array<{
    status: string;
    scheduledAt: Date;
    type: string;
    note?: string | null;
  }>;
}): CalculatedLeadFacts {
  const now = new Date();
  const activities = lead.activities || [];
  const followUps = lead.followUps || [];

  // 1. Last Activity Calculation
  const lastActivityAt: Date | null = activities.length > 0 ? activities[0].createdAt : lead.updatedAt || lead.createdAt;

  // 2. Last Contact Calculation
  let lastContactAt: Date | null = lead.lastContactDate ? new Date(lead.lastContactDate) : null;
  // Look through activities for any completed follow-ups or notes that represent contact
  for (const act of activities) {
    if (act.type === "FOLLOWUP_COMPLETED") {
      if (!lastContactAt || act.createdAt.getTime() > lastContactAt.getTime()) {
        lastContactAt = act.createdAt;
      }
    }
  }

  // 3. Stale Detection
  const isTerminal = lead.status === "WON" || lead.status === "LOST";
  let isStale = false;
  let staleFor = "Active";
  let durationWithoutContact = "0 hours";

  if (!isTerminal) {
    const thresholdDays = STALE_THRESHOLDS_DAYS[lead.status] ?? 2;
    const referenceDate = lastContactAt || lead.createdAt;
    const diffMs = Math.max(0, now.getTime() - referenceDate.getTime());
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    durationWithoutContact = diffDays >= 1 ? `${diffDays} ${diffDays === 1 ? "day" : "days"}` : `${diffHours} ${diffHours === 1 ? "hour" : "hours"}`;

    if (diffDays >= thresholdDays) {
      isStale = true;
      staleFor = `No contact for ${durationWithoutContact}`;
    } else {
      isStale = false;
      staleFor = lastContactAt ? `Contacted ${formatTimeAgo(lastContactAt, now)}` : "Recently added";
    }
  } else {
    isStale = false;
    staleFor = lead.status === "WON" ? "Closed Won" : "Closed Lost";
    durationWithoutContact = "0 hours";
  }

  // 4. Stage Aging Calculation
  let stageEnteredAt: Date = lead.createdAt;
  let stageAgeEstimated = false;

  const statusChangeAct = activities.find((a) => {
    if (a.type !== "STATUS_CHANGED" || !a.metadata || typeof a.metadata !== "object" || Array.isArray(a.metadata)) {
      return false;
    }
    const meta = a.metadata as Record<string, unknown>;
    return meta.newStatus === lead.status;
  });



  if (statusChangeAct) {
    stageEnteredAt = statusChangeAct.createdAt;
    stageAgeEstimated = false;
  } else if (lead.status === "NEW") {
    stageEnteredAt = lead.createdAt;
    stageAgeEstimated = false;
  } else {
    // Legacy fallback
    stageEnteredAt = lead.updatedAt || lead.createdAt;
    stageAgeEstimated = true;
  }

  const stageDiffMs = Math.max(0, now.getTime() - stageEnteredAt.getTime());
  const stageAgeDays = Math.floor(stageDiffMs / (1000 * 60 * 60 * 24));
  const stageAgeHours = Math.floor(stageDiffMs / (1000 * 60 * 60));
  const stageAgeText =
    stageAgeDays >= 1
      ? `${stageAgeDays} ${stageAgeDays === 1 ? "day" : "days"}`
      : `${stageAgeHours} ${stageAgeHours === 1 ? "hour" : "hours"}`;

  // 5. Follow-Up Analysis
  const pendingFollowUps = followUps.filter((f) => f.status === "PENDING");
  const overdueFollowUps = pendingFollowUps.filter((f) => new Date(f.scheduledAt).getTime() < now.getTime());
  const completedFollowUps = followUps.filter((f) => f.status === "COMPLETED");

  const hasOverdueFollowUp = overdueFollowUps.length > 0;
  const earliestOverdue = overdueFollowUps[0];
  const overdueHours = earliestOverdue
    ? Math.max(1, Math.floor((now.getTime() - new Date(earliestOverdue.scheduledAt).getTime()) / (1000 * 60 * 60)))
    : 0;

  const nextUpcoming = pendingFollowUps.find((f) => new Date(f.scheduledAt).getTime() >= now.getTime());

  // 6. Recent Notes & Activities Summary (Limit to recent 5)
  const recentNotes: string[] = [];
  const recentActivitiesSummary: string[] = [];

  for (const act of activities.slice(0, 5)) {
    if (act.type === "NOTE_ADDED") {
      recentNotes.push(act.message);
    }
    recentActivitiesSummary.push(`${act.type}: ${act.message.slice(0, 100)}`);
  }

  const budgetNum = lead.budget !== null && lead.budget !== undefined ? Number(lead.budget) : null;
  const quotedNum = lead.quotedAmount !== null && lead.quotedAmount !== undefined ? Number(lead.quotedAmount) : null;

  return {
    leadId: lead.id,
    name: lead.name,
    status: lead.status,
    budget: budgetNum,
    quotedAmount: quotedNum,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    lastActivityAt,
    lastContactAt,
    isStale,
    staleFor,
    durationWithoutContact,
    stageEnteredAt,
    stageAgeDays,
    stageAgeText,
    stageAgeEstimated,
    hasOverdueFollowUp,
    overdueFollowUpCount: overdueFollowUps.length,
    overdueHours,
    pendingFollowUpCount: pendingFollowUps.length,
    nextFollowUpAt: nextUpcoming ? new Date(nextUpcoming.scheduledAt) : null,
    completedFollowUpCount: completedFollowUps.length,
    recentNotes,
    recentActivitiesSummary,
  };
}
