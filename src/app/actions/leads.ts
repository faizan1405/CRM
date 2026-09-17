"use server";

import { LeadStatus as PrismaLeadStatus, QuickStatus as PrismaQuickStatus, Prisma, ActivityType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  statusFromDatabase,
  statusToDatabase,
  type DatabaseLeadStatus,
  type Lead,
  type LeadActionResult,
  type LeadStatus,
  type QuickStatusType,
} from "@/features/leads/types";
import { typeToDatabase, typeFromDatabase, type FollowUpType, type FollowUpStatus } from "@/features/followups/types";
import { deriveAIAttention } from "@/features/ai-attention/helpers";
import {
  markLeadAIInsightNeedsRefresh,
  analyzeLead,
} from "@/features/ai-attention/services/attention-engine";
import { deriveOperationalState } from "@/lib/operational-state";

const MAX_MONEY = 9_999_999_999.99;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class UserFacingError extends Error {}

async function requireAuthenticatedUser() {
  const session = await getSession();
  if (!session || typeof session.id !== "string") {
    throw new UserFacingError("You must be signed in to manage leads.");
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

function readString(formData: FormData, key: string, maxLength: number, required = false) {
  const value = String(formData.get(key) ?? "").trim();
  if (required && !value) throw new UserFacingError(`${key === "name" ? "Name" : "Phone"} is required.`);
  if (value.length > maxLength) throw new UserFacingError(`${key} must be ${maxLength} characters or fewer.`);
  return value || null;
}

function readMoney(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new UserFacingError(`${key} must be a valid amount with up to two decimal places.`);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > MAX_MONEY) throw new UserFacingError(`${key} must be between 0 and ${MAX_MONEY}.`);
  return new Prisma.Decimal(raw);
}

function readDate(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new UserFacingError(`${key} must be a valid date.`);
  const value = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== raw) throw new UserFacingError(`${key} must be a valid date.`);
  return value;
}

function readStatus(value: FormDataEntryValue | null): PrismaLeadStatus {
  const status = String(value ?? "New") as LeadStatus;
  const databaseStatus = statusToDatabase[status];
  if (!databaseStatus) throw new UserFacingError("Select a valid lead status.");
  return databaseStatus as PrismaLeadStatus;
}

function readLeadId(id: string) {
  if (!uuidPattern.test(id)) throw new UserFacingError("The selected lead is invalid.");
  return id;
}

function leadData(formData: FormData) {
  const email = readString(formData, "email", 254);
  if (email && !emailPattern.test(email)) throw new UserFacingError("Enter a valid email address.");

  return {
    name: readString(formData, "name", 120, true)!,
    phone: readString(formData, "phone", 40, true)!,
    email,
    business: readString(formData, "business", 160),
    industry: readString(formData, "industry", 100),
    leadSource: readString(formData, "source", 100),
    budget: readMoney(formData, "budget"),
    status: readStatus(formData.get("status")),
    quotedAmount: readMoney(formData, "quotedAmount"),
    lastContactDate: readDate(formData, "lastContactDate"),
    nextFollowUpDate: readDate(formData, "nextFollowUpDate"),
    notes: readString(formData, "notes", 5000),
  };
}

