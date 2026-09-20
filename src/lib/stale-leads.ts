import { db } from "@/lib/db";
import { LeadStatus } from "@prisma/client";

export const STALE_THRESHOLD_DAYS = 3;

export type MeaningfulActivity = {
  timestamp: Date;
  type: string;
  description: string;
};

export type LeadStaleInfo = {
  isStale: boolean;
  inactivityDays: number;
  lastMeaningfulActivity: MeaningfulActivity;
  staleLabel: string;
  inactivityText: string;
  warningMessage: string;
};

export type LeadInputForStaleness = {
  id?: string;
  status: string;
  isWaste?: boolean;
  deletedAt?: Date | string | null;
  mergedIntoLeadId?: string | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
  lastContactDate?: Date | string | null;
  activities?: Array<{
    type?: string;
    message?: string;
    createdAt: Date | string;
    metadata?: unknown;
  }>;
  lastActivity?: {
    message: string;
    createdAt: string;
    type?: string;
  } | null;
};

/**
 * Returns the last meaningful CRM activity for a lead.
 * If no meaningful activity exists, falls back to Lead.createdAt.
 */
export function getLastMeaningfulActivity(lead: LeadInputForStaleness): MeaningfulActivity {
  const fallbackDate = new Date(lead.createdAt);

  let latestDate: Date | null = null;
  let latestType = "LEAD_CREATED";
  let latestDesc = "Lead created";

  // 1. Check activities array if present
  if (lead.activities && lead.activities.length > 0) {
    for (const act of lead.activities) {
      const actDate = new Date(act.createdAt);
      if (Number.isNaN(actDate.getTime())) continue;

      if (!latestDate || actDate.getTime() > latestDate.getTime()) {
        latestDate = actDate;
        latestType = act.type || "ACTIVITY";
        latestDesc = getMeaningfulDescription(act.type, act.message);
      }
    }
  }

  // 2. Check lastActivity if no activities array or if lastActivity is newer
  if (lead.lastActivity && lead.lastActivity.createdAt) {
    const actDate = new Date(lead.lastActivity.createdAt);
    if (!Number.isNaN(actDate.getTime())) {
      if (!latestDate || actDate.getTime() > latestDate.getTime()) {
        latestDate = actDate;
        latestType = lead.lastActivity.type || "ACTIVITY";
        latestDesc = getMeaningfulDescription(lead.lastActivity.type, lead.lastActivity.message);
      }
    }
  }

  // 3. Check lastContactDate if present and more recent
  if (lead.lastContactDate) {
    const contactDate = new Date(lead.lastContactDate);
    if (!Number.isNaN(contactDate.getTime())) {
      if (!latestDate || contactDate.getTime() > latestDate.getTime()) {
        latestDate = contactDate;
        latestType = "CONTACT_LOGGED";
        latestDesc = "Contact logged";
      }
    }
  }

  // 4. Fallback if no activity found
  if (!latestDate) {
    return {
      timestamp: fallbackDate,
      type: "LEAD_CREATED",
      description: "Lead created",
    };
  }

  return {
    timestamp: latestDate,
    type: latestType,
    description: latestDesc,
  };
}

function getMeaningfulDescription(type?: string, message?: string): string {
  if (type === "STATUS_CHANGED") {
    if (message?.toLowerCase().includes("proposal")) return "Proposal sent";
    return "Status changed";
  }
  if (type === "WHATSAPP_OPENED") return "WhatsApp contact";
  if (type === "NOTE_ADDED") return "Note added";
  if (type === "FOLLOWUP_COMPLETED") return "Follow-up completed";
  if (type === "FOLLOWUP_CREATED" || type === "FOLLOWUP_RESCHEDULED") return "Follow-up scheduled";
  if (type === "LEAD_UPDATED") return "Lead updated";
  if (type === "LEAD_CREATED") return "Lead created";
  if (message) return message.slice(0, 50);
  return "Activity logged";
}

/**
 * Calculates staleness of a lead based on the canonical 3-day locked rule.
 */
