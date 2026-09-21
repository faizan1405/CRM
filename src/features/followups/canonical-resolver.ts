import { db } from "@/lib/db";
import { FollowUp, FollowUpStatus, FollowUpType, statusFromDatabase, typeFromDatabase } from "./types";
import { Prisma } from "@prisma/client";

/**
 * Returns today's date string in Asia/Kolkata timezone (YYYY-MM-DD).
 */
export function getKolkataTodayString(referenceDate: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(referenceDate);
}

/**
 * Categorizes a follow-up scheduled date strictly in Asia/Kolkata timezone:
 * - "today": scheduled calendar date equals today in IST
 * - "overdue": scheduled calendar date is before today in IST
 * - "upcoming": scheduled calendar date is after today in IST
 */
export function categorizeFollowUpTab(
  scheduledAt: Date | string,
  now: Date = new Date()
): "today" | "overdue" | "upcoming" {
  const targetDate = typeof scheduledAt === "string" ? new Date(scheduledAt) : scheduledAt;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const todayString = formatter.format(now);
  const scheduledString = formatter.format(targetDate);

  if (scheduledString < todayString) {
    return "overdue";
  }
  if (scheduledString === todayString) {
    return "today";
  }
  return "upcoming";
}

/**
 * Serializes a database follow-up record to the standard FollowUp type.
 */
export function serializeActiveFollowUp(
  raw: {
    id: string;
    leadId: string;
    scheduledAt: Date;
    type: string;
    status: string;
    note: string | null;
    completedAt: Date | null;
    submissionId?: string | null;
    createdAt: Date;
    updatedAt: Date;
    lead?: {
      id: string;
      name: string;
      business: string | null;
      phone: string;
      status: string;
      isPinned?: boolean;
    } | null;
    leadNote?: string;
  }
): FollowUp {
  const mappedType: FollowUpType = (typeFromDatabase as Record<string, FollowUpType>)[raw.type] ?? "Call";
  const mappedStatus: FollowUpStatus = (statusFromDatabase as Record<string, FollowUpStatus>)[raw.status] ?? "Pending";

  return {
    id: raw.id,
    leadId: raw.leadId,
    scheduledAt: raw.scheduledAt.toISOString(),
    type: mappedType,
    status: mappedStatus,
    note: raw.note ?? "",
    completedAt: raw.completedAt ? raw.completedAt.toISOString() : null,
    submissionId: raw.submissionId ?? null,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
    lead: raw.lead
      ? {
          id: raw.lead.id,
          name: raw.lead.name,
          business: raw.lead.business ?? "",
          phone: raw.lead.phone,
          status: raw.lead.status,
          isPinned: Boolean(raw.lead.isPinned),
        }
      : undefined,
    leadNote: raw.leadNote,
  };
}

/**
 * Retrieves the single active PENDING follow-up for a lead.
 * If multiple exist in database prior to reconciliation, picks the most recently updated.
 */
export async function getActiveFollowUpForLead(leadId: string): Promise<FollowUp | null> {
  const row = await db.followUp.findFirst({
    where: {
      leadId,
      status: "PENDING",
      lead: {
        status: { not: "LOST" },
        deletedAt: null,
        mergedIntoLeadId: null,
      },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      lead: {
        select: {
          id: true,
          name: true,
          business: true,
          phone: true,
          status: true,
          isPinned: true,
        },
      },
    },
  });

  return row ? serializeActiveFollowUp(row) : null;
}
