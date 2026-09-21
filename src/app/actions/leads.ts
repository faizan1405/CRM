"use server";

import { LeadStatus as PrismaLeadStatus, QuickStatus as PrismaQuickStatus, Prisma, ActivityType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordUndoAction } from "@/features/undo/services/undo-engine";
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
import { calculateLeadStaleness } from "@/lib/stale-leads";
import {
  findDuplicateLeadCandidates,
  getDuplicateGroups,
} from "@/features/leads/duplicate-detection-service";
import type { DuplicateLeadCandidate } from "@/features/leads/ai-entry-types";
import type { MergeLeadsInput } from "@/features/leads/types";

const MAX_MONEY = 9_999_999_999.99;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class UserFacingError extends Error {}

function cleanError(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof Error) {
    console.error("[Leads Action Error]:", error.message);
    if (error.message.includes("Foreign key") || error.message.includes("Unique constraint")) {
      return error.message;
    }
  }
  return "We could not save that change. Please try again.";
}

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
  const label = key === "quotedAmount" ? "Quoted amount" : key === "budget" ? "Budget" : key;
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(raw)) throw new UserFacingError(`${label} must be a valid amount with up to two decimal places.`);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > MAX_MONEY) throw new UserFacingError(`${label} must be between 0 and ${MAX_MONEY}.`);
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

const leadIncludeStandard = {
  aiInsight: true,
  deal: {
    select: {
      quotedAmount: true,
      finalAmount: true,
      currency: true,
    },
  },
  followUps: {
    where: { status: "PENDING" as const },
    orderBy: { updatedAt: "desc" as const },
  },
  activities: {
    orderBy: { createdAt: "desc" as const },
    take: 10,
    select: { id: true, type: true, message: true, metadata: true, createdAt: true },
  },
  mergedInto: {
    select: { id: true, name: true, phone: true, status: true },
  },
} as const;