export function calculateLeadStaleness(
  lead: LeadInputForStaleness,
  now: Date = new Date()
): LeadStaleInfo {
  const normStatus = (lead.status || "").toUpperCase();
  const isTerminal = normStatus === "WON" || normStatus === "LOST";
  const isDeleted = Boolean(lead.deletedAt);
  const isWaste = Boolean(lead.isWaste);

  const lastActivity = getLastMeaningfulActivity(lead);
  const diffMs = Math.max(0, now.getTime() - lastActivity.timestamp.getTime());
  const inactivityDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Inactivity text (e.g. "3 days ago")
  let inactivityText = "";
  if (inactivityDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      inactivityText = diffMins <= 1 ? "just now" : `${diffMins} minutes ago`;
    } else {
      inactivityText = diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
    }
  } else {
    inactivityText = inactivityDays === 1 ? "1 day ago" : `${inactivityDays} days ago`;
  }

  // Locked Stale Rule:
  // Must be active, not waste, not deleted, not merged, not WON, not LOST, and no meaningful activity for 3 full days.
  const isMerged = Boolean((lead as { mergedIntoLeadId?: string | null }).mergedIntoLeadId);
  if (isTerminal || isDeleted || isWaste || isMerged) {
    return {
      isStale: false,
      inactivityDays,
      lastMeaningfulActivity: lastActivity,
      staleLabel: "",
      inactivityText,
      warningMessage: "",
    };
  }

  const isStale = inactivityDays >= STALE_THRESHOLD_DAYS;

  let staleLabel = "";
  let warningMessage = "";

  if (isStale) {
    const isProposal = normStatus === "PROPOSAL_SENT" || normStatus === "PROPOSAL SENT";
    const isContactActivity =
      lastActivity.type === "WHATSAPP_OPENED" ||
      lastActivity.type === "CONTACT_LOGGED" ||
      lastActivity.type === "FOLLOWUP_COMPLETED" ||
      lastActivity.description.toLowerCase().includes("contact") ||
      lastActivity.description.toLowerCase().includes("call") ||
      lastActivity.description.toLowerCase().includes("whatsapp");

    const daysText = `${inactivityDays} ${inactivityDays === 1 ? "day" : "days"}`;

    if (isProposal) {
      staleLabel = `Stale · Proposal waiting ${daysText}`;
      warningMessage = `Proposal has had no follow-up activity for ${daysText}.`;
    } else if (isContactActivity) {
      staleLabel = `Stale · No contact for ${daysText}`;
      warningMessage = `No meaningful activity for ${daysText}.`;
    } else {
      staleLabel = `Stale · No activity for ${daysText}`;
      warningMessage = `No meaningful activity for ${daysText}.`;
    }
  }

  return {
    isStale,
    inactivityDays,
    lastMeaningfulActivity: lastActivity,
    staleLabel,
    inactivityText,
    warningMessage,
  };
}

/**
 * Fetch all stale leads from the database without N+1 queries.
 */
export async function getStaleLeads() {
  const activeLeads = await db.lead.findMany({
    where: {
      isWaste: false,
      deletedAt: null,
      mergedIntoLeadId: null,
      status: {
        in: [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED, LeadStatus.PROPOSAL_SENT],
      },
    },
    include: {
      activities: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          type: true,
          message: true,
          metadata: true,
          createdAt: true,
        },
      },
    },
  });

  const now = new Date();
  return activeLeads
    .map((lead) => ({
      ...lead,
      staleInfo: calculateLeadStaleness(lead, now),
    }))
    .filter((lead) => lead.staleInfo.isStale);
}

/**
 * Count total stale leads without N+1 queries.
 */
export async function getStaleLeadsCount(): Promise<number> {
  const activeLeads = await db.lead.findMany({
    where: {
      isWaste: false,
      deletedAt: null,
      mergedIntoLeadId: null,
      status: {
        in: [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED, LeadStatus.PROPOSAL_SENT],
      },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      lastContactDate: true,
      activities: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { type: true, message: true, createdAt: true },
      },
    },
  });

  const now = new Date();
  return activeLeads.filter((lead) => calculateLeadStaleness(lead, now).isStale).length;
}
