"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  NOTIFICATION_TYPE_LABELS,
  PRISMA_TO_PRIORITY_MAP,
  PRISMA_TO_STATUS_MAP,
  PRISMA_TO_TYPE_MAP,
  STATUS_MAP,
  type SmartNotification,
  type NotificationFilter,
  type NotificationActionResult,
  type NotificationStatusKey,
} from "@/features/notifications/types";
import { generateSmartNotifications } from "@/features/notifications/services/notification-generator";
import { NotificationStatus, NotificationPriority, Prisma } from "@prisma/client";

class UserFacingError extends Error {}

async function requireAuthenticatedUser() {
  const session = await getSession();
  if (!session || typeof session.id !== "string") {
    throw new UserFacingError("You must be signed in to manage notifications.");
  }
  return session;
}

function cleanError(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred with notifications.";
}

function serializeNotification(
  record: import("@prisma/client").SalesNotification & {
    lead?: (import("@prisma/client").Lead & { followUps?: import("@prisma/client").FollowUp[] }) | null;
  }
): SmartNotification {
  const typeKey = PRISMA_TO_TYPE_MAP[record.type] || "ai_recommended_action";
  const priorityKey = PRISMA_TO_PRIORITY_MAP[record.priority] || "normal";
  const statusKey = PRISMA_TO_STATUS_MAP[record.status] || "unread";

  const nextFollowUp = record.lead?.followUps?.[0];
  const dueDateStr = nextFollowUp
    ? nextFollowUp.scheduledAt.toISOString()
    : null;

  return {
    id: record.id,
    leadId: record.leadId || "",
    leadName: record.lead?.name || "CRM Alert",
    business: record.lead?.business,
    phone: record.lead?.phone,
    type: typeKey,
    rawType: record.type,
    typeLabel: NOTIFICATION_TYPE_LABELS[record.type] || record.type,
    priority: priorityKey,
    rawPriority: record.priority,
    reason: record.reason,
    timestamp: record.createdAt.toISOString(),
    recommendedAction: record.recommendedAction,
    status: statusKey,
    rawStatus: record.status,
    amount: record.lead?.quotedAmount
      ? Number(record.lead.quotedAmount)
      : record.lead?.budget
      ? Number(record.lead.budget)
      : null,
    stage: record.lead?.status,
    dueDate: dueDateStr,
    readAt: record.readAt?.toISOString() || null,
    resolvedAt: record.resolvedAt?.toISOString() || null,
  };
}

/**
 * Lists smart notifications with optional filtering.
 */
export async function getNotifications(options?: {
  filter?: NotificationFilter;
  status?: NotificationStatusKey;
  limit?: number;
}): Promise<NotificationActionResult<SmartNotification[]>> {
  try {
    await requireAuthenticatedUser();

    // Auto-generate notifications if none exist or periodic refresh
    const count = await db.salesNotification.count();
    if (count === 0) {
      await generateSmartNotifications();
    }

    const where: Prisma.SalesNotificationWhereInput = {};
    const filter = options?.filter || "all";

    if (options?.status) {
      const prismaStatus = STATUS_MAP[options.status];
      if (prismaStatus) where.status = prismaStatus;
    } else {
      // By default exclude dismissed unless specifically requested
      if (filter !== "resolved") {
        where.status = { in: [NotificationStatus.UNREAD, NotificationStatus.READ] };
      }
    }

    if (filter === "critical") {
      where.priority = NotificationPriority.CRITICAL;
    } else if (filter === "important") {
      where.priority = NotificationPriority.IMPORTANT;
    } else if (filter === "today") {
      where.type = "FOLLOWUP_DUE_TODAY";
    } else if (filter === "overdue") {
      where.type = "OVERDUE_FOLLOWUP";
    } else if (filter === "ai_suggestions") {
      where.type = { in: ["AI_RECOMMENDED_ACTION", "HOT_LEAD_ATTENTION"] };
    } else if (filter === "resolved") {
      where.status = NotificationStatus.RESOLVED;
    }

    const notifications = await db.salesNotification.findMany({
      where,
      include: {
        lead: {
          include: {
            followUps: {
              where: { status: "PENDING" },
              orderBy: { scheduledAt: "asc" },
              take: 1,
            },
          },
        },
      },
      orderBy: [
        { priority: "asc" }, // CRITICAL first
        { createdAt: "desc" },
      ],
      take: options?.limit || 50,
    });

    return {
      success: true,
      data: notifications.map(serializeNotification),
    };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Marks a notification as READ.
 */
export async function markNotificationRead(
  id: string
): Promise<NotificationActionResult<SmartNotification>> {
  try {
    await requireAuthenticatedUser();
    const updated = await db.salesNotification.update({
      where: { id },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
      include: { lead: true },
    });

    try {
      revalidatePath("/notifications");
      revalidatePath("/dashboard");
    } catch {
      // safe in tests
    }

    return { success: true, data: serializeNotification(updated) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Marks a notification as RESOLVED / DONE.
 */
export async function markNotificationResolved(
  id: string
): Promise<NotificationActionResult<SmartNotification>> {
  try {
    await requireAuthenticatedUser();
    const updated = await db.salesNotification.update({
      where: { id },
      data: {
        status: NotificationStatus.RESOLVED,
        resolvedAt: new Date(),
      },
      include: { lead: true },
    });

    try {
      revalidatePath("/notifications");
      revalidatePath("/dashboard");
    } catch {
      // safe in tests
    }

    return { success: true, data: serializeNotification(updated) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Dismisses a notification so it no longer clutters the active list.
 */
export async function dismissNotification(
  id: string
): Promise<NotificationActionResult<{ id: string }>> {
  try {
    await requireAuthenticatedUser();
    await db.salesNotification.update({
      where: { id },
      data: {
        status: NotificationStatus.DISMISSED,
      },
    });

    try {
      revalidatePath("/notifications");
      revalidatePath("/dashboard");
    } catch {
      // safe in tests
    }

    return { success: true, data: { id } };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Refreshes smart notifications across all CRM leads.
 */
export async function refreshSmartNotifications(): Promise<
  NotificationActionResult<{ created: number; skipped: number }>
> {
  try {
    await requireAuthenticatedUser();
    const result = await generateSmartNotifications();
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}
