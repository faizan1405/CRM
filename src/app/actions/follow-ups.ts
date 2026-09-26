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
import { recordUndoAction } from "@/features/undo/services/undo-engine";
import { touchCrmSync } from "@/lib/crm-sync";

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
    lead?: {
      id: string;
      name: string;
      business?: string | null;
      phone: string;
      status: import("@prisma/client").LeadStatus;
      isPinned?: boolean;
      notes?: string | null;
      activities?: { message: string }[];
    } | null 
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
    submissionId: followUp.submissionId,
    createdAt: followUp.createdAt.toISOString(),
    updatedAt: followUp.updatedAt.toISOString(),
    lead: followUp.lead
      ? {
          id: followUp.lead.id,
          name: followUp.lead.name,
          business: followUp.lead.business ?? "",
          phone: followUp.lead.phone,
          status: followUp.lead.status,
          isPinned: Boolean(followUp.lead.isPinned),
        }
      : undefined,
    leadNote: canonicalNote,
  };
}

async function syncNextFollowUpDate(leadId: string) {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: { status: true },
  });
  if (lead?.status === "LOST") {
    try {
      await db.lead.update({
        where: { id: leadId },
        data: { nextFollowUpDate: null },
      });
    } catch {
      // safe
    }
    return;
  }

  const active = await db.followUp.findFirst({
    where: { leadId, status: "PENDING" },
    orderBy: { updatedAt: "desc" },
  });

  try {
    await db.lead.update({
      where: { id: leadId },
      data: { nextFollowUpDate: active ? active.scheduledAt : null },
    });
  } catch {
    // safe if lead was removed concurrently
  }
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

    const submissionId = String(formData.get("submissionId") ?? "").trim() || undefined;
    if (submissionId && submissionId.length > 120) throw new UserFacingError("Invalid submission ID.");

    const lead = await db.lead.findFirst({ where: { id: leadId, deletedAt: null, mergedIntoLeadId: null } });
    if (!lead) throw new UserFacingError("Lead not found.");

    if (submissionId) {
      const idempExisting = await db.followUp.findFirst({
        where: { submissionId },
        include: { lead: true },
      });
      if (idempExisting) {
        return { success: true, data: serializeFollowUp(idempExisting) };
      }
    }

    const validUserId = await resolveValidUserId(session.id);

    const followUp: { followUp: any; undoId?: string } = await db.$transaction(async (tx) => {
      if (submissionId) {
        const idempExisting = await tx.followUp.findFirst({
          where: { submissionId },
          include: { lead: true },
        });
        if (idempExisting) {
          return { followUp: idempExisting, undoId: undefined };
        }
      }

      // Invariant: ONE Lead -> maximum ONE active PENDING follow-up
      // Safely supersede any existing PENDING follow-ups for this lead
      const existingPending = await tx.followUp.findFirst({
        where: { leadId, status: "PENDING" },
      });
      await tx.followUp.updateMany({
        where: {
          leadId,
          status: "PENDING",
        },
        data: { status: "CANCELLED" },
      });

      const newFollowUp = await tx.followUp.create({
        data: {
          leadId,
          scheduledAt,
          type,
          note: note || null,
          status: "PENDING",
          submissionId,
        },
        include: { lead: true },
      });

      try {
        await tx.leadActivity.create({
          data: {
            leadId: newFollowUp.leadId,
            type: ActivityType.FOLLOWUP_CREATED,
            message: `Scheduled a ${newFollowUp.type} follow-up for ${newFollowUp.scheduledAt.toLocaleDateString()}`,
            metadata: { type: newFollowUp.type, scheduledAt: newFollowUp.scheduledAt },
            createdByUserId: validUserId,
          },
        });
      } catch (err: unknown) {
        const isFkError = err instanceof Error && (err.message.includes("Foreign key") || (err as { code?: string }).code === "P2003");
        if (isFkError) {
          await tx.leadActivity.create({
            data: {
              leadId: newFollowUp.leadId,
              type: ActivityType.FOLLOWUP_CREATED,
              message: `Scheduled a ${newFollowUp.type} follow-up for ${newFollowUp.scheduledAt.toLocaleDateString()}`,
              metadata: { type: newFollowUp.type, scheduledAt: newFollowUp.scheduledAt },
              createdByUserId: null,
            },
          });
        } else {
          throw err;
        }
      }

      if (note) {
        try {
          await tx.leadActivity.create({
            data: {
              leadId: newFollowUp.leadId,
              type: ActivityType.NOTE_ADDED,
              message: note,
              createdByUserId: validUserId,
            },
          });
        } catch (err: unknown) {
          const isFkError = err instanceof Error && (err.message.includes("Foreign key") || (err as { code?: string }).code === "P2003");
          if (isFkError) {
            await tx.leadActivity.create({
              data: {
                leadId: newFollowUp.leadId,
                type: ActivityType.NOTE_ADDED,
                message: note,
                createdByUserId: null,
              },
            });
          } else {
            throw err;
          }
        }
        
        // Also sync it to Lead.notes for redundancy like Lead Detail does sometimes, 
        // though NOTE_ADDED is the primary chronological source.
        await tx.lead.update({
          where: { id: newFollowUp.leadId },
          data: { notes: note },
        });
      }

      await markLeadAIInsightNeedsRefresh(leadId, tx);
      await touchCrmSync(tx);

      const undoRecord = await recordUndoAction(tx, {
        actionType: "FOLLOWUP_CREATE",
        entityType: "FOLLOWUP",
        entityId: newFollowUp.id,
        leadId,
        beforeSnapshot: { supersededFollowUpId: existingPending?.id },
        afterSnapshot: { scheduledAt: newFollowUp.scheduledAt.toISOString(), type: newFollowUp.type },
        expectedUpdatedAt: newFollowUp.updatedAt,
        description: `Scheduled ${newFollowUp.type} follow-up`,
        createdByUserId: validUserId,
      });

      return { followUp: newFollowUp, undoId: undoRecord.id };
    }, {
      timeout: 30000,
      maxWait: 15000,
    });

    await syncNextFollowUpDate(leadId);

    safeRevalidatePath("/dashboard");
    safeRevalidatePath("/leads");
    safeRevalidatePath("/follow-ups");
    safeRevalidatePath("/pipeline");
    safeRevalidatePath("/analytics");
    safeRevalidatePath(`/leads/${leadId}`);
    return { success: true, data: serializeFollowUp(followUp.followUp), undoId: followUp.undoId };
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
      where: {
        lead: {
          deletedAt: null,
          mergedIntoLeadId: null,
        },
      },
      select: {
        id: true,
        leadId: true,
        scheduledAt: true,
        type: true,
        status: true,
        note: true,
        completedAt: true,
        submissionId: true,
        createdAt: true,
        updatedAt: true,
        lead: {
          select: {
            id: true,
            name: true,
            business: true,
            phone: true,
            status: true,
            isPinned: true,
            notes: true,
            activities: {
              where: { type: "NOTE_ADDED" },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { message: true },
            },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { scheduledAt: "asc" }],
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

    // Ensure strict ONE active follow-up per lead across pending tabs
    const seenActiveLeadIds = new Set<string>();

    for (const raw of followUps) {
      const item = serializeFollowUp(raw);
      if (item.status === "Completed" || item.status === "Cancelled" || raw.lead?.status === "LOST") {
        result.completed.push(item);
        continue;
      }

      // If this lead already has an active follow-up placed, skip superseded/older active rows
      if (seenActiveLeadIds.has(item.leadId)) {
        continue;
      }
      seenActiveLeadIds.add(item.leadId);

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

    // Sort active tabs by scheduledAt asc for clean timeline display
    result.overdue.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    result.today.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    result.upcoming.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

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
      await touchCrmSync(tx);

      const undoRecord = await recordUndoAction(tx, {
        actionType: "FOLLOWUP_RESCHEDULE",
        entityType: "FOLLOWUP",
        entityId: id,
        leadId: updatedFollowUp.leadId,
        beforeSnapshot: {
          scheduledAt: existing.scheduledAt.toISOString(),
          type: existing.type,
          note: existing.note,
        },
        afterSnapshot: {
          scheduledAt: updatedFollowUp.scheduledAt.toISOString(),
          type: updatedFollowUp.type,
          note: updatedFollowUp.note,
        },
        expectedUpdatedAt: updatedFollowUp.updatedAt,
        description: "Follow-up rescheduled",
        createdByUserId: validUserId,
      });

      return { followUp: updatedFollowUp, undoId: undoRecord.id };
    }, {
      timeout: 30000,
      maxWait: 15000,
    });

    await syncNextFollowUpDate(followUp.followUp.leadId);

    safeRevalidatePath("/dashboard");
    safeRevalidatePath("/leads");
    safeRevalidatePath("/follow-ups");
    safeRevalidatePath("/pipeline");
    safeRevalidatePath("/analytics");
    safeRevalidatePath(`/leads/${followUp.followUp.leadId}`);
    return { success: true, data: serializeFollowUp(followUp.followUp), undoId: followUp.undoId };
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
      await touchCrmSync(tx);

      const undoRecord = await recordUndoAction(tx, {
        actionType: "FOLLOWUP_COMPLETE",
        entityType: "FOLLOWUP",
        entityId: id,
        leadId: updatedFollowUp.leadId,
        beforeSnapshot: { status: "PENDING", completedAt: null },
        afterSnapshot: { status: "COMPLETED" },
        expectedUpdatedAt: updatedFollowUp.updatedAt,
        description: "Follow-up completed",
        createdByUserId: validUserId,
      });

      return { followUp: updatedFollowUp, undoId: undoRecord.id };
    }, {
      timeout: 30000,
      maxWait: 15000,
    });

    await syncNextFollowUpDate(followUp.followUp.leadId);

    safeRevalidatePath("/dashboard");
    safeRevalidatePath("/leads");
    safeRevalidatePath("/follow-ups");
    safeRevalidatePath("/pipeline");
    safeRevalidatePath("/analytics");
    safeRevalidatePath(`/leads/${followUp.followUp.leadId}`);
    return { success: true, data: serializeFollowUp(followUp.followUp), undoId: followUp.undoId };
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
      await touchCrmSync(tx);

      const undoRecord = await recordUndoAction(tx, {
        actionType: "FOLLOWUP_CANCEL",
        entityType: "FOLLOWUP",
        entityId: id,
        leadId: updatedFollowUp.leadId,
        beforeSnapshot: {
          status: existing.status,
          scheduledAt: existing.scheduledAt.toISOString(),
          type: existing.type,
          note: existing.note,
          completedAt: existing.completedAt ? existing.completedAt.toISOString() : null,
        },
        afterSnapshot: { status: "CANCELLED" },
        expectedUpdatedAt: updatedFollowUp.updatedAt,
        description: "Follow-up cancelled",
        createdByUserId: validUserId,
      });

      return { followUp: updatedFollowUp, undoId: undoRecord.id };
    }, {
      timeout: 30000,
      maxWait: 15000,
    });

    await syncNextFollowUpDate(followUp.followUp.leadId);

    safeRevalidatePath("/dashboard");
    safeRevalidatePath("/leads");
    safeRevalidatePath("/follow-ups");
    safeRevalidatePath("/pipeline");
    safeRevalidatePath("/analytics");
    safeRevalidatePath(`/leads/${followUp.followUp.leadId}`);
    return { success: true, data: serializeFollowUp(followUp.followUp), undoId: followUp.undoId };
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
      await touchCrmSync(tx);
    });

    await syncNextFollowUpDate(existing.leadId);

    safeRevalidatePath("/dashboard");
    safeRevalidatePath("/leads");
    safeRevalidatePath("/follow-ups");
    safeRevalidatePath("/pipeline");
    safeRevalidatePath("/analytics");
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
      await touchCrmSync(tx);
      return updated;
    });

    await syncNextFollowUpDate(followUp.leadId);

    safeRevalidatePath("/dashboard");
    safeRevalidatePath("/leads");
    safeRevalidatePath("/follow-ups");
    safeRevalidatePath("/pipeline");
    safeRevalidatePath("/analytics");
    safeRevalidatePath(`/leads/${followUp.leadId}`);
    return { success: true, data: serializeFollowUp(followUp) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export type ScheduleFollowUpResult = FollowUp & {
  leadRecord?: import("@/features/leads/types").Lead;
};

export async function scheduleLeadFollowUp(
  formDataOrInput: FormData | {
    leadId: string;
    scheduledAt: string | Date;
    type: string;
    note?: string;
    id?: string;
    followUpId?: string;
    submissionId?: string;
    mode?: "reschedule" | "create";
  }
): Promise<FollowUpActionResult<ScheduleFollowUpResult>> {
  try {
    const session = await requireAuthenticatedUser();
    let leadId: string;
    let scheduledAtRaw: string;
    let typeRaw: string;
    let note: string;
    let explicitId: string | undefined;
    let submissionId: string | undefined;

    let mode: "reschedule" | "create" | undefined;

    if (formDataOrInput instanceof FormData) {
      leadId = String(formDataOrInput.get("leadId") ?? "").trim();
      scheduledAtRaw = String(formDataOrInput.get("scheduledAt") ?? "").trim();
      typeRaw = String(formDataOrInput.get("type") ?? "").trim();
      note = String(formDataOrInput.get("note") ?? "").trim();
      explicitId = String(formDataOrInput.get("id") ?? formDataOrInput.get("followUpId") ?? "").trim() || undefined;
      submissionId = String(formDataOrInput.get("submissionId") ?? "").trim() || undefined;
      mode = (String(formDataOrInput.get("mode") ?? "").trim() as "reschedule" | "create") || undefined;
    } else {
      leadId = String(formDataOrInput.leadId ?? "").trim();
      scheduledAtRaw = formDataOrInput.scheduledAt instanceof Date ? formDataOrInput.scheduledAt.toISOString() : String(formDataOrInput.scheduledAt ?? "").trim();
      typeRaw = String(formDataOrInput.type ?? "").trim();
      note = String(formDataOrInput.note ?? "").trim();
      explicitId = String(formDataOrInput.id ?? formDataOrInput.followUpId ?? "").trim() || undefined;
      submissionId = String(formDataOrInput.submissionId ?? "").trim() || undefined;
      mode = (formDataOrInput as { mode?: "reschedule" | "create" }).mode;
    }

    if (!leadId) throw new UserFacingError("Lead ID is required.");
    const scheduledAt = parseScheduledDate(scheduledAtRaw);
    const type = parseFollowUpType(typeRaw);
    if (note.length > 5000) throw new UserFacingError("Note must be 5000 characters or fewer.");
    if (submissionId && submissionId.length > 120) throw new UserFacingError("Invalid submission ID.");

    const lead = await db.lead.findFirst({ where: { id: leadId, deletedAt: null } });
    if (!lead) throw new UserFacingError("Lead not found.");

    const validUserId = await resolveValidUserId(session.id);

    const followUp = await db.$transaction(async (tx) => {
      // Find existing pending follow-up to reschedule if available (unless mode === "create")
      let existing = null;
      if (mode !== "create") {
        if (explicitId) {
          existing = await tx.followUp.findUnique({
            where: { id: explicitId },
            include: { lead: true },
          });
        }
        if (!existing) {
          existing = await tx.followUp.findFirst({
            where: { leadId, status: "PENDING" },
            orderBy: { scheduledAt: "asc" },
            include: { lead: true },
          });
        }
      }

      let targetFollowUp;
      if (existing) {
        // Reschedule existing follow-up without creating duplicates
        targetFollowUp = await tx.followUp.update({
          where: { id: existing.id },
          data: {
            scheduledAt,
            type,
            note: note || existing.note,
          },
          include: { lead: true },
        });

        if (existing.scheduledAt.getTime() !== targetFollowUp.scheduledAt.getTime()) {
          await tx.leadActivity.create({
            data: {
              leadId: targetFollowUp.leadId,
              type: ActivityType.FOLLOWUP_RESCHEDULED,
              message: `Follow-up rescheduled from ${existing.scheduledAt.toLocaleDateString()} to ${targetFollowUp.scheduledAt.toLocaleDateString()}`,
              metadata: {
                scheduledAtBefore: existing.scheduledAt,
                scheduledAtAfter: targetFollowUp.scheduledAt,
                type: targetFollowUp.type,
              },
              createdByUserId: validUserId,
            },
          });
        }

        if (note && note !== existing.note) {
          await tx.leadActivity.create({
            data: {
              leadId: targetFollowUp.leadId,
              type: ActivityType.NOTE_ADDED,
              message: note,
              createdByUserId: validUserId,
            },
          });

          await tx.lead.update({
            where: { id: targetFollowUp.leadId },
            data: { notes: note },
          });
        }
      } else {
        // Idempotency: if submissionId provided, return existing follow-up
        if (submissionId) {
          const idempExisting = await tx.followUp.findFirst({
            where: { submissionId },
            include: { lead: true },
          });
          if (idempExisting) {
            return { followUp: idempExisting, undoId: undefined };
          }
        }

        targetFollowUp = await tx.followUp.create({
          data: {
            leadId,
            scheduledAt,
            type,
            note: note || null,
            status: "PENDING",
            submissionId,
          },
          include: { lead: true },
        });

        await tx.leadActivity.create({
          data: {
            leadId: targetFollowUp.leadId,
            type: ActivityType.FOLLOWUP_CREATED,
            message: `Scheduled a ${targetFollowUp.type} follow-up for ${targetFollowUp.scheduledAt.toLocaleDateString()}`,
            metadata: { type: targetFollowUp.type, scheduledAt: targetFollowUp.scheduledAt },
            createdByUserId: validUserId,
          },
        });

        if (note) {
          await tx.leadActivity.create({
            data: {
              leadId: targetFollowUp.leadId,
              type: ActivityType.NOTE_ADDED,
              message: note,
              createdByUserId: validUserId,
            },
          });

          await tx.lead.update({
            where: { id: targetFollowUp.leadId },
            data: { notes: note },
          });
        }
      }

      // Invariant: Enforce at most ONE active PENDING follow-up per lead
      // Safely supersede all other PENDING follow-ups for this lead
      await tx.followUp.updateMany({
        where: {
          leadId,
          status: "PENDING",
          id: { not: targetFollowUp.id },
        },
        data: { status: "CANCELLED" },
      });

      await markLeadAIInsightNeedsRefresh(leadId, tx);
      await touchCrmSync(tx);

      const undoRecord = await recordUndoAction(tx, {
        actionType: existing ? "FOLLOWUP_RESCHEDULE" : "FOLLOWUP_CREATE",
        entityType: "FOLLOWUP",
        entityId: targetFollowUp.id,
        leadId,
        beforeSnapshot: existing
          ? { scheduledAt: existing.scheduledAt.toISOString(), type: existing.type, note: existing.note }
          : {},
        afterSnapshot: { scheduledAt: targetFollowUp.scheduledAt.toISOString(), type: targetFollowUp.type, note: targetFollowUp.note },
        expectedUpdatedAt: targetFollowUp.updatedAt,
        description: existing ? "Follow-up rescheduled" : "Follow-up scheduled",
        createdByUserId: validUserId,
      });

      return { followUp: targetFollowUp, undoId: undoRecord.id };
    }, {
      timeout: 30000,
      maxWait: 15000,
    });

    await syncNextFollowUpDate(leadId);

    safeRevalidatePath("/dashboard");
    safeRevalidatePath("/leads");
    safeRevalidatePath("/follow-ups");
    safeRevalidatePath("/pipeline");
    safeRevalidatePath("/analytics");
    safeRevalidatePath(`/leads/${leadId}`);

    // Fetch updated lead record for caller state updates
    const { getLead } = await import("@/app/actions/leads");
    const leadResult = await getLead(leadId);

    const serialized = serializeFollowUp(followUp.followUp);
    return {
      success: true,
      data: {
        ...serialized,
        leadRecord: leadResult.success ? leadResult.data : undefined,
      },
      undoId: followUp.undoId,
    };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function getActiveFollowUp(leadId: string): Promise<FollowUpActionResult<FollowUp | null>> {
  try {
    await requireAuthenticatedUser();
    const existing = await db.followUp.findFirst({
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
      include: { lead: true },
    });
    return { success: true, data: existing ? serializeFollowUp(existing) : null };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

