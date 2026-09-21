"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActivityType, LeadStatus, type LeadLossReason as PrismaLeadLossReason } from "@prisma/client";
import {
  UI_TO_PRISMA_LOST_REASON,
  LOST_REASON_LABELS,
  type LeadLossRecord,
  type LostReasonsAnalyticsData,
  type LostReasonStat,
  type LostReasonActionResult,
} from "@/features/lost-reasons/types";
import { markLeadAIInsightNeedsRefresh } from "@/features/ai-attention/services/attention-engine";
import { recordUndoAction } from "@/features/undo/services/undo-engine";
import { touchCrmSync } from "@/lib/crm-sync";

class UserFacingError extends Error {}

async function requireAuthenticatedUser() {
  const session = await getSession();
  if (!session || typeof session.id !== "string") {
    throw new UserFacingError("You must be signed in to perform this action.");
  }
  return session;
}

async function resolveValidUserId(userId: unknown): Promise<string | null> {
  if (!userId || typeof userId !== "string") return null;
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    return user?.id ?? null;
  } catch {
    return null;
  }
}

function cleanError(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred while processing lost reason.";
}

function serializeLossEvent(event: import("@prisma/client").LeadLossEvent): LeadLossRecord {
  return {
    id: event.id,
    leadId: event.leadId,
    reason: event.reason,
    reasonLabel: LOST_REASON_LABELS[event.reason] || event.reason,
    note: event.note,
    lostAt: event.lostAt.toISOString(),
    createdByUserId: event.createdByUserId,
    createdAt: event.createdAt.toISOString(),
  };
}

/**
 * Transactionally marks a lead as LOST with a required reason.
 * Creates a persistent LeadLossEvent record and STATUS_CHANGED activity.
 * If reason is OTHER, a descriptive note is mandatory.
 */
