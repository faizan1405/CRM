import { Prisma, ActivityType, LeadStatus as PrismaLeadStatus, QuickStatus as PrismaQuickStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { statusFromDatabase, type DatabaseLeadStatus } from "@/features/leads/types";
import { markLeadAIInsightNeedsRefresh } from "@/features/ai-attention/services/attention-engine";
import { touchCrmSync } from "@/lib/crm-sync";
import type { RecordUndoParams, PerformUndoResult } from "../types";

export class UndoConcurrencyError extends Error {
  constructor(message = "Unable to undo because this record was changed afterward.") {
    super(message);
    this.name = "UndoConcurrencyError";
  }
}

export class UndoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UndoValidationError";
  }
}

/**
 * Persists an undo action record within the current transaction or standard DB client.
 */
export async function recordUndoAction(
  clientOrParams: Prisma.TransactionClient | typeof db | RecordUndoParams,
  maybeParams?: RecordUndoParams
) {
  const isClient = Boolean(clientOrParams && ("undoAction" in clientOrParams || "$transaction" in clientOrParams));
  const client = (isClient ? clientOrParams : db) as Prisma.TransactionClient | typeof db;
  const params = (isClient ? maybeParams! : clientOrParams) as RecordUndoParams;
  const ttlMinutes = params.ttlMinutes ?? 15;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  const undo = await client.undoAction.create({
    data: {
      actionType: params.actionType,
      entityType: params.entityType,
      entityId: params.entityId,
      leadId: params.leadId ?? null,
      beforeSnapshot: params.beforeSnapshot ? (params.beforeSnapshot as Prisma.InputJsonValue) : Prisma.JsonNull,
      afterSnapshot: params.afterSnapshot ? (params.afterSnapshot as Prisma.InputJsonValue) : Prisma.JsonNull,
      expectedUpdatedAt: params.expectedUpdatedAt ?? null,
      description: params.description,
      createdByUserId: params.createdByUserId ?? params.userId ?? null,
      expiresAt,
    },
  });

  return undo;
}

function safeRevalidate(leadId?: string | null) {
  try {
    revalidatePath("/", "layout");
    revalidatePath("/leads");
    revalidatePath("/pipeline");
    revalidatePath("/dashboard");
    revalidatePath("/analytics");
    revalidatePath("/follow-ups");
    revalidatePath("/recently-deleted");
    revalidatePath("/deals");
    revalidatePath("/personal-notes");
    revalidatePath("/sales-assets");
    revalidatePath("/settings");
    revalidatePath("/whatsapp-templates");
    if (leadId) {
      revalidatePath(`/leads/${leadId}`);
    }
  } catch {
    // Safe outside Next.js request context (e.g. unit tests)
  }
}

/**
 * Executes a persistent undo action with strict concurrency guards, follow-up invariants,
 * financial integrity, and audit logging.
 */
