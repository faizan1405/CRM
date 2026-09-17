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
    throw new UserFacingError("You must be signed in to manage follow-ups.");
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
    console.error("[FollowUp Action Error]:", error.message);
    if (error.message.includes("Foreign key") || error.message.includes("Unique constraint")) {
      return error.message;
    }
  }
  return "We could not save that follow-up. Please try again.";
}

function serializeFollowUp(
  followUp: import("@prisma/client").FollowUp & { 
    lead?: (import("@prisma/client").Lead & {
      activities?: { message: string }[]
    }) | null 
  }
): FollowUp {
  const canonicalNote = followUp.lead?.activities?.[0]?.message || followUp.lead?.notes || "";
  return {
    id: followUp.id,
    leadId: followUp.leadId,
    scheduledAt: followUp.scheduledAt.toISOString(),
    type: typeFromDatabase[followUp.type as keyof typeof typeFromDatabase] ?? "Call",
    status: statusFromDatabase[followUp.status as keyof typeof statusFromDatabase] ?? "Pending",
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
    leadNote: canonicalNote,
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

function parseScheduledDate(scheduledAtRaw: string): Date {
  if (!scheduledAtRaw) throw new UserFacingError("Schedule date is required.");
  const date = new Date(scheduledAtRaw);
  if (isNaN(date.getTime())) throw new UserFacingError("Invalid schedule date.");
  return date;
}

function parseFollowUpType(typeRaw: string): "CALL" | "WHATSAPP" | "EMAIL" | "OTHER" {
  if (!typeRaw) throw new UserFacingError("Follow-up type is required.");
  const mapped = typeToDatabase[typeRaw] ?? typeToDatabase[typeRaw.toUpperCase()] ?? typeToDatabase[typeRaw.charAt(0).toUpperCase() + typeRaw.slice(1).toLowerCase()];
  if (!mapped) throw new UserFacingError("Invalid follow-up type.");
  return mapped;
}

export async function createFollowUp(formData: FormData): Promise<FollowUpActionResult<FollowUp>> {
  try {
    const session = await requireAuthenticatedUser();
    const leadId = String(formData.get("leadId") ?? "").trim();
    if (!leadId) throw new UserFacingError("Lead ID is required.");

    const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();
    const scheduledAt = parseScheduledDate(scheduledAtRaw);

    const typeRaw = String(formData.get("type") ?? "").trim();
    const type = parseFollowUpType(typeRaw);

    const note = String(formData.get("note") ?? "").trim();
    if (note.length > 5000) throw new UserFacingError("Note must be 5000 characters or fewer.");

    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new UserFacingError("Lead not found.");

    const validUserId = await resolveValidUserId(session.id);

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
          createdByUserId: validUserId,
        },
      });

      if (note) {
        await tx.leadActivity.create({
          data: {
            leadId: newFollowUp.leadId,
            type: ActivityType.NOTE_ADDED,
            message: note,
            createdByUserId: validUserId,
          },
        });
        
        // Also sync it to Lead.notes for redundancy like Lead Detail does sometimes, 
        // though NOTE_ADDED is the primary chronological source.
        await tx.lead.update({
          where: { id: newFollowUp.leadId },
          data: { notes: note },
        });
      }

      await markLeadAIInsightNeedsRefresh(leadId, tx);

      return newFollowUp;
    });

    await syncNextFollowUpDate(leadId);

    safeRevalidatePath("/dashboard");
    safeRevalidatePath("/leads");
    safeRevalidatePath("/follow-ups");
    safeRevalidatePath("/pipeline");
    safeRevalidatePath(`/leads/${leadId}`);
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
      include: { 
        lead: {
          include: {
            activities: {
              where: { type: "NOTE_ADDED" },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { message: true },
            },
          },
        },
      },
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

    for (const raw of followUps) {
      const item = serializeFollowUp(raw);
      if (item.status === "Completed" || item.status === "Cancelled") {
        result.completed.push(item);
        continue;
      }

      const itemDate = new Date(item.scheduledAt);
      const itemDateString = formatter.format(itemDate);

      if (itemDateString < todayString) {
        result.overdue.push(item);
      } else if (itemDateString === todayString) {
        result.today.push(item);
      } else {
        result.upcoming.push(item);
      }
    }

    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function updateFollowUp(
  formDataOrId: FormData | string,
  possibleFormData?: FormData
): Promise<FollowUpActionResult<FollowUp>> {
  try {
    const session = await requireAuthenticatedUser();
    let id: string;
    let formData: FormData;

    if (typeof formDataOrId === "string") {
      id = formDataOrId.trim();
      formData = possibleFormData ?? new FormData();
    } else {
      formData = formDataOrId;
      id = String(formData.get("id") ?? "").trim();
    }

    if (!id) throw new UserFacingError("Follow-up ID is required.");

    const existing = await db.followUp.findUnique({ 
      where: { id },
      include: {
        lead: {
          include: {
            activities: {
              where: { type: "NOTE_ADDED" },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { message: true },
            },
          },
        },
      },
    });
    if (!existing) throw new UserFacingError("Follow-up not found.");

    const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();
    const scheduledAt = scheduledAtRaw ? parseScheduledDate(scheduledAtRaw) : existing.scheduledAt;

    const typeRaw = String(formData.get("type") ?? "").trim();
    const type = typeRaw ? parseFollowUpType(typeRaw) : existing.type;

    const noteRaw = formData.has("note") ? String(formData.get("note") ?? "").trim() : existing.note;
    const note = noteRaw ?? "";
    if (note.length > 5000) throw new UserFacingError("Note must be 5000 characters or fewer.");

    const validUserId = await resolveValidUserId(session.id);

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

      // If a meaningful new note was typed, add it to canonical history
      const existingCanonicalNote = existing.lead?.activities?.[0]?.message || existing.lead?.notes || "";
      if (note && note !== existingCanonicalNote && note !== existing.note && note !== "Imported from latest lead sheet • date supplied without exact time; defaulted to 10:00 AM IST.") {
        await tx.leadActivity.create({
          data: {
            leadId: updatedFollowUp.leadId,
            type: ActivityType.NOTE_ADDED,
            message: note,
            createdByUserId: validUserId,
          },
        });
        
        await tx.lead.update({
          where: { id: updatedFollowUp.leadId },
          data: { notes: note },
        });
      }

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
            createdByUserId: validUserId,
          },
        });
      }

      await markLeadAIInsightNeedsRefresh(updatedFollowUp.leadId, tx);

      return updatedFollowUp;
    });

    await syncNextFollowUpDate(followUp.leadId);

    safeRevalidatePath("/dashboard");
    safeRevalidatePath("/leads");
    safeRevalidatePath("/follow-ups");
    safeRevalidatePath("/pipeline");
    safeRevalidatePath(`/leads/${followUp.leadId}`);
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

    const validUserId = await resolveValidUserId(session.id);

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
            createdByUserId: validUserId,
          },
        });
      }

      await markLeadAIInsightNeedsRefresh(updatedFollowUp.leadId, tx);

      return updatedFollowUp;
    });

    await syncNextFollowUpDate(followUp.leadId);

    safeRevalidatePath("/dashboard");
    safeRevalidatePath("/leads");
    safeRevalidatePath("/follow-ups");
    safeRevalidatePath("/pipeline");
    safeRevalidatePath(`/leads/${followUp.leadId}`);
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

    const validUserId = await resolveValidUserId(session.id);

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
            createdByUserId: validUserId,
          },
        });
      }

      await markLeadAIInsightNeedsRefresh(updatedFollowUp.leadId, tx);

      return updatedFollowUp;
    });

    await syncNextFollowUpDate(followUp.leadId);

    safeRevalidatePath("/dashboard");
    safeRevalidatePath("/leads");
    safeRevalidatePath("/follow-ups");
    safeRevalidatePath("/pipeline");
    safeRevalidatePath(`/leads/${followUp.leadId}`);
    return { success: true, data: serializeFollowUp(followUp) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function undoCreateFollowUp(id: string): Promise<FollowUpActionResult<null>> {
  try {
    const session = await requireAuthenticatedUser();
    const existing = await db.followUp.findUnique({ where: { id } });
    if (!existing) throw new UserFacingError("Follow-up not found.");

    const validUserId = await resolveValidUserId(session.id);

    await db.$transaction(async (tx) => {
      await tx.followUp.delete({ where: { id } });
      
      await tx.leadActivity.create({
        data: {
          leadId: existing.leadId,
          type: ActivityType.FOLLOWUP_CANCELLED,
          message: `Undid creation of ${existing.type} follow-up`,
          metadata: { type: existing.type },
          createdByUserId: validUserId,
        }
      });
      await markLeadAIInsightNeedsRefresh(existing.leadId, tx);
    });

    await syncNextFollowUpDate(existing.leadId);

    safeRevalidatePath("/dashboard");
    safeRevalidatePath("/leads");
    safeRevalidatePath("/follow-ups");
    safeRevalidatePath("/pipeline");
    safeRevalidatePath(`/leads/${existing.leadId}`);
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function undoRescheduleFollowUp(
  id: string,
  previousScheduledAt: Date,
  previousType: string
): Promise<FollowUpActionResult<FollowUp>> {
  try {
    const session = await requireAuthenticatedUser();
    const existing = await db.followUp.findUnique({ where: { id } });
    if (!existing) throw new UserFacingError("Follow-up not found.");

    const validUserId = await resolveValidUserId(session.id);
    const type = parseFollowUpType(previousType);

    const followUp = await db.$transaction(async (tx) => {
      const updated = await tx.followUp.update({
        where: { id },
        data: { scheduledAt: previousScheduledAt, type },
        include: { lead: true }
      });
      
      await tx.leadActivity.create({
        data: {
          leadId: updated.leadId,
          type: ActivityType.FOLLOWUP_RESCHEDULED,
          message: `Undid reschedule, reverted to ${updated.scheduledAt.toLocaleDateString()}`,
          metadata: { type: updated.type, scheduledAtBefore: existing.scheduledAt, scheduledAtAfter: updated.scheduledAt },
          createdByUserId: validUserId,
        }
      });
      await markLeadAIInsightNeedsRefresh(updated.leadId, tx);
      return updated;
    });

    await syncNextFollowUpDate(followUp.leadId);

    safeRevalidatePath("/dashboard");
    safeRevalidatePath("/leads");
    safeRevalidatePath("/follow-ups");
    safeRevalidatePath("/pipeline");
    safeRevalidatePath(`/leads/${followUp.leadId}`);
    return { success: true, data: serializeFollowUp(followUp) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}
