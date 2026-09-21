"use server";

import { ActivityType, FollowUpStatus, FollowUpType, LeadStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { markLeadAIInsightNeedsRefresh } from "@/features/ai-attention/services/attention-engine";
import { touchCrmSync } from "@/lib/crm-sync";

export type CallOutcome = "PICKED" | "NOT_PICKED" | "INTERESTED" | "CALL_BACK";
type FollowUpChoice = "keep" | "create" | "replace";
export type SaveCallOutcomeInput = {
  leadId: string;
  outcome: CallOutcome;
  note?: string;
  operationId: string;
  followUp?: { choice: FollowUpChoice; scheduledAt?: string; existingId?: string };
};

const messages: Record<CallOutcome, string> = {
  PICKED: "Call picked",
  NOT_PICKED: "Call not picked",
  INTERESTED: "Call picked — Interested",
  CALL_BACK: "Call Back",
};

function refresh(leadId: string) {
  for (const path of ["/leads", "/pipeline", "/follow-ups", "/dashboard", `/leads/${leadId}`]) {
    try { revalidatePath(path); } catch { /* Tests run outside a Next request. */ }
  }
}

export async function saveCallOutcome(input: SaveCallOutcomeInput): Promise<{ success: true; data: { status: LeadStatus; scheduledAt?: string } } | { success: false; error: string }> {
  try {
    const session = await getSession();
    if (!session?.id) throw new Error("You must be signed in.");
    if (!input.leadId || !/^[a-zA-Z0-9_-]{8,120}$/.test(input.operationId) || !(input.outcome in messages)) throw new Error("Invalid call outcome.");
    const note = input.note?.trim() ?? "";
    if (note.length > 5000) throw new Error("Note must be 5000 characters or fewer.");
    const followUp = input.followUp;
    if (input.outcome === "CALL_BACK" && (!followUp || followUp.choice === "keep" && !followUp.existingId)) {
      throw new Error("Choose an exact callback date and time, or keep the existing follow-up.");
    }
    let date: Date | undefined;
    if (followUp && followUp.choice !== "keep") {
      date = new Date(followUp.scheduledAt ?? "");
      if (!Number.isFinite(date.getTime()) || date <= new Date()) throw new Error("Choose a future follow-up date and time.");
    }
    const user = session?.id ? await db.user.findUnique({ where: { id: String(session.id) }, select: { id: true } }) : null;
    const result = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.leadId}))`;
      const existingOperation = await tx.leadActivity.findFirst({ where: { leadId: input.leadId, metadata: { path: ["callOperationId"], equals: input.operationId } } });
      if (existingOperation) throw new Error("This call outcome was already saved.");
      const lead = await tx.lead.findFirst({ where: { id: input.leadId, deletedAt: null } });
      if (!lead) throw new Error("Lead not found.");
      const pending = await tx.followUp.findMany({ where: { leadId: input.leadId, status: FollowUpStatus.PENDING }, orderBy: { createdAt: "asc" } });
      if (pending.length > 1) throw new Error("This lead has multiple pending follow-ups. Resolve them before saving another.");
      if (followUp?.choice === "create" && pending.length) throw new Error("A pending follow-up already exists. Choose Keep Existing or Replace/Reschedule.");
      if (followUp?.choice === "replace" && (!pending[0] || pending[0].id !== followUp.existingId)) throw new Error("The active follow-up changed. Refresh and try again.");
      if (followUp?.choice === "keep" && (!pending[0] || pending[0].id !== followUp.existingId)) throw new Error("The active follow-up changed. Refresh and try again.");

      const nextStatus = input.outcome === "PICKED" && lead.status === LeadStatus.NEW ? LeadStatus.CONTACTED
        : input.outcome === "INTERESTED" && ((lead.status === LeadStatus.NEW || lead.status === LeadStatus.CONTACTED)) ? LeadStatus.QUALIFIED
        : lead.status;
      const before = { status: lead.status, notes: lead.notes, nextFollowUpDate: lead.nextFollowUpDate };
      const metadata: Record<string, unknown> = { callOutcome: input.outcome, callOperationId: input.operationId, before };
      if (pending[0]) metadata.previousFollowUp = { id: pending[0].id, scheduledAt: pending[0].scheduledAt.toISOString(), type: pending[0].type, note: pending[0].note ?? "" };
      const call = await tx.leadActivity.create({ data: { leadId: input.leadId, type: ActivityType.LEAD_UPDATED, message: messages[input.outcome], metadata: metadata as Prisma.InputJsonValue, createdByUserId: user?.id } });
      if (note) await tx.leadActivity.create({ data: { leadId: input.leadId, type: ActivityType.NOTE_ADDED, message: note, metadata: { callOperationId: input.operationId }, createdByUserId: user?.id } });
      if (nextStatus !== lead.status) await tx.leadActivity.create({ data: { leadId: input.leadId, type: ActivityType.STATUS_CHANGED, message: `Status changed from ${lead.status.replaceAll("_", " ")} to ${nextStatus.replaceAll("_", " ")}`, metadata: { oldStatus: lead.status, newStatus: nextStatus, callOperationId: input.operationId }, createdByUserId: user?.id } });
      let scheduledAt: string | undefined;
      if (followUp?.choice === "create" && date) {
        const created = await tx.followUp.create({ data: { leadId: input.leadId, scheduledAt: date, type: FollowUpType.CALL, status: FollowUpStatus.PENDING, note: note || null, submissionId: input.operationId } });
        scheduledAt = created.scheduledAt.toISOString();
        await tx.leadActivity.create({ data: { leadId: input.leadId, type: ActivityType.FOLLOWUP_CREATED, message: `Scheduled a CALL follow-up for ${date.toLocaleDateString()}`, metadata: { callOperationId: input.operationId, followUpId: created.id, scheduledAt }, createdByUserId: user?.id } });
      } else if (followUp?.choice === "replace" && date && pending[0]) {
        await tx.followUp.update({ where: { id: pending[0].id }, data: { scheduledAt: date, type: FollowUpType.CALL, note: note || pending[0].note } });
        scheduledAt = date.toISOString();
        await tx.leadActivity.create({ data: { leadId: input.leadId, type: ActivityType.FOLLOWUP_RESCHEDULED, message: `Follow-up rescheduled to ${date.toLocaleDateString()}`, metadata: { callOperationId: input.operationId, followUpId: pending[0].id, scheduledAtBefore: pending[0].scheduledAt.toISOString(), scheduledAtAfter: scheduledAt }, createdByUserId: user?.id } });
      }
      await tx.lead.update({ where: { id: input.leadId }, data: { status: nextStatus, ...(note ? { notes: note } : {}), ...(scheduledAt ? { nextFollowUpDate: new Date(scheduledAt) } : {}) } });
      await markLeadAIInsightNeedsRefresh(input.leadId, tx);
      await touchCrmSync(tx);
      return { status: nextStatus, scheduledAt, callId: call.id };
    }, { timeout: 20000 });
    refresh(input.leadId);
    return { success: true, data: { status: result.status, scheduledAt: result.scheduledAt } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not save call outcome." };
  }
}

export async function undoCallOutcome(leadId: string, operationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.id) throw new Error("You must be signed in.");
    await db.$transaction(async (tx) => {
      const call = await tx.leadActivity.findFirst({ where: { leadId, metadata: { path: ["callOperationId"], equals: operationId }, type: ActivityType.LEAD_UPDATED } });
      if (!call) throw new Error("Call outcome is no longer available to undo.");
      const metadata = call.metadata as { before?: { status: LeadStatus; notes: string | null; nextFollowUpDate: string | null }; previousFollowUp?: { id: string; scheduledAt: string; type: FollowUpType; note: string } };
      const before = metadata.before;
      if (!before) throw new Error("Call outcome cannot be undone safely.");
      const lead = await tx.lead.findUnique({ where: { id: leadId } });
      if (!lead) throw new Error("Lead not found.");
      const acts = await tx.leadActivity.findMany({ where: { leadId, metadata: { path: ["callOperationId"], equals: operationId } } });
      const note = acts.find(a => a.type === ActivityType.NOTE_ADDED);
      const status = acts.find(a => a.type === ActivityType.STATUS_CHANGED);
      const follow = acts.find(a => a.type === ActivityType.FOLLOWUP_CREATED || a.type === ActivityType.FOLLOWUP_RESCHEDULED);
      const later = await tx.leadActivity.findMany({ where: { leadId, createdAt: { gt: call.createdAt }, id: { notIn: acts.map(a => a.id) } }, select: { type: true } });
      if (note && later.some(a => a.type === ActivityType.NOTE_ADDED)) throw new Error("A newer note exists. Undo is no longer safe.");
      if (status && later.some(a => a.type === ActivityType.STATUS_CHANGED)) throw new Error("Pipeline status changed later. Undo is no longer safe.");
      if (follow && later.some(a => new Set<ActivityType>([ActivityType.FOLLOWUP_CREATED, ActivityType.FOLLOWUP_RESCHEDULED, ActivityType.FOLLOWUP_COMPLETED, ActivityType.FOLLOWUP_CANCELLED]).has(a.type))) throw new Error("Follow-up changed later. Undo is no longer safe.");
      if (status && lead.status !== (status.metadata as { newStatus: LeadStatus }).newStatus) throw new Error("Pipeline status changed later. Undo is no longer safe.");
      if (note && lead.notes !== note.message) throw new Error("A newer note exists. Undo is no longer safe.");
      if (follow) {
        const fm = follow.metadata as { followUpId: string; scheduledAt?: string; scheduledAtAfter?: string };
        const current = await tx.followUp.findUnique({ where: { id: fm.followUpId } });
        if (!current || current.status !== FollowUpStatus.PENDING || current.scheduledAt.toISOString() !== (fm.scheduledAt ?? fm.scheduledAtAfter)) throw new Error("Follow-up changed later. Undo is no longer safe.");
        if (follow.type === ActivityType.FOLLOWUP_CREATED) await tx.followUp.delete({ where: { id: current.id } });
        else if (metadata.previousFollowUp) await tx.followUp.update({ where: { id: current.id }, data: { scheduledAt: new Date(metadata.previousFollowUp.scheduledAt), type: metadata.previousFollowUp.type, note: metadata.previousFollowUp.note || null } });
      }
      await tx.lead.update({ where: { id: leadId }, data: { ...(status ? { status: before.status } : {}), ...(note ? { notes: before.notes } : {}), ...(follow ? { nextFollowUpDate: before.nextFollowUpDate ? new Date(before.nextFollowUpDate) : null } : {}) } });
      await tx.leadActivity.deleteMany({ where: { id: { in: acts.map(a => a.id) } } });
      await markLeadAIInsightNeedsRefresh(leadId, tx);
      await touchCrmSync(tx);
    }, { timeout: 20000 });
    refresh(leadId);
    return { success: true };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Could not undo call outcome." }; }
}
