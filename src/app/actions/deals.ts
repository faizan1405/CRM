"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma, DealStatus as PrismaDealStatus, PaymentType as PrismaPaymentType, PaymentMethod as PrismaPaymentMethod, DealSource as PrismaDealSource } from "@prisma/client";
import type {
  DealActionResult,
  SerializedDeal,
  SerializedPayment,
  DealSummaryMetrics,
  DealStatus,
  DealSource,
  PaymentType,
  PaymentMethod,
  UpsertDealInput,
  RecordPaymentInput,
  CreateOtherClientDealInput,
} from "@/features/deals/types";
import {
  calculateTotalReceived,
  calculateRemainingBalance,
  derivePaymentStatus,
  calculateDealMetrics,
} from "@/features/deals/calculations";
import { touchCrmSync } from "@/lib/crm-sync";
import { recordUndoAction } from "@/features/undo/services/undo-engine";

class UserFacingError extends Error {}

async function requireAuthenticatedUser() {
  const session = await getSession();
  if (!session || typeof session.id !== "string") {
    throw new UserFacingError("You must be signed in to manage deals and payments.");
  }
  return session;
}

function cleanError(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof Error) {
    console.error("[Deals Action Error]:", error.message);
    return error.message;
  }
  return "An unexpected error occurred.";
}