export async function executeUndo(
  undoActionId: string,
  userId?: string | null
): Promise<PerformUndoResult> {
  if (!undoActionId) {
    throw new UndoValidationError("Undo action ID is required.");
  }

  const result = await db.$transaction(async (tx) => {
    const undoRecord = await tx.undoAction.findUnique({
      where: { id: undoActionId },
    });

    if (!undoRecord) {
      throw new UndoValidationError("Undo action not found.");
    }

    if (undoRecord.undoneAt) {
      throw new UndoValidationError("This action has already been undone.");
    }

    if (new Date() > undoRecord.expiresAt) {
      throw new UndoValidationError("This undo action has expired.");
    }

    const { actionType, entityType, entityId, leadId, expectedUpdatedAt } = undoRecord;
    const before = undoRecord.beforeSnapshot as Record<string, unknown>;
    const after = undoRecord.afterSnapshot as Record<string, unknown> | null;

    // ==========================================
    // 1. LEAD MUTATIONS
    // ==========================================
    if (entityType === "LEAD") {
      const currentLead = await tx.lead.findUnique({ where: { id: entityId } });

      if (actionType === "LEAD_CREATE") {
        if (!currentLead) {
          throw new UndoValidationError("Lead not found.");
        }
        // Soft delete the created lead and cancel any attached follow-ups
        await tx.followUp.updateMany({
          where: { leadId: entityId, status: "PENDING" },
          data: { status: "CANCELLED" },
        });
        await tx.lead.update({
          where: { id: entityId },
          data: { deletedAt: new Date() },
        });
        await tx.leadActivity.create({
          data: {
            leadId: entityId,
            type: ActivityType.LEAD_UPDATED,
            message: "Undid lead creation",
            createdByUserId: userId ?? null,
            metadata: { undoActionId },
          },
        });
      } else if (actionType === "LEAD_DELETE") {
        if (!currentLead) {
          throw new UndoValidationError("Lead not found.");
        }
        // Revert soft deletion
        await tx.lead.update({
          where: { id: entityId },
          data: { deletedAt: null },
        });
        await tx.leadActivity.create({
          data: {
            leadId: entityId,
            type: ActivityType.LEAD_UPDATED,
            message: "Undid lead deletion, lead restored",
            createdByUserId: userId ?? null,
            metadata: { undoActionId },
          },
        });
      } else if (actionType === "LEAD_RESTORE") {
        if (!currentLead) {
          throw new UndoValidationError("Lead not found.");
        }
        const previousDeletedAt = before.deletedAt ? new Date(before.deletedAt as string) : new Date();
        await tx.lead.update({
          where: { id: entityId },
          data: { deletedAt: previousDeletedAt },
        });
        await tx.leadActivity.create({
          data: {
            leadId: entityId,
            type: ActivityType.LEAD_UPDATED,
            message: "Undid lead restoration, lead returned to Recently Deleted",
            createdByUserId: userId ?? null,
            metadata: { undoActionId },
          },
        });
      } else if (actionType === "LEAD_WASTE") {
        if (!currentLead) {
          throw new UndoValidationError("Lead not found.");
        }
        // Concurrency guard
        if (expectedUpdatedAt && currentLead.updatedAt.getTime() > new Date(expectedUpdatedAt).getTime() + 1000) {
          if (currentLead.isWaste !== after?.isWaste) {
            throw new UndoConcurrencyError();
          }
        }
        const prevWaste = Boolean(before.isWaste);
        await tx.lead.update({
          where: { id: entityId },
          data: { isWaste: prevWaste },
        });
        await tx.leadActivity.create({
          data: {
            leadId: entityId,
            type: ActivityType.LEAD_UPDATED,
            message: prevWaste ? "Undid restoration, lead returned to Waste" : "Undid marking as Waste, lead restored",
            createdByUserId: userId ?? null,
            metadata: { undoActionId },
          },
        });
      } else if (actionType === "LEAD_PIN") {
        if (!currentLead) {
          throw new UndoValidationError("Lead not found.");
        }
        if (expectedUpdatedAt && currentLead.updatedAt.getTime() > new Date(expectedUpdatedAt).getTime() + 1000) {
          if (currentLead.isPinned !== after?.isPinned) {
            throw new UndoConcurrencyError();
          }
        }
        const prevPinned = Boolean(before.isPinned);
        await tx.lead.update({
          where: { id: entityId },
          data: { isPinned: prevPinned },
        });
      } else if (actionType === "LEAD_STATUS_CHANGE") {
        if (!currentLead) {
          throw new UndoValidationError("Lead not found.");
        }
        // Concurrency Guard: if lead status was changed again afterward, reject safely
        if (after?.status && currentLead.status !== after.status) {
          throw new UndoConcurrencyError();
        }
        if (expectedUpdatedAt && currentLead.updatedAt.getTime() > new Date(expectedUpdatedAt).getTime() + 1000) {
          if (currentLead.status !== after?.status) {
            throw new UndoConcurrencyError();
          }
        }

        const prevStatus = before.status as PrismaLeadStatus;
        const prevQuickStatus = (before.quickStatus as PrismaQuickStatus) ?? PrismaQuickStatus.NONE;

        await tx.lead.update({
          where: { id: entityId },
          data: {
            status: prevStatus,
            quickStatus: prevQuickStatus,
          },
        });

        // If reversing from LOST, delete or clean up the loss event created by that action and restore cancelled follow-up
        if (after?.status === "LOST" || currentLead.status === "LOST") {
          const lossEventId = after?.lossEventId as string | undefined;
          if (lossEventId) {
            await tx.leadLossEvent.deleteMany({ where: { id: lossEventId } });
          } else {
            // Delete the most recent loss event for this lead if matching
            const latestLoss = await tx.leadLossEvent.findFirst({
              where: { leadId: entityId },
              orderBy: { createdAt: "desc" },
            });
            if (latestLoss) {
              await tx.leadLossEvent.delete({ where: { id: latestLoss.id } });
            }
          }

          // Invariant: If reversing back to active status, restore cancelled follow-up if none is pending
          if (prevStatus !== "LOST") {
            const currentPending = await tx.followUp.findFirst({
              where: { leadId: entityId, status: "PENDING" },
            });

            if (!currentPending) {
              let followUpToRestore = null;
              if (before.cancelledFollowUpId) {
                followUpToRestore = await tx.followUp.findUnique({
                  where: { id: before.cancelledFollowUpId as string },
                });
              }
              if (!followUpToRestore) {
                followUpToRestore = await tx.followUp.findFirst({
                  where: { leadId: entityId, status: "CANCELLED" },
                  orderBy: { updatedAt: "desc" },
                });
              }

              if (followUpToRestore && followUpToRestore.status === "CANCELLED") {
                await tx.followUp.update({
                  where: { id: followUpToRestore.id },
                  data: { status: "PENDING" },
                });
                await tx.lead.update({
                  where: { id: entityId },
                  data: { nextFollowUpDate: followUpToRestore.scheduledAt },
                });
                await tx.leadActivity.create({
                  data: {
                    leadId: entityId,
                    type: ActivityType.FOLLOWUP_CREATED,
                    message: `Restored ${followUpToRestore.type} follow-up upon undoing Mark Lost`,
                    metadata: { followUpId: followUpToRestore.id, type: followUpToRestore.type, scheduledAt: followUpToRestore.scheduledAt },
                    createdByUserId: userId ?? null,
                  },
                });
              }
            }
          }
        }

        const prevStatusLabel = statusFromDatabase[prevStatus as DatabaseLeadStatus] ?? prevStatus;
        await tx.leadActivity.create({
          data: {
            leadId: entityId,
            type: ActivityType.STATUS_CHANGED,
            message: `Undid status change, reverted to ${prevStatusLabel}`,
            createdByUserId: userId ?? null,
            metadata: { undoActionId, revertedToStatus: prevStatus },
          },
        });
        await markLeadAIInsightNeedsRefresh(entityId, tx);
      } else if (actionType === "LEAD_UPDATE") {
        if (!currentLead) {
          throw new UndoValidationError("Lead not found.");
        }
        // Concurrency Guard: verify fields changed by this update were not further edited
        if (expectedUpdatedAt && currentLead.updatedAt.getTime() > new Date(expectedUpdatedAt).getTime() + 1000) {
          const changedKeys = (after?.changedKeys as string[]) || [];
          let hasConflict = false;
          for (const k of changedKeys) {
            const currentVal = (currentLead as Record<string, unknown>)[k];
            const afterVal = after ? (after as Record<string, unknown>)[k] : undefined;
            if (afterVal !== undefined && String(currentVal ?? "") !== String(afterVal ?? "")) {
              hasConflict = true;
              break;
            }
          }
          if (hasConflict) {
            throw new UndoConcurrencyError();
          }
        }

        const restoreData: Prisma.LeadUpdateInput = {};
        if ("name" in before) restoreData.name = before.name as string;
        if ("phone" in before) restoreData.phone = before.phone as string;
        if ("email" in before) restoreData.email = (before.email as string) || null;
        if ("business" in before) restoreData.business = (before.business as string) || null;
        if ("industry" in before) restoreData.industry = (before.industry as string) || null;
        if ("leadSource" in before) restoreData.leadSource = (before.leadSource as string) || null;
        if ("budget" in before) restoreData.budget = before.budget !== null ? new Prisma.Decimal(before.budget as string | number) : null;
        if ("quotedAmount" in before) restoreData.quotedAmount = before.quotedAmount !== null ? new Prisma.Decimal(before.quotedAmount as string | number) : null;
        if ("status" in before) restoreData.status = before.status as PrismaLeadStatus;
        if ("notes" in before) restoreData.notes = (before.notes as string) || null;
        if ("lastContactDate" in before) restoreData.lastContactDate = before.lastContactDate ? new Date(before.lastContactDate as string) : null;
        if ("nextFollowUpDate" in before) restoreData.nextFollowUpDate = before.nextFollowUpDate ? new Date(before.nextFollowUpDate as string) : null;

        const updatedLead = await tx.lead.update({
          where: { id: entityId },
          data: restoreData,
        });

        // Sync snapshots to deals if name/business restored
        if (restoreData.name || restoreData.business !== undefined) {
          await tx.deal.updateMany({
            where: { leadId: entityId },
            data: {
              clientNameSnapshot: updatedLead.name,
              companyNameSnapshot: updatedLead.business,
            },
          });
        }

        await tx.leadActivity.create({
          data: {
            leadId: entityId,
            type: ActivityType.LEAD_UPDATED,
            message: "Undid lead details edit, restored previous information",
            createdByUserId: userId ?? null,
            metadata: { undoActionId },
          },
        });
        await markLeadAIInsightNeedsRefresh(entityId, tx);
      }
    }

    // ==========================================
    // 2. FOLLOW-UP MUTATIONS
    // ==========================================
    else if (entityType === "FOLLOWUP") {
      const targetLeadId = leadId || (before.leadId as string);
      const currentFollowUp = await tx.followUp.findUnique({ where: { id: entityId } });

      if (actionType === "FOLLOWUP_CREATE") {
        if (currentFollowUp) {
          // If followUp was modified afterward (e.g. marked complete or rescheduled), guard
          if (expectedUpdatedAt && currentFollowUp.updatedAt.getTime() > new Date(expectedUpdatedAt).getTime() + 1000) {
            if (currentFollowUp.status !== "PENDING") {
              throw new UndoConcurrencyError();
            }
          }
          await tx.followUp.delete({ where: { id: entityId } });
        }

        // If an earlier follow-up was superseded by this creation, restore it back to PENDING!
        const supersededId = before.supersededFollowUpId as string | undefined;
        if (supersededId) {
          await tx.followUp.update({
            where: { id: supersededId },
            data: { status: "PENDING" },
          });
        }

        if (targetLeadId) {
          await tx.leadActivity.create({
            data: {
              leadId: targetLeadId,
              type: ActivityType.FOLLOWUP_CANCELLED,
              message: `Undid creation of ${currentFollowUp?.type || "follow-up"}`,
              createdByUserId: userId ?? null,
              metadata: { undoActionId },
            },
          });
          // Sync nextFollowUpDate on Lead
          const active = await tx.followUp.findFirst({
            where: { leadId: targetLeadId, status: "PENDING" },
            orderBy: { scheduledAt: "asc" },
          });
          await tx.lead.update({
            where: { id: targetLeadId },
            data: { nextFollowUpDate: active ? active.scheduledAt : null },
          });
          await markLeadAIInsightNeedsRefresh(targetLeadId, tx);
        }
      } else if (actionType === "FOLLOWUP_RESCHEDULE") {
        if (!currentFollowUp) {
          throw new UndoValidationError("Follow-up not found.");
        }
        // Concurrency Guard
        if (expectedUpdatedAt && currentFollowUp.updatedAt.getTime() > new Date(expectedUpdatedAt).getTime() + 1000) {
          if (after?.scheduledAt && new Date(currentFollowUp.scheduledAt).getTime() !== new Date(after.scheduledAt as string).getTime()) {
            throw new UndoConcurrencyError();
          }
        }

        const prevScheduledAt = new Date(before.scheduledAt as string);
        const prevType = (before.type as "CALL" | "WHATSAPP" | "EMAIL" | "OTHER") || "CALL";
        const prevNote = before.note !== undefined ? (before.note as string | null) : currentFollowUp.note;

        await tx.followUp.update({
          where: { id: entityId },
          data: {
            scheduledAt: prevScheduledAt,
            type: prevType,
            note: prevNote,
          },
        });

        if (targetLeadId) {
          await tx.leadActivity.create({
            data: {
              leadId: targetLeadId,
              type: ActivityType.FOLLOWUP_RESCHEDULED,
              message: `Undid reschedule, reverted to ${prevScheduledAt.toLocaleDateString()}`,
              createdByUserId: userId ?? null,
              metadata: { undoActionId, scheduledAt: prevScheduledAt },
            },
          });
          const active = await tx.followUp.findFirst({
            where: { leadId: targetLeadId, status: "PENDING" },
            orderBy: { scheduledAt: "asc" },
          });
          await tx.lead.update({
            where: { id: targetLeadId },
            data: { nextFollowUpDate: active ? active.scheduledAt : null },
          });
          await markLeadAIInsightNeedsRefresh(targetLeadId, tx);
        }
      } else if (actionType === "FOLLOWUP_COMPLETE" || actionType === "FOLLOWUP_CANCEL") {
        if (!currentFollowUp) {
          throw new UndoValidationError("Follow-up not found.");
        }
        // Concurrency Guard
        if (expectedUpdatedAt && currentFollowUp.updatedAt.getTime() > new Date(expectedUpdatedAt).getTime() + 1000) {
          if (after?.status && currentFollowUp.status !== after.status) {
            throw new UndoConcurrencyError();
          }
        }

        // STRICT INVARIANT: If this lead already has another active PENDING follow-up,
        // supersede the other or ensure only one active follow-up remains.
        if (targetLeadId) {
          await tx.followUp.updateMany({
            where: {
              leadId: targetLeadId,
              status: "PENDING",
              id: { not: entityId },
            },
            data: { status: "CANCELLED" },
          });
        }

        await tx.followUp.update({
          where: { id: entityId },
          data: {
            status: "PENDING",
            completedAt: null,
          },
        });

        if (targetLeadId) {
          await tx.leadActivity.create({
            data: {
              leadId: targetLeadId,
              type: ActivityType.FOLLOWUP_RESCHEDULED,
              message: actionType === "FOLLOWUP_COMPLETE" ? "Undid follow-up completion, restored to Pending" : "Undid follow-up cancellation, restored to Pending",
              createdByUserId: userId ?? null,
              metadata: { undoActionId },
            },
          });
          await tx.lead.update({
            where: { id: targetLeadId },
            data: { nextFollowUpDate: currentFollowUp.scheduledAt },
          });
          await markLeadAIInsightNeedsRefresh(targetLeadId, tx);
        }
      }
    }

    // ==========================================
    // 3. LEAD ACTIVITY & NOTES MUTATIONS
    // ==========================================
    else if (entityType === "NOTE") {
      const targetLeadId = leadId || (before.leadId as string);

      if (actionType === "NOTE_ADD") {
        const activity = await tx.leadActivity.findUnique({ where: { id: entityId } });
        if (activity) {
          await tx.leadActivity.delete({ where: { id: entityId } });
        }
        // If lead note was set to this message, restore previous lead note if provided
        if (targetLeadId && before.previousLeadNotes !== undefined) {
          await tx.lead.update({
            where: { id: targetLeadId },
            data: { notes: (before.previousLeadNotes as string) || null },
          });
        }
        if (targetLeadId) {
          await markLeadAIInsightNeedsRefresh(targetLeadId, tx);
        }
      } else if (actionType === "NOTE_UPDATE") {
        const activity = await tx.leadActivity.findUnique({ where: { id: entityId } });
        if (!activity) {
          throw new UndoValidationError("Note activity not found.");
        }
        if (after?.message && activity.message !== after.message) {
          throw new UndoConcurrencyError();
        }
        await tx.leadActivity.update({
          where: { id: entityId },
          data: { message: before.message as string },
        });
        if (targetLeadId) {
          await markLeadAIInsightNeedsRefresh(targetLeadId, tx);
        }
      } else if (actionType === "NOTE_DELETE") {
        // Recreate note activity with exact original ID and metadata
        await tx.leadActivity.create({
          data: {
            id: entityId,
            leadId: (before.leadId as string) || targetLeadId!,
            type: ActivityType.NOTE_ADDED,
            message: before.message as string,
            metadata: before.metadata ? (before.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
            createdByUserId: (before.createdByUserId as string) || userId || null,
            createdAt: before.createdAt ? new Date(before.createdAt as string) : new Date(),
          },
        });
        if (targetLeadId) {
          await markLeadAIInsightNeedsRefresh(targetLeadId, tx);
        }
      }
    }

    // ==========================================
    // 4. DEALS & FINANCIAL RECORD MUTATIONS
    // ==========================================
    else if (entityType === "DEAL") {
      if (actionType === "DEAL_UPSERT") {
        const currentDeal = await tx.deal.findUnique({ where: { id: entityId } });
        if (!currentDeal) {
          throw new UndoValidationError("Deal not found.");
        }
        if (expectedUpdatedAt && currentDeal.updatedAt.getTime() > new Date(expectedUpdatedAt).getTime() + 1000) {
          throw new UndoConcurrencyError();
        }

        if (before.isNewlyCreated) {
          // If deal was created and has no payments, delete it; if it has payments, report safely
          const paymentCount = await tx.payment.count({ where: { dealId: entityId } });
          if (paymentCount > 0) {
            throw new UndoValidationError("Cannot undo deal creation because payments have already been recorded.");
          }
          await tx.deal.delete({ where: { id: entityId } });
        } else {
          // Restore previous fields
          await tx.deal.update({
            where: { id: entityId },
            data: {
              projectName: before.projectName !== undefined ? (before.projectName as string | null) : undefined,
              notes: before.notes !== undefined ? (before.notes as string | null) : undefined,
              quotedAmount: before.quotedAmount !== undefined ? (before.quotedAmount !== null ? new Prisma.Decimal(before.quotedAmount as number | string) : null) : undefined,
              finalAmount: before.finalAmount !== undefined ? new Prisma.Decimal(before.finalAmount as number | string) : undefined,
              currency: (before.currency as string) || "INR",
              status: before.status as import("@prisma/client").DealStatus,
              nextPaymentDueDate: before.nextPaymentDueDate ? new Date(before.nextPaymentDueDate as string) : null,
              nextPaymentDueAmount: before.nextPaymentDueAmount !== undefined ? (before.nextPaymentDueAmount !== null ? new Prisma.Decimal(before.nextPaymentDueAmount as number | string) : null) : undefined,
            },
          });
        }
      } else if (actionType === "DEAL_DELETE") {
        // Recreate deal with exact original ID and fields
        const dealData = before.deal as Record<string, unknown>;
        const paymentsData = (before.payments as Array<Record<string, unknown>>) || [];

        await tx.deal.create({
          data: {
            id: entityId,
            source: dealData.source as import("@prisma/client").DealSource,
            leadId: (dealData.leadId as string) || null,
            clientNameSnapshot: (dealData.clientNameSnapshot as string) || null,
            companyNameSnapshot: (dealData.companyNameSnapshot as string) || null,
            clientPhone: (dealData.clientPhone as string) || null,
            clientEmail: (dealData.clientEmail as string) || null,
            projectName: (dealData.projectName as string) || null,
            notes: (dealData.notes as string) || null,
            quotedAmount: dealData.quotedAmount ? new Prisma.Decimal(dealData.quotedAmount as string | number) : null,
            finalAmount: new Prisma.Decimal((dealData.finalAmount as string | number) || 0),
            currency: (dealData.currency as string) || "INR",
            status: dealData.status as import("@prisma/client").DealStatus,
            nextPaymentDueDate: dealData.nextPaymentDueDate ? new Date(dealData.nextPaymentDueDate as string) : null,
            nextPaymentDueAmount: dealData.nextPaymentDueAmount ? new Prisma.Decimal(dealData.nextPaymentDueAmount as string | number) : null,
            createdAt: dealData.createdAt ? new Date(dealData.createdAt as string) : new Date(),
          },
        });

        // Recreate all payments with exact original IDs
        for (const p of paymentsData) {
          await tx.payment.create({
            data: {
              id: p.id as string,
              dealId: entityId,
              amount: new Prisma.Decimal(p.amount as string | number),
              paymentDate: new Date(p.paymentDate as string),
              type: p.type as import("@prisma/client").PaymentType,
              customType: (p.customType as string) || null,
              method: p.method as import("@prisma/client").PaymentMethod,
              note: (p.note as string) || null,
              reference: (p.reference as string) || null,
              createdAt: p.createdAt ? new Date(p.createdAt as string) : new Date(),
            },
          });
        }
      }
    }

    // ==========================================
    // 5. PAYMENT MUTATIONS
    // ==========================================
    else if (entityType === "PAYMENT") {
      if (actionType === "PAYMENT_CREATE") {
        const payment = await tx.payment.findUnique({ where: { id: entityId } });
        if (payment) {
          await tx.payment.delete({ where: { id: entityId } });
        }
      } else if (actionType === "PAYMENT_UPDATE") {
        const payment = await tx.payment.findUnique({ where: { id: entityId } });
        if (!payment) {
          throw new UndoValidationError("Payment record not found.");
        }
        if (expectedUpdatedAt && payment.updatedAt.getTime() > new Date(expectedUpdatedAt).getTime() + 1000) {
          throw new UndoConcurrencyError();
        }

        await tx.payment.update({
          where: { id: entityId },
          data: {
            amount: new Prisma.Decimal(before.amount as number | string),
            paymentDate: new Date(before.paymentDate as string),
            type: before.type as import("@prisma/client").PaymentType,
            customType: (before.customType as string) || null,
            method: before.method as import("@prisma/client").PaymentMethod,
            note: (before.note as string) || null,
            reference: (before.reference as string) || null,
          },
        });
      } else if (actionType === "PAYMENT_DELETE") {
        // Recreate payment with exact original ID and details
        await tx.payment.create({
          data: {
            id: entityId,
            dealId: before.dealId as string,
            amount: new Prisma.Decimal(before.amount as number | string),
            paymentDate: new Date(before.paymentDate as string),
            type: before.type as import("@prisma/client").PaymentType,
            customType: (before.customType as string) || null,
            method: before.method as import("@prisma/client").PaymentMethod,
            note: (before.note as string) || null,
            reference: (before.reference as string) || null,
            createdAt: before.createdAt ? new Date(before.createdAt as string) : new Date(),
          },
        });
      }
    }

    // ==========================================
    // 6. PERSONAL NOTES
    // ==========================================
    else if (entityType === "PERSONAL_NOTE") {
      if (actionType === "PERSONAL_NOTE_CREATE") {
        const note = await tx.personalNote.findUnique({ where: { id: entityId } });
        if (note) {
          await tx.personalNote.delete({ where: { id: entityId } });
        }
      } else if (actionType === "PERSONAL_NOTE_UPDATE" || actionType === "PERSONAL_NOTE_PIN") {
        const note = await tx.personalNote.findUnique({ where: { id: entityId } });
        if (!note) {
          throw new UndoValidationError("Personal note not found.");
        }
        if (expectedUpdatedAt && note.updatedAt.getTime() > new Date(expectedUpdatedAt).getTime() + 1000) {
          throw new UndoConcurrencyError();
        }
        await tx.personalNote.update({
          where: { id: entityId },
          data: {
            title: (before.title as string) || null,
            content: (before.content as string) || note.content,
            isPinned: Boolean(before.isPinned),
          },
        });
      } else if (actionType === "PERSONAL_NOTE_DELETE") {
        await tx.personalNote.create({
          data: {
            id: entityId,
            userId: before.userId as string,
            title: (before.title as string) || null,
            content: before.content as string,
            isPinned: Boolean(before.isPinned),
            createdAt: before.createdAt ? new Date(before.createdAt as string) : new Date(),
          },
        });
      }
    }

    // ==========================================
    // 7. SETTINGS & SALES ASSETS (Packages, Samples, Templates)
    // ==========================================
    else if (entityType === "PACKAGE") {
      if (actionType === "PACKAGE_CREATE") {
        await tx.websitePackage.deleteMany({ where: { id: entityId } });
      } else if (actionType === "PACKAGE_UPDATE") {
        await tx.websitePackage.update({
          where: { id: entityId },
          data: {
            name: before.name as string,
            price: new Prisma.Decimal(before.price as number | string),
            isStartingPrice: Boolean(before.isStartingPrice),
            inclusions: before.inclusions as string,
            hosting: (before.hosting as string) || null,
            domain: (before.domain as string) || null,
            isActive: Boolean(before.isActive),
            sortOrder: Number(before.sortOrder) || 0,
          },
        });
      } else if (actionType === "PACKAGE_DELETE") {
        await tx.websitePackage.create({
          data: {
            id: entityId,
            name: before.name as string,
            price: new Prisma.Decimal(before.price as number | string),
            isStartingPrice: Boolean(before.isStartingPrice),
            inclusions: before.inclusions as string,
            hosting: (before.hosting as string) || null,
            domain: (before.domain as string) || null,
            isActive: Boolean(before.isActive),
            sortOrder: Number(before.sortOrder) || 0,
            createdAt: before.createdAt ? new Date(before.createdAt as string) : new Date(),
          },
        });
      }
    } else if (entityType === "SAMPLE") {
      if (actionType === "SAMPLE_CREATE") {
        await tx.websiteSample.deleteMany({ where: { id: entityId } });
      } else if (actionType === "SAMPLE_UPDATE") {
        await tx.websiteSample.update({
          where: { id: entityId },
          data: {
            label: (before.label as string) || null,
            url: before.url as string,
            category: before.category as string,
            type: before.type as import("@prisma/client").SampleType,
            isActive: Boolean(before.isActive),
            sortOrder: Number(before.sortOrder) || 0,
          },
        });
      } else if (actionType === "SAMPLE_DELETE") {
        await tx.websiteSample.create({
          data: {
            id: entityId,
            label: (before.label as string) || null,
            url: before.url as string,
            category: before.category as string,
            type: before.type as import("@prisma/client").SampleType,
            isActive: Boolean(before.isActive),
            sortOrder: Number(before.sortOrder) || 0,
            createdAt: before.createdAt ? new Date(before.createdAt as string) : new Date(),
          },
        });
      }
    } else if (entityType === "TEMPLATE") {
      if (actionType === "TEMPLATE_CREATE") {
        await tx.whatsAppTemplate.deleteMany({ where: { id: entityId } });
      } else if (actionType === "TEMPLATE_UPDATE" || actionType === "TEMPLATE_TOGGLE") {
        await tx.whatsAppTemplate.update({
          where: { id: entityId },
          data: {
            title: before.title as string,
            category: before.category as import("@prisma/client").WhatsAppTemplateCategory,
            message: before.message as string,
            isActive: Boolean(before.isActive),
          },
        });
      } else if (actionType === "TEMPLATE_DELETE") {
        await tx.whatsAppTemplate.create({
          data: {
            id: entityId,
            title: before.title as string,
            category: before.category as import("@prisma/client").WhatsAppTemplateCategory,
            message: before.message as string,
            isActive: Boolean(before.isActive),
            createdByUserId: (before.createdByUserId as string) || userId || null,
            createdAt: before.createdAt ? new Date(before.createdAt as string) : new Date(),
          },
        });
      }
    }

    // Mark undo action as completed
    await tx.undoAction.update({
      where: { id: undoActionId },
      data: {
        undoneAt: new Date(),
        undoneByUserId: userId ?? null,
      },
    });

    await touchCrmSync(tx);

    return {
      success: true,
      actionType: undoRecord.actionType,
      entityType: undoRecord.entityType,
      entityId: undoRecord.entityId,
      leadId: undoRecord.leadId,
      description: undoRecord.description,
    };
  }, {
    timeout: 30000,
    maxWait: 15000,
  });

  safeRevalidate(result.leadId);
  return result;
}
