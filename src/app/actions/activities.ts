"use server";

import { ActivityType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ActivityActionResult, LeadActivity } from "@/features/activities/types";
import { markLeadAIInsightNeedsRefresh } from "@/features/ai-attention/services/attention-engine";

class UserFacingError extends Error {}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // safe in tests
  }
}

async function requireAuthenticatedUser() {
  const session = await getSession();
  if (!session || typeof session.id !== "string") {
    throw new UserFacingError("You must be signed in.");
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

function cleanError(error: unknown) {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof Error) {
    console.error("[Activities Action Error]:", error.message);
    if (error.message.includes("Foreign key") || error.message.includes("Unique constraint")) {
      return error.message;
    }
  }
  return "We could not save that note. Please try again.";
}

function serializeActivity(activity: import("@prisma/client").LeadActivity): LeadActivity {
  return {
    id: activity.id,
    leadId: activity.leadId,
    type: activity.type,
    message: activity.message,
    metadata: activity.metadata,
    createdByUserId: activity.createdByUserId,
    createdAt: activity.createdAt.toISOString(),
  };
}

export async function getLeadActivities(leadId: string): Promise<ActivityActionResult<LeadActivity[]>> {
  try {
    await requireAuthenticatedUser();
    if (!leadId) throw new UserFacingError("Lead ID is required.");
    const activities = await db.leadActivity.findMany({
      where: { leadId },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: activities.map(serializeActivity) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function addLeadNote(leadId: string, message: string): Promise<ActivityActionResult<LeadActivity>> {
  try {
    const session = await requireAuthenticatedUser();
    if (!leadId) throw new UserFacingError("Lead ID is required.");
    const text = message.trim();
    if (!text) throw new UserFacingError("Note cannot be empty.");
    if (text.length > 5000) throw new UserFacingError("Note is too long.");

    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new UserFacingError("Lead not found.");

    const validUserId = await resolveValidUserId(session.id);

    const activity = await db.leadActivity.create({
      data: {
        leadId,
        type: ActivityType.NOTE_ADDED,
        message: text,
        createdByUserId: validUserId,
      },
    });

    await markLeadAIInsightNeedsRefresh(leadId);

    safeRevalidatePath("/dashboard");
    safeRevalidatePath("/leads");
    safeRevalidatePath(`/leads/${leadId}`);

    return { success: true, data: serializeActivity(activity) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function updateLeadNote(activityId: string, message: string): Promise<ActivityActionResult<LeadActivity>> {
  try {
    const session = await requireAuthenticatedUser();
    if (!activityId) throw new UserFacingError("Activity ID is required.");
    const text = message.trim();
    if (!text) throw new UserFacingError("Note cannot be empty.");
    if (text.length > 5000) throw new UserFacingError("Note is too long.");

    const activity = await db.leadActivity.findUnique({ where: { id: activityId } });
    if (!activity) throw new UserFacingError("Activity not found.");
    if (activity.type !== ActivityType.NOTE_ADDED) throw new UserFacingError("Only notes can be edited.");
    if (activity.createdByUserId && activity.createdByUserId !== session.id) {
      throw new UserFacingError("You can only edit your own notes.");
    }

    const updated = await db.leadActivity.update({
      where: { id: activityId },
      data: { message: text },
    });

    await markLeadAIInsightNeedsRefresh(activity.leadId);

    safeRevalidatePath("/dashboard");
    safeRevalidatePath("/leads");
    safeRevalidatePath(`/leads/${activity.leadId}`);

    return { success: true, data: serializeActivity(updated) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function deleteLeadNote(activityId: string): Promise<ActivityActionResult<{ id: string }>> {
  try {
    const session = await requireAuthenticatedUser();
    if (!activityId) throw new UserFacingError("Activity ID is required.");
    const activity = await db.leadActivity.findUnique({ where: { id: activityId } });
    if (!activity) throw new UserFacingError("Activity not found.");
    if (activity.type !== ActivityType.NOTE_ADDED) throw new UserFacingError("Only notes can be deleted.");
    if (activity.createdByUserId && activity.createdByUserId !== session.id) {
      throw new UserFacingError("You can only delete your own notes.");
    }

    await db.leadActivity.delete({ where: { id: activityId } });
    await markLeadAIInsightNeedsRefresh(activity.leadId);

    safeRevalidatePath("/dashboard");
    safeRevalidatePath("/leads");
    safeRevalidatePath(`/leads/${activity.leadId}`);

    return { success: true, data: { id: activityId } };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}
