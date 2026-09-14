"use server";

import { ActivityType, Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ActivityActionResult, LeadActivity } from "@/features/activities/types";

class UserFacingError extends Error {}

async function requireAuthenticatedUser() {
  const session = await getSession();
  if (!session || typeof session.id !== "string") {
    throw new UserFacingError("You must be signed in.");
  }
  return session;
}

function cleanError(error: unknown) {
  if (error instanceof UserFacingError) return error.message;
  return "We could not save that change. Please try again.";
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
    const text = message.trim();
    if (!text) throw new UserFacingError("Note cannot be empty.");
    if (text.length > 5000) throw new UserFacingError("Note is too long.");

    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new UserFacingError("Lead not found.");

    const activity = await db.leadActivity.create({
      data: {
        leadId,
        type: ActivityType.NOTE_ADDED,
        message: text,
        createdByUserId: session.id as string,
      },
    });

    return { success: true, data: serializeActivity(activity) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function updateLeadNote(activityId: string, message: string): Promise<ActivityActionResult<LeadActivity>> {
  try {
    const session = await requireAuthenticatedUser();
    const text = message.trim();
    if (!text) throw new UserFacingError("Note cannot be empty.");
    if (text.length > 5000) throw new UserFacingError("Note is too long.");

    const activity = await db.leadActivity.findUnique({ where: { id: activityId } });
    if (!activity) throw new UserFacingError("Activity not found.");
    if (activity.type !== ActivityType.NOTE_ADDED) throw new UserFacingError("Only notes can be edited.");
    if (activity.createdByUserId !== session.id) throw new UserFacingError("You can only edit your own notes.");

    const updated = await db.leadActivity.update({
      where: { id: activityId },
      data: { message: text },
    });

    return { success: true, data: serializeActivity(updated) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function deleteLeadNote(activityId: string): Promise<ActivityActionResult<{ id: string }>> {
  try {
    const session = await requireAuthenticatedUser();
    const activity = await db.leadActivity.findUnique({ where: { id: activityId } });
    if (!activity) throw new UserFacingError("Activity not found.");
    if (activity.type !== ActivityType.NOTE_ADDED) throw new UserFacingError("Only notes can be deleted.");
    if (activity.createdByUserId !== session.id) throw new UserFacingError("You can only delete your own notes.");

    await db.leadActivity.delete({ where: { id: activityId } });
    return { success: true, data: { id: activityId } };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}
