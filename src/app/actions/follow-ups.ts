"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  FollowUp,
  FollowUpActionResult,
  typeToDatabase,
  statusFromDatabase,
  typeFromDatabase,
} from "@/features/followups/types";
import { ActivityType } from "@prisma/client";
import { markLeadAIInsightNeedsRefresh } from "@/features/ai-attention/services/attention-engine";

class UserFacingError extends Error {}

async function requireAuthenticatedUser() {
  const session = await getSession();
  if (!session || typeof session.id !== "string") {
    throw new UserFacingError("You must be signed in to manage follow-ups.");
  }
  return session;
}

function cleanError(error: unknown) {
  if (error instanceof UserFacingError) return error.message;
  return "We could not save that change. Please try again.";
}

function serializeFollowUp(
  followUp: import("@prisma/client").FollowUp & { lead?: import("@prisma/client").Lead | null }
): FollowUp {
  return {
    id: followUp.id,
    leadId: followUp.leadId,
    scheduledAt: followUp.scheduledAt.toISOString(),
    type: typeFromDatabase[followUp.type as keyof typeof typeFromDatabase],
    status: statusFromDatabase[followUp.status as keyof typeof statusFromDatabase],
    note: followUp.note ?? "",
    completedAt: followUp.completedAt?.toISOString() ?? null,
    createdAt: followUp.createdAt.toISOString(),
    updatedAt: followUp.updatedAt.toISOString(),
    lead: followUp.lead
      ? {
          id: followUp.lead.id,
          name: followUp.lead.name,
          business: followUp.lead.business ?? "",
          phone: followUp.lead.phone,
          status: followUp.lead.status,
        }
      : undefined,
  };
}

async function syncNextFollowUpDate(leadId: string) {
  const earliest = await db.followUp.findFirst({
    where: { leadId, status: "PENDING" },
    orderBy: { scheduledAt: "asc" },
  });

  await db.lead.update({
    where: { id: leadId },
    data: { nextFollowUpDate: earliest ? earliest.scheduledAt : null },
  });
}