export async function markLeadLost(
  leadId: string,
  rawReason: string,
  rawNote?: string
): Promise<LostReasonActionResult<{ leadId: string; lossEvent: LeadLossRecord }>> {
  try {
    const session = await requireAuthenticatedUser();
    const validUserId = await resolveValidUserId(session.id);

    if (!leadId) {
      throw new UserFacingError("Lead ID is required.");
    }

    const prismaReason = UI_TO_PRISMA_LOST_REASON[rawReason as keyof typeof UI_TO_PRISMA_LOST_REASON] as PrismaLeadLossReason;
    if (!prismaReason) {
      throw new UserFacingError("A valid lost reason must be selected.");
    }

    const note = rawNote?.trim() || null;
    if (prismaReason === "OTHER" && (!note || note.length === 0)) {
      throw new UserFacingError("A note/explanation is strictly required when selecting 'Other' as the loss reason.");
    }

    const lead = await db.lead.findUnique({
      where: { id: leadId },
      select: { id: true, status: true, name: true, nextFollowUpDate: true },
    });

    if (!lead) {
      throw new UserFacingError("Lead not found.");
    }

    const oldStatus = lead.status;
    const reasonLabel = LOST_REASON_LABELS[prismaReason] || rawReason;

    const lossEvent = await db.$transaction(async (tx) => {
      // 1. Update lead status to LOST and clear nextFollowUpDate
      await tx.lead.update({
        where: { id: leadId },
        data: {
          status: LeadStatus.LOST,
          nextFollowUpDate: null,
        },
      });

      // 2. Safely cancel any existing PENDING follow-up for this lead (preserving history)
      const pendingFollowUps = await tx.followUp.findMany({
        where: {
          leadId,
          status: "PENDING",
        },
      });

      if (pendingFollowUps.length > 0) {
        await tx.followUp.updateMany({
          where: {
            leadId,
            status: "PENDING",
          },
          data: {
            status: "CANCELLED",
          },
        });

        for (const fu of pendingFollowUps) {
          await tx.leadActivity.create({
            data: {
              leadId,
              type: ActivityType.FOLLOWUP_CANCELLED,
              message: `Cancelled ${fu.type} follow-up (Lead marked Lost)`,
              metadata: {
                type: fu.type,
                followUpId: fu.id,
                reason: "LEAD_MARKED_LOST",
              },
              createdByUserId: validUserId,
            },
          });
        }
      }

      // 3. Create persistent LeadLossEvent
      const event = await tx.leadLossEvent.create({
        data: {
          leadId,
          reason: prismaReason,
          note,
          lostAt: new Date(),
          createdByUserId: validUserId,
        },
      });

      // 4. Create STATUS_CHANGED activity with loss metadata
      const activityMessage = `Status changed to Lost (Reason: ${reasonLabel}${note ? ` - ${note}` : ""})`;
      await tx.leadActivity.create({
        data: {
          leadId,
          type: ActivityType.STATUS_CHANGED,
          message: activityMessage,
          metadata: {
            oldStatus,
            newStatus: LeadStatus.LOST,
            lossReason: prismaReason,
            lossReasonLabel: reasonLabel,
            note,
            lossEventId: event.id,
          },
          createdByUserId: validUserId,
        },
      });

      // 5. Mark AI insight needs refresh
      await markLeadAIInsightNeedsRefresh(leadId, tx);

      const cancelledFollowUp = pendingFollowUps[0];
      const undoRecord = await recordUndoAction(tx, {
        actionType: "LEAD_STATUS_CHANGE",
        entityType: "LEAD",
        entityId: leadId,
        leadId,
        beforeSnapshot: {
          status: oldStatus,
          cancelledFollowUpId: cancelledFollowUp?.id,
          nextFollowUpDate: lead.nextFollowUpDate ? lead.nextFollowUpDate.toISOString() : (cancelledFollowUp?.scheduledAt ? cancelledFollowUp.scheduledAt.toISOString() : null),
        },
        afterSnapshot: { status: LeadStatus.LOST, lossEventId: event.id },
        description: `Lead marked as Lost (${reasonLabel})`,
        createdByUserId: validUserId,
      });

      await touchCrmSync(tx);

      return { event, undoId: undoRecord.id };
    });

    try {
      revalidatePath("/leads");
      revalidatePath("/pipeline");
      revalidatePath("/dashboard");
      revalidatePath("/analytics");
      revalidatePath("/follow-ups");
      revalidatePath(`/leads/${leadId}`);
    } catch {
      // safe in tests
    }

    return {
      success: true,
      data: {
        leadId,
        lossEvent: serializeLossEvent(lossEvent.event),
      },
      undoId: lossEvent.undoId,
    };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Returns all historical loss events for a lead (preserved across re-openings).
 */
export async function getLeadLossHistory(
  leadId: string
): Promise<LostReasonActionResult<LeadLossRecord[]>> {
  try {
    await requireAuthenticatedUser();

    const events = await db.leadLossEvent.findMany({
      where: { leadId },
      orderBy: { lostAt: "desc" },
    });

    return {
      success: true,
      data: events.map(serializeLossEvent),
    };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Aggregates lost reasons across time periods (7d, 30d, 90d, all).
 */
export async function getLostReasonsAnalytics(
  period: "7d" | "30d" | "90d" | "all" = "30d"
): Promise<LostReasonActionResult<LostReasonsAnalyticsData>> {
  try {
    await requireAuthenticatedUser();

    const now = new Date();
    let startDate: Date | null = null;

    if (period === "7d") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "30d") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (period === "90d") {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    const where: { lostAt?: { gte: Date } } = {};
    if (startDate) {
      where.lostAt = { gte: startDate };
    }

    const events = await db.leadLossEvent.findMany({
      where,
      select: { reason: true },
    });

    const totalLost = events.length;

    // Count occurrences per reason
    const counts: Record<string, number> = {};
    for (const event of events) {
      counts[event.reason] = (counts[event.reason] || 0) + 1;
    }

    const allReasons: PrismaLeadLossReason[] = [
      "PRICE",
      "NO_RESPONSE",
      "TIMING",
      "COMPETITOR",
      "TRUST",
      "NOT_QUALIFIED",
      "REQUIREMENT_CHANGED",
      "NO_URGENCY",
      "OTHER",
    ];

    const breakdown: LostReasonStat[] = allReasons.map((reason) => {
      const count = counts[reason] || 0;
      const percentage = totalLost > 0 ? Math.round((count / totalLost) * 1000) / 10 : 0;
      return {
        reason,
        label: LOST_REASON_LABELS[reason] || reason,
        count,
        percentage,
      };
    });

    // Sort by count descending
    breakdown.sort((a, b) => b.count - a.count);

    const topReason = totalLost > 0 && breakdown[0].count > 0 ? breakdown[0] : null;

    return {
      success: true,
      data: {
        totalLost,
        period,
        breakdown,
        topReason,
      },
    };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}