function serializeLead(lead: {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  business: string | null;
  industry: string | null;
  leadSource: string | null;
  budget: Prisma.Decimal | null;
  status: PrismaLeadStatus;
  quickStatus?: PrismaQuickStatus | null;
  quotedAmount: Prisma.Decimal | null;
  lastContactDate: Date | null;
  nextFollowUpDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  isWaste: boolean;
  followUps?: { id?: string; scheduledAt: Date; type?: string; status: string; note?: string | null; completedAt?: Date | null; createdAt?: Date; updatedAt?: Date }[];
  aiInsight?: import("@prisma/client").LeadAIInsight | null;
  activities?: { message: string }[];
}): Lead {
  const baseLead = {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email ?? "",
    business: lead.business ?? "",
    industry: lead.industry ?? "",
    source: lead.leadSource ?? "",
    budget: lead.budget === null ? null : Number(lead.budget),
    status: statusFromDatabase[lead.status as DatabaseLeadStatus],
    quickStatus: (lead.quickStatus as QuickStatusType) ?? "NONE",
    latestNote: lead.activities?.[0]?.message || lead.notes || "",
    quotedAmount: lead.quotedAmount === null ? null : Number(lead.quotedAmount),
    lastContactDate: lead.lastContactDate?.toISOString().slice(0, 10) ?? null,
    nextFollowUpDate: lead.nextFollowUpDate?.toISOString().slice(0, 10) ?? null,
    notes: lead.notes ?? "",
    createdAt: lead.createdAt.toISOString().slice(0, 10),
    updatedAt: lead.updatedAt.toISOString(),
  };

  const operationalState = deriveOperationalState({
    status: baseLead.status,
    isWaste: lead.isWaste,
    nextFollowUpDate: lead.nextFollowUpDate?.toISOString().slice(0, 10) ?? null,
    followUps: lead.followUps?.map(f => ({
      scheduledAt: f.scheduledAt.toISOString(),
      status: f.status,
    })),
  });

  const pendingFollowUp = lead.followUps?.find((f) => f.status === "PENDING" || f.status === "Pending");
  let activeFollowUp: import("@/features/followups/types").FollowUp | null = null;
  if (pendingFollowUp) {
    const rawType = pendingFollowUp.type ? typeToDatabase[pendingFollowUp.type] : undefined;
    const mappedType: FollowUpType = rawType ? typeFromDatabase[rawType] : "Call";
    const mappedStatus: FollowUpStatus = pendingFollowUp.status === "PENDING" ? "Pending" : "Pending";

    activeFollowUp = {
      id: pendingFollowUp.id || "",
      leadId: lead.id,
      scheduledAt: pendingFollowUp.scheduledAt.toISOString(),
      type: mappedType,
      status: mappedStatus,
      note: pendingFollowUp.note || "",
      completedAt: pendingFollowUp.completedAt ? pendingFollowUp.completedAt.toISOString() : null,
      createdAt: pendingFollowUp.createdAt ? pendingFollowUp.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: pendingFollowUp.updatedAt ? pendingFollowUp.updatedAt.toISOString() : new Date().toISOString(),
      leadNote: lead.activities?.[0]?.message || "",
    };
  }

  return {
    ...baseLead,
    isWaste: lead.isWaste,
    operationalState,
    aiAttention: deriveAIAttention({
      ...baseLead,
      aiInsight: lead.aiInsight,
    }),
    activeFollowUp,
  };
}

function cleanError(error: unknown) {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof Error) {
    console.error("[Leads Action Error]:", error.message);
    if (error.message.includes("Foreign key") || error.message.includes("Unique constraint")) {
      return error.message;
    }
  }
  return "We could not save that change. Please try again.";
}