function serializePayment(p: {
  id: string;
  dealId: string;
  amount: Prisma.Decimal;
  paymentDate: Date;
  type: PrismaPaymentType;
  customType: string | null;
  method: PrismaPaymentMethod;
  note: string | null;
  reference?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SerializedPayment {
  return {
    id: p.id,
    dealId: p.dealId,
    amount: Number(p.amount),
    paymentDate: p.paymentDate.toISOString().slice(0, 10),
    type: p.type as PaymentType,
    customType: p.customType,
    method: p.method as PaymentMethod,
    note: p.note,
    reference: p.reference ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function serializeDeal(
  deal: {
    id: string;
    source?: PrismaDealSource | string;
    leadId: string | null;
    clientNameSnapshot?: string | null;
    companyNameSnapshot?: string | null;
    clientPhone?: string | null;
    clientEmail?: string | null;
    projectName?: string | null;
    notes?: string | null;
    quotedAmount: Prisma.Decimal | null;
    finalAmount: Prisma.Decimal;
    currency: string;
    status: PrismaDealStatus;
    nextPaymentDueDate: Date | null;
    nextPaymentDueAmount: Prisma.Decimal | null;
    createdAt: Date;
    updatedAt: Date;
    payments?: Array<{
      id: string;
      dealId: string;
      amount: Prisma.Decimal;
      paymentDate: Date;
      type: PrismaPaymentType;
      customType: string | null;
      method: PrismaPaymentMethod;
      note: string | null;
      reference?: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
    lead?: {
      id: string;
      name: string;
      business: string | null;
      phone: string;
      email?: string | null;
      status: string;
    } | null;
  }
): SerializedDeal {
  const payments = (deal.payments || []).map(serializePayment);
  const totalReceived = calculateTotalReceived(payments);
  const finalAmount = Number(deal.finalAmount) || 0;
  const remainingBalance = calculateRemainingBalance(finalAmount, totalReceived);
  const nextPaymentDueDate = deal.nextPaymentDueDate ? deal.nextPaymentDueDate.toISOString().slice(0, 10) : null;
  const paymentStatus = derivePaymentStatus(finalAmount, totalReceived, nextPaymentDueDate);

  return {
    id: deal.id,
    source: (deal.source as DealSource) || "CRM_LEAD",
    leadId: deal.leadId,
    clientNameSnapshot: deal.clientNameSnapshot ?? null,
    companyNameSnapshot: deal.companyNameSnapshot ?? null,
    clientPhone: deal.clientPhone ?? null,
    clientEmail: deal.clientEmail ?? null,
    projectName: deal.projectName ?? null,
    notes: deal.notes ?? null,
    quotedAmount: deal.quotedAmount ? Number(deal.quotedAmount) : null,
    finalAmount,
    currency: deal.currency || "INR",
    status: deal.status as DealStatus,
    nextPaymentDueDate,
    nextPaymentDueAmount: deal.nextPaymentDueAmount ? Number(deal.nextPaymentDueAmount) : null,
    payments,
    totalReceived,
    remainingBalance,
    paymentStatus,
    lead: deal.lead
      ? {
          id: deal.lead.id,
          name: deal.lead.name,
          business: deal.lead.business,
          phone: deal.lead.phone,
          email: deal.lead.email ?? null,
          status: deal.lead.status,
        }
      : null,
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
  };
}

/**
 * Fetch deal and payments for a specific lead.
 */
export async function getLeadDeal(leadId: string): Promise<DealActionResult<SerializedDeal | null>> {
  try {
    await requireAuthenticatedUser();

    const deal = await db.deal.findUnique({
      where: { leadId },
      include: {
        payments: {
          orderBy: { paymentDate: "desc" },
        },
        lead: {
          select: {
            id: true,
            name: true,
            business: true,
            phone: true,
            email: true,
            status: true,
          },
        },
      },
    });

    if (!deal) return { success: true, data: null };
    return { success: true, data: serializeDeal(deal) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Fetch a single deal by deal ID.
 */
export async function getDealById(dealId: string): Promise<DealActionResult<SerializedDeal | null>> {
  try {
    await requireAuthenticatedUser();
    if (!dealId) throw new UserFacingError("Deal ID is required.");

    const deal = await db.deal.findUnique({
      where: { id: dealId },
      include: {
        payments: {
          orderBy: { paymentDate: "desc" },
        },
        lead: {
          select: {
            id: true,
            name: true,
            business: true,
            phone: true,
            email: true,
            status: true,
          },
        },
      },
    });

    if (!deal) return { success: true, data: null };
    return { success: true, data: serializeDeal(deal) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Create or update deal info for a lead or existing deal.
 * Guaranteed: One lead can have at most one deal (via unique leadId constraint).
 */
export async function upsertLeadDeal(input: UpsertDealInput): Promise<DealActionResult<SerializedDeal>> {
  try {
    const session = await requireAuthenticatedUser();

    if (!input.leadId && !input.dealId) throw new UserFacingError("Lead ID or Deal ID is required.");
    const finalAmount = Number(input.finalAmount) || 0;
    if (finalAmount < 0) throw new UserFacingError("Final deal value cannot be negative.");

    let dueDate: Date | null = null;
    if (input.nextPaymentDueDate) {
      dueDate = new Date(`${input.nextPaymentDueDate}T00:00:00.000Z`);
      if (Number.isNaN(dueDate.getTime())) {
        throw new UserFacingError("Invalid next payment due date.");
      }
    }

    // If dealId is provided, update by dealId
    if (input.dealId) {
      const existingDeal = await db.deal.findUnique({
        where: { id: input.dealId },
        include: { lead: true },
      });
      if (!existingDeal) throw new UserFacingError("Deal not found.");

      const updateData: Prisma.DealUpdateInput = {
        quotedAmount: input.quotedAmount !== undefined && input.quotedAmount !== null ? new Prisma.Decimal(input.quotedAmount) : null,
        finalAmount: new Prisma.Decimal(finalAmount),
        currency: input.currency || "INR",
        status: (input.status as PrismaDealStatus) || "NEGOTIATING",
        nextPaymentDueDate: dueDate,
        nextPaymentDueAmount: input.nextPaymentDueAmount !== undefined && input.nextPaymentDueAmount !== null ? new Prisma.Decimal(input.nextPaymentDueAmount) : null,
      };

      if (input.projectName !== undefined) {
        updateData.projectName = input.projectName ? input.projectName.trim() : null;
      }
      if (input.notes !== undefined) {
        updateData.notes = input.notes ? input.notes.trim() : null;
      }

      // If deal is tied to a live CRM lead: keep snapshot in sync with canonical lead data
      if (existingDeal.lead) {
        updateData.clientNameSnapshot = existingDeal.lead.name;
        updateData.companyNameSnapshot = existingDeal.lead.business || null;
        updateData.clientPhone = existingDeal.lead.phone || null;
        updateData.clientEmail = existingDeal.lead.email || null;
      } else {
        // Standalone Other Client or Preserved Deal (lead deleted): allow editing snapshots directly
        if (input.clientName !== undefined) {
          updateData.clientNameSnapshot = input.clientName ? input.clientName.trim() : null;
        }
        if (input.companyName !== undefined) {
          updateData.companyNameSnapshot = input.companyName ? input.companyName.trim() : null;
        }
        if (input.clientPhone !== undefined) {
          updateData.clientPhone = input.clientPhone ? input.clientPhone.trim() : null;
        }
        if (input.clientEmail !== undefined) {
          updateData.clientEmail = input.clientEmail ? input.clientEmail.trim() : null;
        }
      }

      const deal = await db.deal.update({
        where: { id: input.dealId },
        data: updateData,
        include: {
          payments: {
            orderBy: { paymentDate: "desc" },
          },
          lead: {
            select: {
              id: true,
              name: true,
              business: true,
              phone: true,
              email: true,
              status: true,
            },
          },
        },
      });

      let undoId: string | undefined;
      try {
        const undo = await recordUndoAction({
          actionType: "DEAL_UPDATE",
          entityType: "DEAL",
          entityId: deal.id,
          leadId: deal.leadId,
          beforeSnapshot: existingDeal,
          afterSnapshot: deal,
          expectedUpdatedAt: existingDeal.updatedAt,
          description: `Update deal for ${deal.lead?.name || deal.clientNameSnapshot || "Client"}`,
          userId: session.id as string,
        });
        undoId = undo.id;
      } catch (e) {
        console.error("[Undo] Failed to record undo for update deal:", e);
      }

      await touchCrmSync();

      revalidatePath("/deals");
      revalidatePath("/leads");
      return { success: true, data: serializeDeal(deal), undoId };
    }

    // Otherwise, create or update by leadId
    const leadId = input.leadId!;
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      select: { id: true, name: true, business: true, phone: true, email: true },
    });

    const existingLeadDeal = await db.deal.findUnique({
      where: { leadId },
      include: { payments: true },
    });

    const data: Prisma.DealCreateInput = {
      lead: { connect: { id: leadId } },
      clientNameSnapshot: lead?.name || null,
      companyNameSnapshot: lead?.business || null,
      clientPhone: lead?.phone || null,
      clientEmail: lead?.email || null,
      projectName: input.projectName ? input.projectName.trim() : null,
      notes: input.notes ? input.notes.trim() : null,
      quotedAmount: input.quotedAmount !== undefined && input.quotedAmount !== null ? new Prisma.Decimal(input.quotedAmount) : null,
      finalAmount: new Prisma.Decimal(finalAmount),
      currency: input.currency || "INR",
      status: (input.status as PrismaDealStatus) || "NEGOTIATING",
      nextPaymentDueDate: dueDate,
      nextPaymentDueAmount: input.nextPaymentDueAmount !== undefined && input.nextPaymentDueAmount !== null ? new Prisma.Decimal(input.nextPaymentDueAmount) : null,
    };

    const updateData: Prisma.DealUpdateInput = {
      quotedAmount: input.quotedAmount !== undefined && input.quotedAmount !== null ? new Prisma.Decimal(input.quotedAmount) : null,
      finalAmount: new Prisma.Decimal(finalAmount),
      currency: input.currency || "INR",
      status: (input.status as PrismaDealStatus) || "NEGOTIATING",
      nextPaymentDueDate: dueDate,
      nextPaymentDueAmount: input.nextPaymentDueAmount !== undefined && input.nextPaymentDueAmount !== null ? new Prisma.Decimal(input.nextPaymentDueAmount) : null,
    };

    if (lead) {
      updateData.clientNameSnapshot = lead.name;
      updateData.companyNameSnapshot = lead.business || null;
      updateData.clientPhone = lead.phone || null;
      updateData.clientEmail = lead.email || null;
    }
    if (input.projectName !== undefined) {
      updateData.projectName = input.projectName ? input.projectName.trim() : null;
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes ? input.notes.trim() : null;
    }

    const deal = await db.deal.upsert({
      where: { leadId },
      create: data,
      update: updateData,
      include: {
        payments: {
          orderBy: { paymentDate: "desc" },
        },
        lead: {
          select: {
            id: true,
            name: true,
            business: true,
            phone: true,
            email: true,
            status: true,
          },
        },
      },
    });

    let undoId: string | undefined;
    try {
      if (existingLeadDeal) {
        const undo = await recordUndoAction({
          actionType: "DEAL_UPDATE",
          entityType: "DEAL",
          entityId: deal.id,
          leadId: deal.leadId,
          beforeSnapshot: existingLeadDeal,
          afterSnapshot: deal,
          expectedUpdatedAt: existingLeadDeal.updatedAt,
          description: `Update deal for ${deal.lead?.name || deal.clientNameSnapshot || "Lead"}`,
          userId: session.id as string,
        });
        undoId = undo.id;
      } else {
        const undo = await recordUndoAction({
          actionType: "DEAL_CREATE",
          entityType: "DEAL",
          entityId: deal.id,
          leadId: deal.leadId,
          beforeSnapshot: null,
          afterSnapshot: deal,
          description: `Create deal for ${deal.lead?.name || deal.clientNameSnapshot || "Lead"}`,
          userId: session.id as string,
        });
        undoId = undo.id;
      }
    } catch (e) {
      console.error("[Undo] Failed to record undo for upsert lead deal:", e);
    }

    await touchCrmSync();

    revalidatePath("/deals");
    revalidatePath("/leads");
    return { success: true, data: serializeDeal(deal), undoId };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Create a standalone Other Client deal (no CRM lead relationship).
 */
export async function createOtherClientDeal(
  input: CreateOtherClientDealInput
): Promise<DealActionResult<SerializedDeal>> {
  try {
    const session = await requireAuthenticatedUser();

    const clientName = input.clientName ? input.clientName.trim() : "";
    if (!clientName) {
      throw new UserFacingError("Client name is required.");
    }

    const finalAmount = Number(input.finalAmount);
    if (isNaN(finalAmount) || finalAmount < 0) {
      throw new UserFacingError("Final deal value must be a valid non-negative number.");
    }

    let dueDate: Date | null = null;
    if (input.nextPaymentDueDate) {
      dueDate = new Date(`${input.nextPaymentDueDate}T00:00:00.000Z`);
      if (Number.isNaN(dueDate.getTime())) {
        throw new UserFacingError("Invalid next payment due date.");
      }
    }

    let dueAmount: Prisma.Decimal | null = null;
    if (input.nextPaymentDueAmount !== undefined && input.nextPaymentDueAmount !== null && String(input.nextPaymentDueAmount).trim() !== "") {
      const parsedDue = Number(input.nextPaymentDueAmount);
      if (!isNaN(parsedDue) && parsedDue >= 0) {
        dueAmount = new Prisma.Decimal(parsedDue);
      }
    }

    const deal = await db.deal.create({
      data: {
        source: "OTHER_CLIENT",
        leadId: null,
        clientNameSnapshot: clientName,
        companyNameSnapshot: input.companyName?.trim() || null,
        clientPhone: input.clientPhone?.trim() || null,
        clientEmail: input.clientEmail?.trim() || null,
        projectName: input.projectName?.trim() || null,
        notes: input.notes?.trim() || null,
        finalAmount: new Prisma.Decimal(finalAmount),
        currency: input.currency?.trim() || "INR",
        status: (input.status as PrismaDealStatus) || "CONFIRMED",
        nextPaymentDueDate: dueDate,
        nextPaymentDueAmount: dueAmount,
      },
      include: {
        payments: {
          orderBy: { paymentDate: "desc" },
        },
        lead: {
          select: {
            id: true,
            name: true,
            business: true,
            phone: true,
            status: true,
          },
        },
      },
    });

    let undoId: string | undefined;
    try {
      const undo = await recordUndoAction({
        actionType: "DEAL_CREATE",
        entityType: "DEAL",
        entityId: deal.id,
        leadId: null,
        beforeSnapshot: null,
        afterSnapshot: deal,
        description: `Create deal for ${deal.clientNameSnapshot || "Client"}`,
        userId: session.id as string,
      });
      undoId = undo.id;
    } catch (e) {
      console.error("[Undo] Failed to record undo for other client deal:", e);
    }

    await touchCrmSync();

    revalidatePath("/deals");
    return { success: true, data: serializeDeal(deal), undoId };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Record a new payment entry for a deal.
 */
export async function addDealPayment(input: RecordPaymentInput): Promise<DealActionResult<SerializedPayment>> {
  try {
    const session = await requireAuthenticatedUser();

    if (!input.dealId) throw new UserFacingError("Deal ID is required.");
    const amount = Number(input.amount);
    if (!amount || amount <= 0) throw new UserFacingError("Payment amount must be greater than 0.");

    let paymentDate = new Date();
    if (input.paymentDate) {
      paymentDate = new Date(`${input.paymentDate}T00:00:00.000Z`);
      if (Number.isNaN(paymentDate.getTime())) {
        paymentDate = new Date();
      }
    }

    const payment = await db.payment.create({
      data: {
        dealId: input.dealId,
        amount: new Prisma.Decimal(amount),
        paymentDate,
        type: (input.type as PrismaPaymentType) || "PARTIAL",
        customType: input.customType || null,
        method: (input.method as PrismaPaymentMethod) || "UPI",
        note: input.note ? input.note.trim() : null,
        reference: input.reference ? input.reference.trim() : null,
      },
      include: {
        deal: {
          select: { leadId: true, clientNameSnapshot: true },
        },
      },
    });

    let undoId: string | undefined;
    try {
      const undo = await recordUndoAction({
        actionType: "PAYMENT_CREATE",
        entityType: "PAYMENT",
        entityId: payment.id,
        leadId: payment.deal?.leadId || null,
        beforeSnapshot: null,
        afterSnapshot: payment,
        description: `Record payment of ₹${payment.amount} for ${payment.deal?.clientNameSnapshot || "Deal"}`,
        userId: session.id as string,
      });
      undoId = undo.id;
    } catch (e) {
      console.error("[Undo] Failed to record undo for add payment:", e);
    }

    await touchCrmSync();

    revalidatePath("/deals");
    revalidatePath("/leads");
    return { success: true, data: serializePayment(payment), undoId };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Edit an existing payment entry.
 */
export async function updateDealPayment(
  paymentId: string,
  input: Partial<RecordPaymentInput>
): Promise<DealActionResult<SerializedPayment>> {
  try {
    const session = await requireAuthenticatedUser();

    if (!paymentId) throw new UserFacingError("Payment ID is required.");

    const existingPayment = await db.payment.findUnique({
      where: { id: paymentId },
      include: {
        deal: {
          select: { leadId: true, clientNameSnapshot: true },
        },
      },
    });
    if (!existingPayment) throw new UserFacingError("Payment not found.");

    const updateData: Prisma.PaymentUpdateInput = {};

    if (input.amount !== undefined) {
      const amount = Number(input.amount);
      if (!amount || amount <= 0) throw new UserFacingError("Payment amount must be greater than 0.");
      updateData.amount = new Prisma.Decimal(amount);
    }

    if (input.paymentDate) {
      const date = new Date(`${input.paymentDate}T00:00:00.000Z`);
      if (!Number.isNaN(date.getTime())) {
        updateData.paymentDate = date;
      }
    }

    if (input.type) {
      updateData.type = input.type as PrismaPaymentType;
    }
    if (input.customType !== undefined) {
      updateData.customType = input.customType || null;
    }
    if (input.method) {
      updateData.method = input.method as PrismaPaymentMethod;
    }
    if (input.note !== undefined) {
      updateData.note = input.note ? input.note.trim() : null;
    }
    if (input.reference !== undefined) {
      updateData.reference = input.reference ? input.reference.trim() : null;
    }

    const updated = await db.payment.update({
      where: { id: paymentId },
      data: updateData,
      include: {
        deal: {
          select: { leadId: true, clientNameSnapshot: true },
        },
      },
    });

    let undoId: string | undefined;
    try {
      const undo = await recordUndoAction({
        actionType: "PAYMENT_UPDATE",
        entityType: "PAYMENT",
        entityId: updated.id,
        leadId: updated.deal?.leadId || null,
        beforeSnapshot: existingPayment,
        afterSnapshot: updated,
        expectedUpdatedAt: existingPayment.updatedAt,
        description: `Update payment of ₹${updated.amount}`,
        userId: session.id as string,
      });
      undoId = undo.id;
    } catch (e) {
      console.error("[Undo] Failed to record undo for update payment:", e);
    }

    await touchCrmSync();

    revalidatePath("/deals");
    revalidatePath("/leads");
    return { success: true, data: serializePayment(updated), undoId };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Safely delete a payment record.
 */
export async function deleteDealPayment(paymentId: string): Promise<DealActionResult<{ deletedId: string }>> {
  try {
    const session = await requireAuthenticatedUser();
    if (!paymentId) throw new UserFacingError("Payment ID is required.");

    const existingPayment = await db.payment.findUnique({
      where: { id: paymentId },
      include: {
        deal: {
          select: { leadId: true, clientNameSnapshot: true },
        },
      },
    });
    if (!existingPayment) throw new UserFacingError("Payment not found.");

    await db.payment.delete({
      where: { id: paymentId },
    });

    let undoId: string | undefined;
    try {
      const undo = await recordUndoAction({
        actionType: "PAYMENT_DELETE",
        entityType: "PAYMENT",
        entityId: existingPayment.id,
        leadId: existingPayment.deal?.leadId || null,
        beforeSnapshot: existingPayment,
        afterSnapshot: null,
        expectedUpdatedAt: existingPayment.updatedAt,
        description: `Delete payment of ₹${existingPayment.amount}`,
        userId: session.id as string,
      });
      undoId = undo.id;
    } catch (e) {
      console.error("[Undo] Failed to record undo for delete payment:", e);
    }

    await touchCrmSync();

    revalidatePath("/deals");
    revalidatePath("/leads");
    return { success: true, data: { deletedId: paymentId }, undoId };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Safely delete an entire deal and all its associated payments.
 */
export async function deleteDeal(dealId: string): Promise<DealActionResult<{ deletedId: string }>> {
  try {
    const session = await requireAuthenticatedUser();
    if (!dealId) throw new UserFacingError("Deal ID is required.");

    const existingDeal = await db.deal.findUnique({
      where: { id: dealId },
      include: { payments: true, lead: { select: { id: true, name: true } } },
    });
    if (!existingDeal) throw new UserFacingError("Deal not found.");

    // Delete associated payments first (or handled via DB cascade)
    await db.payment.deleteMany({ where: { dealId } });
    await db.deal.delete({ where: { id: dealId } });

    let undoId: string | undefined;
    try {
      const undo = await recordUndoAction({
        actionType: "DEAL_DELETE",
        entityType: "DEAL",
        entityId: existingDeal.id,
        leadId: existingDeal.leadId,
        beforeSnapshot: existingDeal,
        afterSnapshot: null,
        expectedUpdatedAt: existingDeal.updatedAt,
        description: `Delete deal for ${existingDeal.lead?.name || existingDeal.clientNameSnapshot || "Client"}`,
        userId: session.id as string,
      });
      undoId = undo.id;
    } catch (e) {
      console.error("[Undo] Failed to record undo for delete deal:", e);
    }

    await touchCrmSync();

    revalidatePath("/deals");
    revalidatePath("/leads");
    return { success: true, data: { deletedId: dealId }, undoId };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Fetch all deals across clients, with payments, lead details, metrics, and filtering/sorting.
 */
export async function getAllDeals(options?: {
  filter?: "all" | "unpaid" | "partially_paid" | "paid" | "overdue";
  sortBy?: "highest_outstanding" | "nearest_due_date" | "latest_deal";
}): Promise<DealActionResult<{ deals: SerializedDeal[]; metrics: DealSummaryMetrics }>> {
  try {
    await requireAuthenticatedUser();

    const rawDeals = await db.deal.findMany({
      include: {
        payments: {
          orderBy: { paymentDate: "desc" },
        },
        lead: {
          select: {
            id: true,
            name: true,
            business: true,
            phone: true,
            email: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const serialized = rawDeals.map(serializeDeal);
    const metrics = calculateDealMetrics(serialized);

    // Apply filtering
    let filtered = serialized;
    const filter = options?.filter || "all";
    if (filter === "unpaid") {
      filtered = filtered.filter((d) => d.paymentStatus === "Unpaid");
    } else if (filter === "partially_paid") {
      filtered = filtered.filter((d) => d.paymentStatus === "Partially Paid");
    } else if (filter === "paid") {
      filtered = filtered.filter((d) => d.paymentStatus === "Paid");
    } else if (filter === "overdue") {
      filtered = filtered.filter((d) => d.paymentStatus === "Overdue");
    }

    // Apply sorting
    const sortBy = options?.sortBy || "latest_deal";
    if (sortBy === "highest_outstanding") {
      filtered.sort((a, b) => b.remainingBalance - a.remainingBalance);
    } else if (sortBy === "nearest_due_date") {
      filtered.sort((a, b) => {
        if (!a.nextPaymentDueDate && !b.nextPaymentDueDate) return 0;
        if (!a.nextPaymentDueDate) return 1;
        if (!b.nextPaymentDueDate) return -1;
        return a.nextPaymentDueDate.localeCompare(b.nextPaymentDueDate);
      });
    } else {
      // latest_deal (default)
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return { success: true, data: { deals: filtered, metrics } };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}