export async function createFollowUp(formData: FormData): Promise<FollowUpActionResult<FollowUp>> {
  try {
    const session = await requireAuthenticatedUser();
    const leadId = String(formData.get("leadId") ?? "").trim();
    if (!leadId) throw new UserFacingError("Lead ID is required.");

    const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();
    if (!scheduledAtRaw) throw new UserFacingError("Schedule date is required.");
    const scheduledAt = new Date(scheduledAtRaw);
    if (isNaN(scheduledAt.getTime())) throw new UserFacingError("Invalid schedule date.");

    const typeRaw = String(formData.get("type") ?? "").trim() as keyof typeof typeToDatabase;
    const type = typeToDatabase[typeRaw];
    if (!type) throw new UserFacingError("Invalid follow-up type.");

    const note = String(formData.get("note") ?? "").trim();
    if (note.length > 5000) throw new UserFacingError("Note must be 5000 characters or fewer.");

    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new UserFacingError("Lead not found.");

    const followUp = await db.$transaction(async (tx) => {
      const newFollowUp = await tx.followUp.create({
        data: {
          leadId,
          scheduledAt,
          type,
          note: note || null,
          status: "PENDING",
        },
        include: { lead: true },
      });

      await tx.leadActivity.create({
        data: {
          leadId: newFollowUp.leadId,
          type: ActivityType.FOLLOWUP_CREATED,
          message: `Scheduled a ${newFollowUp.type} follow-up for ${newFollowUp.scheduledAt.toLocaleDateString()}`,
          metadata: { type: newFollowUp.type, scheduledAt: newFollowUp.scheduledAt },
          createdByUserId: session.id as string,
        },
      });

      await markLeadAIInsightNeedsRefresh(leadId, tx);

      return newFollowUp;
    });

    await syncNextFollowUpDate(leadId);

    revalidatePath("/dashboard");
    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);
    return { success: true, data: serializeFollowUp(followUp) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function getFollowUps(): Promise<FollowUpActionResult<{
  overdue: FollowUp[];
  today: FollowUp[];
  upcoming: FollowUp[];
  completed: FollowUp[];
}>> {
  try {
    await requireAuthenticatedUser();
    const followUps = await db.followUp.findMany({
      include: { lead: true },
      orderBy: { scheduledAt: "asc" },
    });

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
    const todayString = formatter.format(now);

    const result = {
      overdue: [] as FollowUp[],
      today: [] as FollowUp[],
      upcoming: [] as FollowUp[],
      completed: [] as FollowUp[],
    };

    for (const f of followUps) {
      const serialized = serializeFollowUp(f);
      if (f.status === "COMPLETED") {
        result.completed.push(serialized);
        continue;
      }
      if (f.status === "CANCELLED") continue;

      const fDateString = formatter.format(f.scheduledAt);
      if (fDateString < todayString) {
        result.overdue.push(serialized);
      } else if (fDateString === todayString) {
        result.today.push(serialized);
      } else {
        result.upcoming.push(serialized);
      }
    }

    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function getFollowUpsForLead(leadId: string): Promise<FollowUpActionResult<FollowUp[]>> {
  try {
    await requireAuthenticatedUser();
    const followUps = await db.followUp.findMany({
      where: { leadId },
      include: { lead: true },
      orderBy: { scheduledAt: "asc" },
    });
    return { success: true, data: followUps.map(serializeFollowUp) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function updateFollowUp(id: string, formData: FormData): Promise<FollowUpActionResult<FollowUp>> {
  try {
    const session = await requireAuthenticatedUser();
    
    const existing = await db.followUp.findUnique({ where: { id } });
    if (!existing) throw new UserFacingError("Follow-up not found.");

    const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();
    if (!scheduledAtRaw) throw new UserFacingError("Schedule date is required.");
    const scheduledAt = new Date(scheduledAtRaw);
    if (isNaN(scheduledAt.getTime())) throw new UserFacingError("Invalid schedule date.");

    const typeRaw = String(formData.get("type") ?? "").trim() as keyof typeof typeToDatabase;
    const type = typeToDatabase[typeRaw];
    if (!type) throw new UserFacingError("Invalid follow-up type.");

    const note = String(formData.get("note") ?? "").trim();
    if (note.length > 5000) throw new UserFacingError("Note must be 5000 characters or fewer.");

    const followUp = await db.$transaction(async (tx) => {
      const updatedFollowUp = await tx.followUp.update({
        where: { id },
        data: {
          scheduledAt,
          type,
          note: note || null,
        },
        include: { lead: true },
      });

      if (existing.scheduledAt.getTime() !== updatedFollowUp.scheduledAt.getTime()) {
        await tx.leadActivity.create({
          data: {
            leadId: updatedFollowUp.leadId,
            type: ActivityType.FOLLOWUP_RESCHEDULED,
            message: `Follow-up rescheduled from ${existing.scheduledAt.toLocaleDateString()} to ${updatedFollowUp.scheduledAt.toLocaleDateString()}`,
            metadata: { 
              scheduledAtBefore: existing.scheduledAt, 
              scheduledAtAfter: updatedFollowUp.scheduledAt,
              type: updatedFollowUp.type 
            },
            createdByUserId: session.id as string,
          },
        });
      }

      await markLeadAIInsightNeedsRefresh(updatedFollowUp.leadId, tx);

      return updatedFollowUp;
    });

    await syncNextFollowUpDate(followUp.leadId);

    revalidatePath("/dashboard");
    revalidatePath("/leads");
    revalidatePath(`/leads/${followUp.leadId}`);
    return { success: true, data: serializeFollowUp(followUp) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function markFollowUpComplete(id: string): Promise<FollowUpActionResult<FollowUp>> {
  try {
    const session = await requireAuthenticatedUser();
    const existing = await db.followUp.findUnique({ where: { id } });
    if (!existing) throw new UserFacingError("Follow-up not found.");

    const followUp = await db.$transaction(async (tx) => {
      const updatedFollowUp = await tx.followUp.update({
        where: { id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
        include: { lead: true },
      });

      if (existing.status !== "COMPLETED") {
        await tx.leadActivity.create({
          data: {
            leadId: updatedFollowUp.leadId,
            type: ActivityType.FOLLOWUP_COMPLETED,
            message: `Completed ${updatedFollowUp.type} follow-up`,
            metadata: { type: updatedFollowUp.type },
            createdByUserId: session.id as string,
          },
        });
      }

      await markLeadAIInsightNeedsRefresh(updatedFollowUp.leadId, tx);

      return updatedFollowUp;
    });

    await syncNextFollowUpDate(followUp.leadId);

    revalidatePath("/dashboard");
    revalidatePath("/leads");
    revalidatePath(`/leads/${followUp.leadId}`);
    return { success: true, data: serializeFollowUp(followUp) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function cancelFollowUp(id: string): Promise<FollowUpActionResult<FollowUp>> {
  try {
    const session = await requireAuthenticatedUser();
    const existing = await db.followUp.findUnique({ where: { id } });
    if (!existing) throw new UserFacingError("Follow-up not found.");

    const followUp = await db.$transaction(async (tx) => {
      const updatedFollowUp = await tx.followUp.update({
        where: { id },
        data: {
          status: "CANCELLED",
          completedAt: null,
        },
        include: { lead: true },
      });

      if (existing.status !== "CANCELLED") {
        await tx.leadActivity.create({
          data: {
            leadId: updatedFollowUp.leadId,
            type: ActivityType.FOLLOWUP_CANCELLED,
            message: `Cancelled ${updatedFollowUp.type} follow-up`,
            metadata: { type: updatedFollowUp.type },
            createdByUserId: session.id as string,
          },
        });
      }

      await markLeadAIInsightNeedsRefresh(updatedFollowUp.leadId, tx);

      return updatedFollowUp;
    });

    await syncNextFollowUpDate(followUp.leadId);

    revalidatePath("/dashboard");
    revalidatePath("/leads");
    revalidatePath(`/leads/${followUp.leadId}`);
    return { success: true, data: serializeFollowUp(followUp) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}