export async function getLeads(filter?: import('@/features/leads/types').LeadOperationalState): Promise<LeadActionResult<Lead[]>> {
  try {
    await requireAuthenticatedUser();
    const where: Record<string, unknown> = {};
    if (filter === "WASTE") {
      where.isWaste = true;
    } else if (filter && filter !== "ACTIVE_NEUTRAL") {
      where.isWaste = false;
    }
    // For ACTIVE_NEUTRAL filter, show non-waste only (no status filter)
    if (filter === "ACTIVE_NEUTRAL") {
      where.isWaste = false;
    }
    const leads = await db.lead.findMany({
      where: { ...where, deletedAt: null },
      include: {
        aiInsight: true,
        followUps: { where: { status: "PENDING" } },
        activities: {
          where: { type: ActivityType.NOTE_ADDED },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { message: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    let serialized = leads.map(serializeLead);
    if (filter) {
      serialized = serialized.filter(l => l.operationalState === filter);
    }
    return { success: true, data: serialized };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function getLead(id: string): Promise<LeadActionResult<Lead>> {
  try {
    await requireAuthenticatedUser();
    const lead = await db.lead.findFirst({
      where: { id: readLeadId(id), deletedAt: null },
      include: {
        followUps: {
          where: { status: "PENDING" },
          orderBy: { scheduledAt: "asc" },
        },
        activities: {
          where: { type: ActivityType.NOTE_ADDED },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { message: true },
        },
      },
    });
    if (!lead) return { success: false, error: "Lead not found." };
    return { success: true, data: serializeLead(lead) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function createLead(formData: FormData): Promise<LeadActionResult<Lead>> {
  try {
    const session = await requireAuthenticatedUser();
    const data = leadData(formData);
    const validUserId = await resolveValidUserId(session.id);

    const lead = await db.$transaction(async (tx) => {
      const newLead = await tx.lead.create({ data });
      await tx.leadActivity.create({
        data: {
          leadId: newLead.id,
          type: ActivityType.LEAD_CREATED,
          message: "Lead was created",
          createdByUserId: validUserId,
        },
      });

      if (data.nextFollowUpDate) {
        const dateStr = data.nextFollowUpDate.toISOString().slice(0, 10);
        const timeRaw = String(formData.get("suggestedFollowUpTime") ?? "").trim();
        const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(timeRaw) ? timeRaw : "10:00";
        const scheduledAt = new Date(`${dateStr}T${validTime}:00+05:30`);
        const finalDate = Number.isNaN(scheduledAt.getTime()) ? data.nextFollowUpDate : scheduledAt;

        await tx.followUp.create({
          data: {
            leadId: newLead.id,
            scheduledAt: finalDate,
            type: "CALL",
            note: "Follow-up scheduled from lead entry",
            status: "PENDING",
          },
        });

        await tx.leadActivity.create({
          data: {
            leadId: newLead.id,
            type: ActivityType.FOLLOWUP_CREATED,
            message: `Scheduled a CALL follow-up for ${finalDate.toLocaleDateString()}`,
            metadata: { type: "CALL", scheduledAt: finalDate },
            createdByUserId: validUserId,
          },
        });
      }

      await markLeadAIInsightNeedsRefresh(newLead.id, tx);

      return newLead;
    });

    try {
      revalidatePath("/leads");
      revalidatePath("/pipeline");
      revalidatePath("/dashboard");
    } catch {
      // safe in test execution
    }
    return { success: true, data: serializeLead(lead) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function updateLead(id: string, formData: FormData): Promise<LeadActionResult<Lead>> {
  try {
    const session = await requireAuthenticatedUser();
    const leadId = readLeadId(id);
    const data = leadData(formData);
    const validUserId = await resolveValidUserId(session.id);

    const lead = await db.$transaction(async (tx) => {
      const oldLead = await tx.lead.findUnique({ where: { id: leadId } });
      if (!oldLead) throw new Prisma.PrismaClientKnownRequestError("Lead not found.", { code: "P2025", clientVersion: Prisma.prismaVersion.client });

      const updatedLead = await tx.lead.update({ where: { id: leadId }, data });

      const changed: string[] = [];
      if (oldLead.name !== updatedLead.name) changed.push("name");
      if (oldLead.phone !== updatedLead.phone) changed.push("phone");
      if (oldLead.email !== updatedLead.email) changed.push("email");
      if (oldLead.industry !== updatedLead.industry) changed.push("industry");
      if (oldLead.leadSource !== updatedLead.leadSource) changed.push("source");
      if (oldLead.budget?.toString() !== updatedLead.budget?.toString()) changed.push("budget");
      if (oldLead.quotedAmount?.toString() !== updatedLead.quotedAmount?.toString()) changed.push("quoted amount");
      if (oldLead.business !== updatedLead.business) changed.push("business");
      if (oldLead.status !== updatedLead.status) changed.push("status");
      
      if (changed.length > 0) {
        await tx.leadActivity.create({
          data: {
            leadId,
            type: ActivityType.LEAD_UPDATED,
            message: `Lead was updated: changed ${changed.join(", ")}`,
            createdByUserId: validUserId,
          },
        });
        await markLeadAIInsightNeedsRefresh(leadId, tx);
      }
      return updatedLead;
    });

    try {
      revalidatePath("/leads");
      revalidatePath("/pipeline");
      revalidatePath("/dashboard");
      revalidatePath(`/leads/${leadId}`);
    } catch {
      // safe in test execution
    }
    return { success: true, data: serializeLead(lead) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return { success: false, error: "Lead not found." };
    return { success: false, error: cleanError(error) };
  }
}

export async function changeLeadStatus(
  id: string,
  status: LeadStatus,
  lossReasonInput?: string,
  lossNoteInput?: string
): Promise<LeadActionResult<Lead>> {
  try {
    const session = await requireAuthenticatedUser();
    const databaseStatus = statusToDatabase[status];
    if (!databaseStatus) return { success: false, error: "Select a valid lead status." };
    const leadId = readLeadId(id);
    const validUserId = await resolveValidUserId(session.id);

    // If attempting to mark as LOST without going through markLeadLost:
    if (databaseStatus === PrismaLeadStatus.LOST && !lossReasonInput) {
      return {
        success: false,
        error: "Marking a lead as Lost requires a loss reason. Use markLeadLost.",
      };
    }

    const lead = await db.$transaction(async (tx) => {
      const oldLead = await tx.lead.findUnique({ where: { id: leadId } });
      if (!oldLead) throw new Prisma.PrismaClientKnownRequestError("Lead not found.", { code: "P2025", clientVersion: Prisma.prismaVersion.client });

      const updatedLead = await tx.lead.update({ where: { id: leadId }, data: { status: databaseStatus } });
      
      if (oldLead.status !== databaseStatus) {
        await tx.leadActivity.create({
          data: {
            leadId,
            type: ActivityType.STATUS_CHANGED,
            message: `Status changed from ${statusFromDatabase[oldLead.status as DatabaseLeadStatus]} to ${status}`,
            metadata: {
              oldStatus: oldLead.status,
              newStatus: databaseStatus,
              ...(lossReasonInput ? { lossReason: lossReasonInput, lossNote: lossNoteInput } : {}),
            },
            createdByUserId: validUserId,
          },
        });
        await markLeadAIInsightNeedsRefresh(leadId, tx);
      }
      return updatedLead;
    });

    try {
      revalidatePath("/leads");
      revalidatePath("/pipeline");
      revalidatePath("/dashboard");
      revalidatePath(`/leads/${leadId}`);
    } catch {
      // safe in test execution
    }
    return { success: true, data: serializeLead(lead) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return { success: false, error: "Lead not found." };
    return { success: false, error: cleanError(error) };
  }
}

export async function updateQuickStatus(
  leadId: string,
  quickStatus: QuickStatusType
): Promise<LeadActionResult<Lead>> {
  try {
    const session = await requireAuthenticatedUser();
    const id = readLeadId(leadId);
    const existing = await db.lead.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Lead not found." };

    const validUserId = await resolveValidUserId(session.id);

    let nextStatus: PrismaLeadStatus = existing.status;
    if (quickStatus === "CONTACTED") {
      if (existing.status === PrismaLeadStatus.NEW) {
        nextStatus = PrismaLeadStatus.CONTACTED;
      }
    } else if (quickStatus === "INTERESTED") {
      if (existing.status === PrismaLeadStatus.NEW || existing.status === PrismaLeadStatus.CONTACTED) {
        nextStatus = PrismaLeadStatus.QUALIFIED;
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.lead.update({
        where: { id },
        data: {
          quickStatus: quickStatus as PrismaQuickStatus,
          status: nextStatus,
        },
        include: {
          activities: {
            where: { type: ActivityType.NOTE_ADDED },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { message: true },
          },
        },
      });

      if (nextStatus !== existing.status) {
        await tx.leadActivity.create({
          data: {
            leadId: id,
            type: ActivityType.STATUS_CHANGED,
            message: `Status changed from ${statusFromDatabase[existing.status as DatabaseLeadStatus]} to ${statusFromDatabase[nextStatus as DatabaseLeadStatus]} via Quick Status (${quickStatus})`,
            metadata: { oldStatus: existing.status, newStatus: nextStatus, quickStatus },
            createdByUserId: validUserId,
          },
        });
      }

      await markLeadAIInsightNeedsRefresh(id, tx);
      return result;
    });

    try {
      revalidatePath("/dashboard");
      revalidatePath("/leads");
      revalidatePath("/pipeline");
      revalidatePath(`/leads/${id}`);
    } catch {
      // safe in tests
    }

    return { success: true, data: serializeLead(updated) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function refreshLeadAI(id: string): Promise<LeadActionResult<Lead>> {
  try {
    await requireAuthenticatedUser();
    const leadId = readLeadId(id);
    await analyzeLead(leadId, { force: true });
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      include: { aiInsight: true },
    });
    if (!lead) return { success: false, error: "Lead not found." };
    return { success: true, data: serializeLead(lead) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function deleteLead(id: string): Promise<LeadActionResult<{ id: string }>> {
  try {
    await requireAuthenticatedUser();
    const leadId = readLeadId(id);
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, deletedAt: true } });
    if (!lead) return { success: false, error: "Lead not found." };
    if (lead.deletedAt) return { success: false, error: "Lead is already deleted." };

    const updated = await db.lead.update({ where: { id: leadId }, data: { deletedAt: new Date() }, select: { id: true } });
    try {
      revalidatePath("/leads");
      revalidatePath("/pipeline");
      revalidatePath("/dashboard");
      revalidatePath("/analytics");
      revalidatePath("/follow-ups");
      revalidatePath("/recently-deleted");
    } catch {
      // safe in test execution
    }
    return { success: true, data: updated };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function restoreLead(id: string): Promise<LeadActionResult<{ id: string }>> {
  try {
    await requireAuthenticatedUser();
    const leadId = readLeadId(id);
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, deletedAt: true } });
    if (!lead) return { success: false, error: "Lead not found." };
    if (!lead.deletedAt) return { success: false, error: "Lead is not deleted." };

    const updated = await db.lead.update({ where: { id: leadId }, data: { deletedAt: null }, select: { id: true } });
    try {
      revalidatePath("/leads");
      revalidatePath("/pipeline");
      revalidatePath("/dashboard");
      revalidatePath("/analytics");
      revalidatePath("/follow-ups");
      revalidatePath("/recently-deleted");
    } catch {
      // safe in test execution
    }
    return { success: true, data: updated };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function permanentlyDeleteLead(id: string): Promise<LeadActionResult<{ id: string }>> {
  try {
    await requireAuthenticatedUser();
    const leadId = readLeadId(id);
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, deletedAt: true } });
    if (!lead) return { success: false, error: "Lead not found." };
    if (!lead.deletedAt) return { success: false, error: "Lead is not in Recently Deleted. Delete it first." };

    const deleted = await db.lead.delete({ where: { id: leadId }, select: { id: true } });
    try {
      revalidatePath("/leads");
      revalidatePath("/pipeline");
      revalidatePath("/dashboard");
      revalidatePath("/analytics");
      revalidatePath("/follow-ups");
      revalidatePath("/recently-deleted");
    } catch {
      // safe in test execution
    }
    return { success: true, data: deleted };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function getRecentlyDeletedLeads(): Promise<LeadActionResult<{ id: string; name: string; phone: string; status: string; deletedAt: string }[]>> {
  try {
    await requireAuthenticatedUser();
    const leads = await db.lead.findMany({
      where: { deletedAt: { not: null } },
      select: { id: true, name: true, phone: true, status: true, deletedAt: true },
      orderBy: { deletedAt: "desc" },
    });
    const serialized = leads.map(l => ({
      ...l,
      status: statusFromDatabase[l.status] ?? l.status,
      deletedAt: l.deletedAt ? l.deletedAt.toISOString() : "",
    }));
    return { success: true, data: serialized };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function deleteAllLeadsAction(): Promise<{
  success: boolean;
  leadCount?: number;
  followUpCount?: number;
  activityCount?: number;
  insightCount?: number;
  notificationCount?: number;
  lossEventCount?: number;
  error?: string;
}> {
  try {
    await requireAuthenticatedUser();

    const counts = await db.$transaction(async (tx) => {
      const notificationCount = await tx.salesNotification.count({
        where: { leadId: { not: null } },
      });
      const lossEventCount = await tx.leadLossEvent.count();
      const followUpCount = await tx.followUp.count();
      const activityCount = await tx.leadActivity.count();
      const insightCount = await tx.leadAIInsight.count();

      // Explicitly delete dependent records first for foreign key integrity
      await tx.salesNotification.deleteMany({ where: { leadId: { not: null } } });
      await tx.leadLossEvent.deleteMany({});
      await tx.followUp.deleteMany({});
      await tx.leadActivity.deleteMany({});
      await tx.leadAIInsight.deleteMany({});
      const leadCount = await tx.lead.deleteMany({});

      return {
        leadCount: leadCount.count,
        followUpCount,
        activityCount,
        insightCount,
        notificationCount,
        lossEventCount,
      };
    }, {
      maxWait: 5000,
      timeout: 30000,
    });

    try {
      revalidatePath("/leads");
      revalidatePath("/pipeline");
      revalidatePath("/dashboard");
      revalidatePath("/analytics");
      revalidatePath("/daily-briefing");
    } catch {
      // safe in test execution
    }

    return { success: true, ...counts };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to purge all leads.",
    };
  }
}

export async function markLeadWaste(leadId: string): Promise<LeadActionResult<Lead>> {
  try {
    const session = await requireAuthenticatedUser();
    const id = readLeadId(leadId);
    const validUserId = await resolveValidUserId(session.id);
    
    const lead = await db.$transaction(async (tx) => {
      const oldLead = await tx.lead.findUnique({ where: { id } });
      if (!oldLead) throw new Prisma.PrismaClientKnownRequestError("Lead not found.", { code: "P2025", clientVersion: Prisma.prismaVersion.client });

      const updatedLead = await tx.lead.update({
        where: { id },
        data: { isWaste: true },
        include: { aiInsight: true },
      });

      await tx.leadActivity.create({
        data: {
          leadId: id,
          type: ActivityType.LEAD_UPDATED,
          message: "Lead was marked as Waste",
          createdByUserId: validUserId,
        },
      });

      return updatedLead;
    });

    try {
      revalidatePath("/leads");
      revalidatePath("/pipeline");
      revalidatePath("/dashboard");
    } catch {}

    return { success: true, data: serializeLead(lead) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function restoreWasteLead(leadId: string): Promise<LeadActionResult<Lead>> {
  try {
    const session = await requireAuthenticatedUser();
    const id = readLeadId(leadId);
    const validUserId = await resolveValidUserId(session.id);

    const lead = await db.$transaction(async (tx) => {
      const oldLead = await tx.lead.findUnique({ where: { id } });
      if (!oldLead) throw new Prisma.PrismaClientKnownRequestError("Lead not found.", { code: "P2025", clientVersion: Prisma.prismaVersion.client });
      
      const updatedLead = await tx.lead.update({
        where: { id },
        data: { isWaste: false },
        include: { aiInsight: true },
      });
      
      await tx.leadActivity.create({
        data: {
          leadId: id,
          type: ActivityType.LEAD_UPDATED,
          message: "Lead was restored from Waste",
          createdByUserId: validUserId,
        },
      });
      
      return updatedLead;
    });

    try {
      revalidatePath("/leads");
      revalidatePath("/pipeline");
      revalidatePath("/dashboard");
    } catch {}

    return { success: true, data: serializeLead(lead) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function undoWasteToggle(leadId: string, previousIsWaste: boolean): Promise<LeadActionResult<Lead>> {
  try {
    const session = await requireAuthenticatedUser();
    const id = readLeadId(leadId);
    const validUserId = await resolveValidUserId(session.id);

    const lead = await db.$transaction(async (tx) => {
      const oldLead = await tx.lead.findUnique({ where: { id } });
      if (!oldLead) throw new Prisma.PrismaClientKnownRequestError("Lead not found.", { code: "P2025", clientVersion: Prisma.prismaVersion.client });
      
      const updatedLead = await tx.lead.update({
        where: { id },
        data: { isWaste: previousIsWaste },
        include: { aiInsight: true },
      });
      
      await tx.leadActivity.create({
        data: {
          leadId: id,
          type: ActivityType.LEAD_UPDATED,
          message: previousIsWaste ? "Undid restoration, lead returned to Waste" : "Undid marking as Waste, lead restored",
          createdByUserId: validUserId,
        },
      });
      
      return updatedLead;
    });

    try {
      revalidatePath("/leads");
      revalidatePath("/pipeline");
      revalidatePath("/dashboard");
    } catch {}

    return { success: true, data: serializeLead(lead) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}
