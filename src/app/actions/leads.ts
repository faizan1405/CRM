"use server";

import { LeadStatus as PrismaLeadStatus, Prisma, ActivityType } from "@prisma/client";
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
} from "@/features/leads/types";

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
  quotedAmount: Prisma.Decimal | null;
  lastContactDate: Date | null;
  nextFollowUpDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Lead {
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email ?? "",
    business: lead.business ?? "",
    industry: lead.industry ?? "",
    source: lead.leadSource ?? "",
    budget: lead.budget === null ? null : Number(lead.budget),
    status: statusFromDatabase[lead.status as DatabaseLeadStatus],
    quotedAmount: lead.quotedAmount === null ? null : Number(lead.quotedAmount),
    lastContactDate: lead.lastContactDate?.toISOString().slice(0, 10) ?? null,
    nextFollowUpDate: lead.nextFollowUpDate?.toISOString().slice(0, 10) ?? null,
    notes: lead.notes ?? "",
    createdAt: lead.createdAt.toISOString().slice(0, 10),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

function cleanError(error: unknown) {
  if (error instanceof UserFacingError) return error.message;
  return "We could not save that change. Please try again.";
}

export async function getLeads(): Promise<LeadActionResult<Lead[]>> {
  try {
    await requireAuthenticatedUser();
    const leads = await db.lead.findMany({ orderBy: { createdAt: "desc" } });
    return { success: true, data: leads.map(serializeLead) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function getLead(id: string): Promise<LeadActionResult<Lead>> {
  try {
    await requireAuthenticatedUser();
    const lead = await db.lead.findUnique({ where: { id: readLeadId(id) } });
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
    const lead = await db.$transaction(async (tx) => {
      const newLead = await tx.lead.create({ data });
      await tx.leadActivity.create({
        data: {
          leadId: newLead.id,
          type: ActivityType.LEAD_CREATED,
          message: "Lead was created",
          createdByUserId: session.id as string,
        },
      });
      return newLead;
    });
    revalidatePath("/leads");
    revalidatePath("/pipeline");
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
    
    const lead = await db.$transaction(async (tx) => {
      const oldLead = await tx.lead.findUnique({ where: { id: leadId } });
      if (!oldLead) throw new Prisma.PrismaClientKnownRequestError("Lead not found.", { code: "P2025", clientVersion: Prisma.prismaVersion.client });
      
      const updatedLead = await tx.lead.update({ where: { id: leadId }, data });
      
      // Determine if meaningful fields changed
      const changed: string[] = [];
      if (oldLead.name !== updatedLead.name) changed.push("name");
      if (oldLead.email !== updatedLead.email) changed.push("email");
      if (oldLead.phone !== updatedLead.phone) changed.push("phone");
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
            createdByUserId: session.id as string,
          },
        });
      }
      return updatedLead;
    });

    revalidatePath("/leads");
    revalidatePath("/pipeline");
    return { success: true, data: serializeLead(lead) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return { success: false, error: "Lead not found." };
    return { success: false, error: cleanError(error) };
  }
}

export async function changeLeadStatus(id: string, status: LeadStatus): Promise<LeadActionResult<Lead>> {
  try {
    const session = await requireAuthenticatedUser();
    const databaseStatus = statusToDatabase[status];
    if (!databaseStatus) return { success: false, error: "Select a valid lead status." };
    const leadId = readLeadId(id);

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
            metadata: { oldStatus: oldLead.status, newStatus: databaseStatus },
            createdByUserId: session.id as string,
          },
        });
      }
      return updatedLead;
    });

    revalidatePath("/leads");
    revalidatePath("/pipeline");
    return { success: true, data: serializeLead(lead) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return { success: false, error: "Lead not found." };
    return { success: false, error: cleanError(error) };
  }
}

export async function deleteLead(id: string): Promise<LeadActionResult<{ id: string }>> {
  try {
    await requireAuthenticatedUser();
    const deleted = await db.lead.delete({ where: { id: readLeadId(id) }, select: { id: true } });
    revalidatePath("/leads");
    revalidatePath("/pipeline");
    return { success: true, data: deleted };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return { success: false, error: "Lead not found." };
    return { success: false, error: cleanError(error) };
  }
}