function safeRevalidateLeadPaths(leadId?: string) {
  try {
    revalidatePath("/leads");
    revalidatePath("/pipeline");
    revalidatePath("/dashboard");
    revalidatePath("/analytics");
    revalidatePath("/follow-ups");
    if (leadId) {
      revalidatePath(`/leads/${leadId}`);
    }
  } catch {
    // safe in test execution
  }
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
  isPinned?: boolean;
  mergedIntoLeadId?: string | null;
  mergedAt?: Date | null;
  mergedInto?: { id: string; name: string; phone: string; status: PrismaLeadStatus } | null;
  followUps?: { id?: string; scheduledAt: Date; type?: string; status: string; note?: string | null; completedAt?: Date | null; createdAt?: Date; updatedAt?: Date }[];
  aiInsight?: import("@prisma/client").LeadAIInsight | null;
  activities?: { message: string; createdAt?: Date; type?: string }[];
  deal?: { quotedAmount: Prisma.Decimal | null; finalAmount: Prisma.Decimal; currency?: string } | null;
}): Lead {
  const latestNoteActivity = lead.activities?.find(a => a.type === ActivityType.NOTE_ADDED);

  const isLeadLost = lead.status === PrismaLeadStatus.LOST;
  const pendingFollowUp = isLeadLost ? null : lead.followUps?.find((f) => f.status === "PENDING" || f.status === "Pending");
  let activeFollowUp: import("@/features/followups/types").FollowUp | null = null;
  if (pendingFollowUp) {
    const rawType = pendingFollowUp.type ? typeToDatabase[pendingFollowUp.type] : undefined;
    const mappedType: FollowUpType = rawType ? typeFromDatabase[rawType] : "Call";
    const mappedStatus: FollowUpStatus = "Pending";

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
      leadNote: latestNoteActivity?.message || lead.activities?.[0]?.message || "",
    };
  }

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
    latestNote: latestNoteActivity?.message || lead.activities?.[0]?.message || lead.notes || "",
    quotedAmount: lead.quotedAmount === null ? null : Number(lead.quotedAmount),
    lastContactDate: lead.lastContactDate?.toISOString().slice(0, 10) ?? null,
    nextFollowUpDate: isLeadLost ? null : (activeFollowUp ? activeFollowUp.scheduledAt : (lead.nextFollowUpDate ? lead.nextFollowUpDate.toISOString() : null)),
    notes: lead.notes ?? "",
    createdAt: lead.createdAt.toISOString().slice(0, 10),
    updatedAt: lead.updatedAt.toISOString(),
    mergedIntoLeadId: lead.mergedIntoLeadId ?? null,
    mergedAt: lead.mergedAt ? lead.mergedAt.toISOString() : null,
    mergedInto: lead.mergedInto ? {
      id: lead.mergedInto.id,
      name: lead.mergedInto.name,
      phone: lead.mergedInto.phone,
      status: statusFromDatabase[lead.mergedInto.status as DatabaseLeadStatus] ?? lead.mergedInto.status,
    } : null,
  };

  const operationalState = deriveOperationalState({
    status: baseLead.status,
    isWaste: lead.isWaste,
    nextFollowUpDate: baseLead.nextFollowUpDate,
    followUps: lead.followUps?.map(f => ({
      scheduledAt: f.scheduledAt.toISOString(),
      status: f.status,
    })),
  });

  const dealValue = lead.deal
    ? (Number(lead.deal.finalAmount) > 0 ? Number(lead.deal.finalAmount) : (lead.deal.quotedAmount ? Number(lead.deal.quotedAmount) : null))
    : (lead.quotedAmount ? Number(lead.quotedAmount) : null);

  const lastActivity = lead.activities?.[0] ? {
    message: lead.activities[0].message,
    createdAt: lead.activities[0].createdAt ? lead.activities[0].createdAt.toISOString() : "",
    type: lead.activities[0].type,
  } : null;

  const staleInfo = calculateLeadStaleness({
    id: lead.id,
    status: lead.status,
    isWaste: lead.isWaste,
    deletedAt: (lead as { deletedAt?: Date | null }).deletedAt ?? null,
    mergedIntoLeadId: lead.mergedIntoLeadId ?? null,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    lastContactDate: lead.lastContactDate,
    activities: lead.activities?.map((a) => ({ ...a, createdAt: a.createdAt || lead.updatedAt })),
    lastActivity,
  });

  return {
    ...baseLead,
    isPinned: Boolean(lead.isPinned),
    dealValue,
    lastActivity,
    isWaste: lead.isWaste,
    operationalState,
    aiAttention: deriveAIAttention({
      ...baseLead,
      aiInsight: lead.aiInsight,
    }),
    activeFollowUp,
    staleInfo,
  };
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
      where: { ...where, deletedAt: null, mergedIntoLeadId: null },
      include: leadIncludeStandard,
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
      include: leadIncludeStandard,
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
    const allowDuplicate = formData.get("allowDuplicate") === "true";

    // Server-side duplicate check (race condition safety)
    if (!allowDuplicate) {
      const duplicateCandidate = await findDuplicateLeadCandidates({
        phone: data.phone,
        email: data.email,
        name: data.name,
        business: data.business,
      });

      if (duplicateCandidate && !duplicateCandidate.isDeleted) {
        return {
          success: false,
          error: "A lead with this phone number or email already exists.",
          duplicateCandidate,
        };
      }
    }

    const lead = await db.$transaction(async (tx) => {
      const newLead = await tx.lead.create({ data });
      await tx.leadActivity.create({
        data: {
          leadId: newLead.id,
          type: ActivityType.LEAD_CREATED,
          message: allowDuplicate
            ? "Lead was created (Duplicate lead intentionally allowed by user)"
            : "Lead was created",
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

      const fullLead = await tx.lead.findUnique({
        where: { id: newLead.id },
        include: leadIncludeStandard,
      });

      const undoRecord = await recordUndoAction(tx, {
        actionType: "LEAD_CREATE",
        entityType: "LEAD",
        entityId: newLead.id,
        leadId: newLead.id,
        beforeSnapshot: null,
        afterSnapshot: newLead,
        description: `Create lead ${newLead.name}`,
        createdByUserId: validUserId,
      });

      return { lead: fullLead || newLead, undoId: undoRecord.id };
    }, {
      maxWait: 10000,
      timeout: 20000,
    });

    safeRevalidateLeadPaths(lead.lead.id);
    return { success: true, data: serializeLead(lead.lead), undoId: lead.undoId };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

function parseLeadUpdateData(formData: FormData, oldLead: {
  name: string;
  phone: string;
  email: string | null;
  business: string | null;
  industry: string | null;
  leadSource: string | null;
  budget: Prisma.Decimal | null;
  status: PrismaLeadStatus;
  quotedAmount: Prisma.Decimal | null;
  lastContactDate: Date | null;
  nextFollowUpDate: Date | null;
  notes: string | null;
}) {
  const updateData: Prisma.LeadUpdateInput = {};

  if (formData.has("name")) {
    updateData.name = readString(formData, "name", 120, true)!;
  }
  if (formData.has("phone")) {
    const rawPhone = readString(formData, "phone", 40, true)!;
    const digits = rawPhone.replace(/\D/g, "");
    if (digits.length < 5) {
      throw new UserFacingError("Phone number must contain at least 5 digits.");
    }
    updateData.phone = rawPhone;
  }
  if (formData.has("email")) {
    const email = readString(formData, "email", 254);
    if (email && !emailPattern.test(email)) throw new UserFacingError("Enter a valid email address.");
    updateData.email = email;
  }
  if (formData.has("business")) {
    updateData.business = readString(formData, "business", 160);
  }
  if (formData.has("industry")) {
    updateData.industry = readString(formData, "industry", 100);
  }
  if (formData.has("source")) {
    updateData.leadSource = readString(formData, "source", 100);
  }
  if (formData.has("budget")) {
    updateData.budget = readMoney(formData, "budget");
  }
  if (formData.has("status")) {
    updateData.status = readStatus(formData.get("status"));
  }
  if (formData.has("quotedAmount")) {
    updateData.quotedAmount = readMoney(formData, "quotedAmount");
  }
  if (formData.has("lastContactDate")) {
    updateData.lastContactDate = readDate(formData, "lastContactDate");
  }
  if (formData.has("nextFollowUpDate")) {
    updateData.nextFollowUpDate = readDate(formData, "nextFollowUpDate");
  }
  if (formData.has("notes")) {
    updateData.notes = readString(formData, "notes", 5000);
  }

  return updateData;
}

export async function checkLeadDuplicate(
  leadId: string | undefined,
  phone: string,
  email?: string | null
): Promise<DuplicateLeadCandidate | null> {
  try {
    await requireAuthenticatedUser();
    const result = await findDuplicateLeadCandidates(
      { phone, email: email || null },
      { excludeLeadId: leadId }
    );
    return result;
  } catch {
    return null;
  }
}


export async function updateLead(id: string, formData: FormData): Promise<LeadActionResult<Lead>> {
  try {
    const session = await requireAuthenticatedUser();
    const leadId = readLeadId(id);
    const validUserId = await resolveValidUserId(session.id);

    const lead = await db.$transaction(async (tx) => {
      const oldLead = await tx.lead.findUnique({ where: { id: leadId } });
      if (!oldLead) throw new Prisma.PrismaClientKnownRequestError("Lead not found.", { code: "P2025", clientVersion: Prisma.prismaVersion.client });

      const data = parseLeadUpdateData(formData, oldLead);

      if (data.status === PrismaLeadStatus.LOST && oldLead.status !== PrismaLeadStatus.LOST) {
        data.nextFollowUpDate = null;
        const pendingFollowUps = await tx.followUp.findMany({
          where: { leadId, status: "PENDING" },
        });
        if (pendingFollowUps.length > 0) {
          await tx.followUp.updateMany({
            where: { leadId, status: "PENDING" },
            data: { status: "CANCELLED" },
          });
          for (const fu of pendingFollowUps) {
            await tx.leadActivity.create({
              data: {
                leadId,
                type: ActivityType.FOLLOWUP_CANCELLED,
                message: `Cancelled ${fu.type} follow-up (Lead status changed to Lost)`,
                metadata: { type: fu.type, followUpId: fu.id, reason: "LEAD_STATUS_LOST" },
                createdByUserId: validUserId,
              },
            });
          }
        }
      } else if (oldLead.status === PrismaLeadStatus.LOST && data.status && data.status !== PrismaLeadStatus.LOST) {
        if (!formData.has("nextFollowUpDate")) {
          const existingPending = await tx.followUp.count({ where: { leadId, status: "PENDING" } });
          if (existingPending === 0) {
            const lastCancelled = await tx.followUp.findFirst({
              where: { leadId, status: "CANCELLED" },
              orderBy: { updatedAt: "desc" },
            });
            if (lastCancelled) {
              await tx.followUp.update({
                where: { id: lastCancelled.id },
                data: { status: "PENDING" },
              });
              data.nextFollowUpDate = lastCancelled.scheduledAt;
              await tx.leadActivity.create({
                data: {
                  leadId,
                  type: ActivityType.FOLLOWUP_CREATED,
                  message: `Restored ${lastCancelled.type} follow-up upon reopening lead`,
                  metadata: { followUpId: lastCancelled.id, type: lastCancelled.type, scheduledAt: lastCancelled.scheduledAt },
                  createdByUserId: validUserId,
                },
              });
            }
          }
        }
      }

      const updatedLead = await tx.lead.update({
        where: { id: leadId },
        data,
        include: leadIncludeStandard,
      });

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
        if (oldLead.name !== updatedLead.name || oldLead.business !== updatedLead.business) {
          await tx.deal.updateMany({
            where: { leadId },
            data: {
              clientNameSnapshot: updatedLead.name,
              companyNameSnapshot: updatedLead.business,
            },
          });
        }

        await tx.leadActivity.create({
          data: {
            leadId,
            type: ActivityType.LEAD_UPDATED,
            message: `Lead details updated: changed ${changed.join(", ")}`,
            metadata: { changes: changed },
            createdByUserId: validUserId,
          },
        });
        await markLeadAIInsightNeedsRefresh(leadId, tx);
      }

      const undoRecord = await recordUndoAction(tx, {
        actionType: "LEAD_UPDATE",
        entityType: "LEAD",
        entityId: leadId,
        leadId,
        beforeSnapshot: oldLead,
        afterSnapshot: updatedLead,
        expectedUpdatedAt: updatedLead.updatedAt,
        description: `Lead details updated for ${updatedLead.name}`,
        createdByUserId: validUserId,
      });

      return { lead: updatedLead, undoId: undoRecord.id };
    }, {
      maxWait: 10000,
      timeout: 20000,
    });

    safeRevalidateLeadPaths(leadId);
    return { success: true, data: serializeLead(lead.lead), undoId: lead.undoId };
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

      const updatePayload: Prisma.LeadUpdateInput = { status: databaseStatus };

      if (databaseStatus === PrismaLeadStatus.LOST) {
        updatePayload.nextFollowUpDate = null;
        const pendingFollowUps = await tx.followUp.findMany({
          where: { leadId, status: "PENDING" },
        });
        if (pendingFollowUps.length > 0) {
          await tx.followUp.updateMany({
            where: { leadId, status: "PENDING" },
            data: { status: "CANCELLED" },
          });
          for (const fu of pendingFollowUps) {
            await tx.leadActivity.create({
              data: {
                leadId,
                type: ActivityType.FOLLOWUP_CANCELLED,
                message: `Cancelled ${fu.type} follow-up (Lead marked Lost)`,
                metadata: { type: fu.type, followUpId: fu.id, reason: "LEAD_MARKED_LOST" },
                createdByUserId: validUserId,
              },
            });
          }
        }
      } else if ((oldLead.status as string) === PrismaLeadStatus.LOST) {
        const existingPending = await tx.followUp.count({ where: { leadId, status: "PENDING" } });
        if (existingPending === 0) {
          const lastCancelled = await tx.followUp.findFirst({
            where: { leadId, status: "CANCELLED" },
            orderBy: { updatedAt: "desc" },
          });
          if (lastCancelled) {
            await tx.followUp.update({
              where: { id: lastCancelled.id },
              data: { status: "PENDING" },
            });
            updatePayload.nextFollowUpDate = lastCancelled.scheduledAt;
            await tx.leadActivity.create({
              data: {
                leadId,
                type: ActivityType.FOLLOWUP_CREATED,
                message: `Restored ${lastCancelled.type} follow-up upon reopening lead`,
                metadata: { followUpId: lastCancelled.id, type: lastCancelled.type, scheduledAt: lastCancelled.scheduledAt },
                createdByUserId: validUserId,
              },
            });
          }
        }
      }

      const updatedLead = await tx.lead.update({
        where: { id: leadId },
        data: updatePayload,
        include: leadIncludeStandard,
      });
      
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

      const undoRecord = await recordUndoAction(tx, {
        actionType: "LEAD_STATUS_CHANGE",
        entityType: "LEAD",
        entityId: leadId,
        leadId,
        beforeSnapshot: { status: oldLead.status, quickStatus: oldLead.quickStatus },
        afterSnapshot: { status: databaseStatus, quickStatus: updatedLead.quickStatus },
        expectedUpdatedAt: updatedLead.updatedAt,
        description: `Status changed to ${status}`,
        createdByUserId: validUserId,
      });

      return { lead: updatedLead, undoId: undoRecord.id };
    }, {
      maxWait: 10000,
      timeout: 20000,
    });

    safeRevalidateLeadPaths(leadId);
    return { success: true, data: serializeLead(lead.lead), undoId: lead.undoId };
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
        include: leadIncludeStandard,
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

      const undoRecord = await recordUndoAction(tx, {
        actionType: "LEAD_QUICK_STATUS",
        entityType: "LEAD",
        entityId: id,
        leadId: id,
        beforeSnapshot: { status: existing.status, quickStatus: existing.quickStatus },
        afterSnapshot: { status: nextStatus, quickStatus: quickStatus as PrismaQuickStatus },
        expectedUpdatedAt: result.updatedAt,
        description: `Quick status set to ${quickStatus}`,
        createdByUserId: validUserId,
      });

      return { result, undoId: undoRecord.id };
    }, {
      maxWait: 10000,
      timeout: 20000,
    });

    safeRevalidateLeadPaths(id);

    return { success: true, data: serializeLead(updated.result), undoId: updated.undoId };
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
    const session = await requireAuthenticatedUser();
    const leadId = readLeadId(id);
    const validUserId = await resolveValidUserId(session.id);
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, name: true, deletedAt: true } });
    if (!lead) return { success: false, error: "Lead not found." };
    if (lead.deletedAt) return { success: false, error: "Lead is already deleted." };

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id: leadId },
        data: { deletedAt: new Date() },
        select: { id: true },
      });

      const undoRecord = await recordUndoAction(tx, {
        actionType: "LEAD_DELETE",
        entityType: "LEAD",
        entityId: leadId,
        leadId,
        beforeSnapshot: { deletedAt: null },
        afterSnapshot: { deletedAt: new Date() },
        description: `Deleted lead ${lead.name}`,
        createdByUserId: validUserId,
      });

      return { updated, undoId: undoRecord.id };
    }, {
      maxWait: 15000,
      timeout: 30000,
    });

    safeRevalidateLeadPaths(leadId);
    try {
      revalidatePath("/recently-deleted");
    } catch {
      // safe in test execution
    }
    return { success: true, data: result.updated, undoId: result.undoId };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function restoreLead(id: string): Promise<LeadActionResult<{ id: string }>> {
  try {
    const session = await requireAuthenticatedUser();
    const leadId = readLeadId(id);
    const validUserId = await resolveValidUserId(session.id);
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, name: true, deletedAt: true } });
    if (!lead) return { success: false, error: "Lead not found." };
    if (!lead.deletedAt) return { success: false, error: "Lead is not deleted." };

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id: leadId },
        data: { deletedAt: null },
        select: { id: true },
      });

      const undoRecord = await recordUndoAction(tx, {
        actionType: "LEAD_RESTORE",
        entityType: "LEAD",
        entityId: leadId,
        leadId,
        beforeSnapshot: { deletedAt: lead.deletedAt },
        afterSnapshot: { deletedAt: null },
        description: `Restored lead ${lead.name}`,
        createdByUserId: validUserId,
      });

      return { updated, undoId: undoRecord.id };
    }, {
      maxWait: 15000,
      timeout: 30000,
    });

    safeRevalidateLeadPaths(leadId);
    try {
      revalidatePath("/recently-deleted");
    } catch {
      // safe in test execution
    }
    return { success: true, data: result.updated, undoId: result.undoId };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function permanentlyDeleteLead(id: string): Promise<LeadActionResult<{ id: string }>> {
  try {
    await requireAuthenticatedUser();
    const leadId = readLeadId(id);
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, name: true, business: true, deletedAt: true } });
    if (!lead) return { success: false, error: "Lead not found." };
    if (!lead.deletedAt) return { success: false, error: "Lead is not in Recently Deleted. Delete it first." };

    // Ensure snapshot fields on Deal are populated before permanently deleting the Lead
    await db.deal.updateMany({
      where: { leadId },
      data: {
        clientNameSnapshot: lead.name,
        companyNameSnapshot: lead.business,
      },
    });

    const deleted = await db.lead.delete({ where: { id: leadId }, select: { id: true } });
    try {
      revalidatePath("/", "layout");
      revalidatePath("/leads");
      revalidatePath(`/leads/${leadId}`);
      revalidatePath("/pipeline");
      revalidatePath("/dashboard");
      revalidatePath("/analytics");
      revalidatePath("/follow-ups");
      revalidatePath("/recently-deleted");
      revalidatePath("/deals");
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

      // Ensure Deal snapshots before leads are purged
      const leadsWithDeals = await tx.lead.findMany({
        where: { deal: { isNot: null } },
        select: { id: true, name: true, business: true },
      });
      for (const l of leadsWithDeals) {
        await tx.deal.updateMany({
          where: { leadId: l.id },
          data: {
            clientNameSnapshot: l.name,
            companyNameSnapshot: l.business,
          },
        });
      }

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
      revalidatePath("/deals");
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

    const result = await db.$transaction(async (tx) => {
      const oldLead = await tx.lead.findUnique({ where: { id } });
      if (!oldLead) throw new Prisma.PrismaClientKnownRequestError("Lead not found.", { code: "P2025", clientVersion: Prisma.prismaVersion.client });

      const updatedLead = await tx.lead.update({
        where: { id },
        data: { isWaste: true },
        include: leadIncludeStandard,
      });

      await tx.leadActivity.create({
        data: {
          leadId: id,
          type: ActivityType.LEAD_UPDATED,
          message: "Lead was marked as Waste",
          createdByUserId: validUserId,
        },
      });

      const undoRecord = await recordUndoAction(tx, {
        actionType: "LEAD_WASTE",
        entityType: "LEAD",
        entityId: id,
        leadId: id,
        beforeSnapshot: { isWaste: false },
        afterSnapshot: { isWaste: true },
        expectedUpdatedAt: updatedLead.updatedAt,
        description: `Mark lead ${updatedLead.name} as Waste`,
        createdByUserId: validUserId,
      });

      return { lead: updatedLead, undoId: undoRecord.id };
    }, {
      timeout: 30000,
      maxWait: 15000,
    });

    safeRevalidateLeadPaths(id);

    return { success: true, data: serializeLead(result.lead), undoId: result.undoId };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function restoreWasteLead(leadId: string): Promise<LeadActionResult<Lead>> {
  try {
    const session = await requireAuthenticatedUser();
    const id = readLeadId(leadId);
    const validUserId = await resolveValidUserId(session.id);

    const result = await db.$transaction(async (tx) => {
      const oldLead = await tx.lead.findUnique({ where: { id } });
      if (!oldLead) throw new Prisma.PrismaClientKnownRequestError("Lead not found.", { code: "P2025", clientVersion: Prisma.prismaVersion.client });

      const updatedLead = await tx.lead.update({
        where: { id },
        data: { isWaste: false },
        include: leadIncludeStandard,
      });

      await tx.leadActivity.create({
        data: {
          leadId: id,
          type: ActivityType.LEAD_UPDATED,
          message: "Lead was restored from Waste",
          createdByUserId: validUserId,
        },
      });

      const undoRecord = await recordUndoAction(tx, {
        actionType: "LEAD_WASTE_RESTORE",
        entityType: "LEAD",
        entityId: id,
        leadId: id,
        beforeSnapshot: { isWaste: true },
        afterSnapshot: { isWaste: false },
        expectedUpdatedAt: updatedLead.updatedAt,
        description: `Restore lead ${updatedLead.name} from Waste`,
        createdByUserId: validUserId,
      });

      return { lead: updatedLead, undoId: undoRecord.id };
    }, {
      timeout: 30000,
      maxWait: 15000,
    });

    safeRevalidateLeadPaths(id);

    return { success: true, data: serializeLead(result.lead), undoId: result.undoId };
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
        include: leadIncludeStandard,
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

    safeRevalidateLeadPaths(id);

    return { success: true, data: serializeLead(lead) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function togglePinLead(
  leadId: string,
  explicitPinned?: boolean
): Promise<LeadActionResult<Lead>> {
  try {
    const session = await requireAuthenticatedUser();
    const id = readLeadId(leadId);
    const validUserId = await resolveValidUserId(session.id);

    const existing = await db.lead.findUnique({
      where: { id, deletedAt: null },
      select: { id: true, isPinned: true, name: true },
    });
    if (!existing) {
      return { success: false, error: "Lead not found." };
    }

    const nextPinned = explicitPinned !== undefined ? explicitPinned : !existing.isPinned;

    const result = await db.$transaction(async (tx) => {
      const lead = await tx.lead.update({
        where: { id },
        data: { isPinned: nextPinned },
        include: leadIncludeStandard,
      });

      const undoRecord = await recordUndoAction(tx, {
        actionType: "LEAD_PIN",
        entityType: "LEAD",
        entityId: id,
        leadId: id,
        beforeSnapshot: { isPinned: existing.isPinned },
        afterSnapshot: { isPinned: nextPinned },
        expectedUpdatedAt: lead.updatedAt,
        description: nextPinned ? `Pinned lead ${existing.name}` : `Unpinned lead ${existing.name}`,
        createdByUserId: validUserId,
      });

      return { lead, undoId: undoRecord.id };
    }, {
      timeout: 30000,
      maxWait: 15000,
    });

    safeRevalidateLeadPaths(id);

    return { success: true, data: serializeLead(result.lead), undoId: result.undoId };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Enriches an existing lead with newly entered information (from duplicate resolution).
 * Does NOT create a temporary or duplicate lead record.
 */
export async function enrichExistingLead(
  targetLeadId: string,
  data: {
    name?: string;
    phone?: string;
    email?: string | null;
    business?: string | null;
    industry?: string | null;
    leadSource?: string | null;
    budget?: number | null;
    quotedAmount?: number | null;
    status?: LeadStatus;
    notes?: string | null;
    nextFollowUpDate?: string | null;
  }
): Promise<LeadActionResult<Lead>> {
  try {
    const session = await requireAuthenticatedUser();
    const id = readLeadId(targetLeadId);
    const validUserId = await resolveValidUserId(session.id);

    const lead = await db.$transaction(async (tx) => {
      const oldLead = await tx.lead.findUnique({
        where: { id, deletedAt: null, mergedIntoLeadId: null },
      });
      if (!oldLead) throw new UserFacingError("Target lead not found or already merged.");

      const updateData: Prisma.LeadUpdateInput = {};
      const changes: string[] = [];

      if (data.name && data.name.trim() && data.name.trim() !== oldLead.name) {
        updateData.name = data.name.trim();
        changes.push("name");
      }
      if (data.phone && data.phone.trim() && data.phone.trim() !== oldLead.phone) {
        updateData.phone = data.phone.trim();
        changes.push("phone");
      }
      if (data.email && data.email.trim() && (!oldLead.email || data.email.trim() !== oldLead.email)) {
        updateData.email = data.email.trim();
        changes.push("email");
      }
      if (data.business && data.business.trim() && (!oldLead.business || data.business.trim() !== oldLead.business)) {
        updateData.business = data.business.trim();
        changes.push("business");
      }
      if (data.industry && data.industry.trim() && (!oldLead.industry || data.industry.trim() !== oldLead.industry)) {
        updateData.industry = data.industry.trim();
        changes.push("industry");
      }
      if (data.leadSource && data.leadSource.trim() && (!oldLead.leadSource || data.leadSource.trim() !== oldLead.leadSource)) {
        updateData.leadSource = data.leadSource.trim();
        changes.push("source");
      }
      if (data.budget !== undefined && data.budget !== null) {
        const dec = new Prisma.Decimal(data.budget);
        if (!oldLead.budget || oldLead.budget.toString() !== dec.toString()) {
          updateData.budget = dec;
          changes.push("budget");
        }
      }
      if (data.quotedAmount !== undefined && data.quotedAmount !== null) {
        const dec = new Prisma.Decimal(data.quotedAmount);
        if (!oldLead.quotedAmount || oldLead.quotedAmount.toString() !== dec.toString()) {
          updateData.quotedAmount = dec;
          changes.push("quoted amount");
        }
      }
      if (data.status) {
        const dbStatus = statusToDatabase[data.status] as PrismaLeadStatus;
        if (dbStatus && dbStatus !== oldLead.status) {
          updateData.status = dbStatus;
          changes.push("status");
        }
      }
      if (data.notes && data.notes.trim()) {
        const newNotes = data.notes.trim();
        if (!oldLead.notes) {
          updateData.notes = newNotes;
          changes.push("notes");
        } else if (!oldLead.notes.includes(newNotes)) {
          updateData.notes = `${oldLead.notes}\n\n[Enriched]: ${newNotes}`;
          changes.push("notes");
        }
      }

      const updatedLead = changes.length > 0
        ? await tx.lead.update({
            where: { id },
            data: updateData,
            include: leadIncludeStandard,
          })
        : await tx.lead.findUniqueOrThrow({
            where: { id },
            include: leadIncludeStandard,
          });

      if (changes.length > 0) {
        await tx.leadActivity.create({
          data: {
            leadId: id,
            type: ActivityType.LEAD_UPDATED,
            message: `Lead enriched with new details: updated ${changes.join(", ")}`,
            metadata: { changes, enrichedFrom: "duplicate_resolution" },
            createdByUserId: validUserId,
          },
        });
        await markLeadAIInsightNeedsRefresh(id, tx);
      }

      return updatedLead;
    });

    safeRevalidateLeadPaths(id);
    return { success: true, data: serializeLead(lead) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Safely merges two existing leads inside a single Prisma transaction.
 * All legitimate history (activities, follow-ups, deals, payments) is preserved.
 * Strictly guarantees maximum ONE active PENDING follow-up after merge.
 */
export async function mergeLeadsAction(input: MergeLeadsInput): Promise<LeadActionResult<Lead>> {
  try {
    const session = await requireAuthenticatedUser();
    const validUserId = await resolveValidUserId(session.id);
    const { primaryLeadId, mergedLeadId, fieldResolutions, survivingFollowUpId } = input;

    if (!primaryLeadId || !mergedLeadId || primaryLeadId === mergedLeadId) {
      throw new UserFacingError("Invalid primary or merged lead selection.");
    }

    const mergedResult = await db.$transaction(async (tx) => {
      const primaryLead = await tx.lead.findUnique({
        where: { id: primaryLeadId },
        include: {
          deal: { include: { payments: true } },
          followUps: { where: { status: "PENDING" } },
        },
      });

      const duplicateLead = await tx.lead.findUnique({
        where: { id: mergedLeadId },
        include: {
          deal: { include: { payments: true } },
          followUps: true,
          activities: true,
        },
      });

      if (!primaryLead || primaryLead.deletedAt || primaryLead.mergedIntoLeadId) {
        throw new UserFacingError("Primary lead is not available or already merged.");
      }
      if (!duplicateLead || duplicateLead.deletedAt || duplicateLead.mergedIntoLeadId) {
        throw new UserFacingError("Duplicate lead is not available or already merged.");
      }

      // 1. Resolve editable fields (empty fields never overwrite populated fields)
      const updateData: Prisma.LeadUpdateInput = {};
      if (fieldResolutions.name && fieldResolutions.name.trim()) {
        updateData.name = fieldResolutions.name.trim();
      }
      if (fieldResolutions.phone && fieldResolutions.phone.trim()) {
        updateData.phone = fieldResolutions.phone.trim();
      }
      if (fieldResolutions.email !== undefined) {
        updateData.email = fieldResolutions.email ? fieldResolutions.email.trim() : null;
      }
      if (fieldResolutions.business !== undefined) {
        updateData.business = fieldResolutions.business ? fieldResolutions.business.trim() : null;
      }
      if (fieldResolutions.industry !== undefined) {
        updateData.industry = fieldResolutions.industry ? fieldResolutions.industry.trim() : null;
      }
      if (fieldResolutions.leadSource !== undefined) {
        updateData.leadSource = fieldResolutions.leadSource ? fieldResolutions.leadSource.trim() : null;
      }
      if (fieldResolutions.budget !== undefined) {
        updateData.budget = fieldResolutions.budget !== null ? new Prisma.Decimal(fieldResolutions.budget) : null;
      }
      if (fieldResolutions.quotedAmount !== undefined) {
        updateData.quotedAmount = fieldResolutions.quotedAmount !== null ? new Prisma.Decimal(fieldResolutions.quotedAmount) : null;
      }
      if (fieldResolutions.status) {
        updateData.status = statusToDatabase[fieldResolutions.status] as PrismaLeadStatus;
      }

      // Pinned safety: if either lead was pinned, Primary is pinned
      if (duplicateLead.isPinned && !primaryLead.isPinned) {
        updateData.isPinned = true;
      }

      // 2. Deal & Payments financial safety
      let dealResolutionDetail = "No deals involved";
      if (!primaryLead.deal && duplicateLead.deal) {
        // Only duplicate lead has a Deal: safely reassign it to Primary Lead
        await tx.deal.update({
          where: { id: duplicateLead.deal.id },
          data: { leadId: primaryLeadId },
        });
        dealResolutionDetail = `Reassigned Deal ${duplicateLead.deal.id} (${duplicateLead.deal.payments.length} payments) to Primary Lead`;
      } else if (primaryLead.deal && duplicateLead.deal) {
        // Both have deals: Primary keeps its deal; Duplicate's deal is safely detached as independent historical record
        const snapshotNote = duplicateLead.deal.notes
          ? `${duplicateLead.deal.notes}\n\n[Merged Lead Record] Formerly attached to merged lead "${duplicateLead.name}"`
          : `[Merged Lead Record] Formerly attached to merged lead "${duplicateLead.name}"`;

        await tx.deal.update({
          where: { id: duplicateLead.deal.id },
          data: {
            leadId: null,
            notes: snapshotNote,
          },
        });
        dealResolutionDetail = `Primary Deal ${primaryLead.deal.id} retained. Duplicate Deal ${duplicateLead.deal.id} preserved as detached record.`;
      } else if (primaryLead.deal && !duplicateLead.deal) {
        dealResolutionDetail = `Primary Deal ${primaryLead.deal.id} unchanged`;
      }

      // 3. Follow-up safety: Exactly one or zero active PENDING follow-ups after merge
      const primaryPending = primaryLead.followUps.find((f) => f.status === "PENDING");
      const duplicatePending = duplicateLead.followUps.find((f) => f.status === "PENDING");
      let followUpResolutionDetail = "No active follow-ups";

      if (primaryPending && duplicatePending) {
        if (survivingFollowUpId === duplicatePending.id) {
          // Keep duplicate's active follow-up, cancel primary's active follow-up
          await tx.followUp.update({
            where: { id: primaryPending.id },
            data: {
              status: "CANCELLED",
              note: primaryPending.note ? `${primaryPending.note} (Cancelled via merge)` : "Cancelled via merge",
            },
          });
          // Transfer duplicate pending to primary
          await tx.followUp.update({
            where: { id: duplicatePending.id },
            data: { leadId: primaryLeadId },
          });
          followUpResolutionDetail = `Kept duplicate active follow-up (${duplicatePending.scheduledAt.toISOString()}); cancelled primary follow-up`;
          updateData.nextFollowUpDate = duplicatePending.scheduledAt;
        } else {
          // Keep primary's active follow-up, cancel duplicate's active follow-up
          await tx.followUp.update({
            where: { id: duplicatePending.id },
            data: {
              leadId: primaryLeadId,
              status: "CANCELLED",
              note: duplicatePending.note ? `${duplicatePending.note} (Cancelled via merge)` : "Cancelled via merge",
            },
          });
          followUpResolutionDetail = `Kept primary active follow-up (${primaryPending.scheduledAt.toISOString()}); cancelled duplicate follow-up`;
          updateData.nextFollowUpDate = primaryPending.scheduledAt;
        }
      } else if (!primaryPending && duplicatePending) {
        // Transfer duplicate active follow-up to primary
        await tx.followUp.update({
          where: { id: duplicatePending.id },
          data: { leadId: primaryLeadId },
        });
        followUpResolutionDetail = `Transferred active follow-up (${duplicatePending.scheduledAt.toISOString()}) to primary`;
        updateData.nextFollowUpDate = duplicatePending.scheduledAt;
      } else if (primaryPending && !duplicatePending) {
        followUpResolutionDetail = `Kept primary active follow-up (${primaryPending.scheduledAt.toISOString()})`;
        updateData.nextFollowUpDate = primaryPending.scheduledAt;
      } else {
        updateData.nextFollowUpDate = null;
      }

      // Reassociate all other follow-ups from duplicate lead to primary lead (completed, cancelled)
      await tx.followUp.updateMany({
        where: { leadId: mergedLeadId },
        data: { leadId: primaryLeadId },
      });

      // 4. Activity history preservation
      await tx.leadActivity.updateMany({
        where: { leadId: mergedLeadId },
        data: { leadId: primaryLeadId },
      });

      // 5. Legacy notes preservation
      if (duplicateLead.notes && duplicateLead.notes.trim()) {
        const trimmedNote = duplicateLead.notes.trim();
        const hasExistingActivity = duplicateLead.activities.some(
          (a) => a.type === ActivityType.NOTE_ADDED && a.message.trim() === trimmedNote
        );
        if (!hasExistingActivity) {
          await tx.leadActivity.create({
            data: {
              leadId: primaryLeadId,
              type: ActivityType.NOTE_ADDED,
              message: trimmedNote,
              metadata: { source: "legacy_note_from_merged_lead", mergedLeadId },
              createdByUserId: validUserId,
            },
          });
        }
      }

      // 6. Update Primary Lead
      const updatedPrimary = await tx.lead.update({
        where: { id: primaryLeadId },
        data: updateData,
        include: leadIncludeStandard,
      });

      // 7. Create durable LEAD_MERGED audit activity
      await tx.leadActivity.create({
        data: {
          leadId: primaryLeadId,
          type: ActivityType.LEAD_MERGED,
          message: `Merged duplicate lead "${duplicateLead.name}" into this record.`,
          metadata: {
            primaryLeadId,
            mergedLeadId,
            mergedLeadName: duplicateLead.name,
            mergedLeadPhone: duplicateLead.phone,
            mergedAt: new Date().toISOString(),
            fieldResolutions,
            followUpResolution: followUpResolutionDetail,
            dealResolution: dealResolutionDetail,
          },
          createdByUserId: validUserId,
        },
      });

      // 8. Mark duplicate lead as merged
      await tx.lead.update({
        where: { id: mergedLeadId },
        data: {
          mergedIntoLeadId: primaryLeadId,
          mergedAt: new Date(),
        },
      });

      // 9. Refresh AI attention
      await markLeadAIInsightNeedsRefresh(primaryLeadId, tx);

      return updatedPrimary;
    }, {
      maxWait: 10000,
      timeout: 20000,
    });

    safeRevalidateLeadPaths(primaryLeadId);
    safeRevalidateLeadPaths(mergedLeadId);
    try {
      revalidatePath("/deals");
    } catch {}

    return { success: true, data: serializeLead(mergedResult) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Returns grouped duplicate candidates across active leads for the "Possible Duplicates" view.
 */
export async function getDuplicateGroupsAction() {
  try {
    await requireAuthenticatedUser();
    const groups = await getDuplicateGroups();
    return { success: true, data: groups };
  } catch (error) {
    return { success: false, error: cleanError(error), data: [] };
  }
}


