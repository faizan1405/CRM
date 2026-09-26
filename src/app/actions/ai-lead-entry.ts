"use server";

import { revalidatePath } from "next/cache";
import { Prisma, ActivityType, LeadStatus as PrismaLeadStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseUnstructuredLeadText } from "@/features/leads/ai-parser/lead-parser";
import { parseBulkUnstructuredLeadText } from "@/features/leads/ai-parser/bulk-lead-parser";
import {
  findPossibleDuplicateLead,
  analyzeBulkLeadDuplicates,
} from "@/features/leads/ai-parser/duplicate-detector";
import { parseKolkataDateTime, isValidDateStr } from "@/features/leads/ai-parser/date-utils";
import type {
  StructuredLeadDraft,
  StructureLeadResponse,
  BulkStructureLeadResponse,
  BulkCreateLeadItem,
  BulkCreateResponse,
  BulkCreateItemResult,
} from "@/features/leads/ai-parser/types";
import {
  statusFromDatabase,
  statusToDatabase,
  type DatabaseLeadStatus,
  type Lead,
  type LeadActionResult,
  type LeadStatus,
} from "@/features/leads/types";
import { AIConfigError, AIServiceError } from "@/lib/ai/groq-client";
import { markLeadAIInsightNeedsRefresh } from "@/features/ai-attention/services/attention-engine";
import { touchCrmSync } from "@/lib/crm-sync";

class UserFacingError extends Error {}

async function requireAuthenticatedUser() {
  const session = await getSession();
  if (!session || typeof session.id !== "string") {
    throw new UserFacingError("You must be signed in to use AI lead entry.");
  }
  return session;
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

/**
 * Parses single unstructured lead text into a StructuredLeadDraft with duplicate candidate analysis.
 */
export async function structureLeadAction(
  unstructuredText: string
): Promise<StructureLeadResponse> {
  try {
    await requireAuthenticatedUser();

    const input = (unstructuredText || "").trim();
    if (!input) {
      return { success: false, error: "Please enter or paste lead details to structure." };
    }

    const draft = await parseUnstructuredLeadText(input);
    const possibleDuplicate = await findPossibleDuplicateLead(draft);

    return {
      success: true,
      data: {
        draft,
        possibleDuplicate,
      },
    };
  } catch (error: unknown) {
    if (error instanceof AIConfigError) {
      return {
        success: false,
        error: error.message,
      };
    }

    if (error instanceof AIServiceError || error instanceof UserFacingError) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "AI couldn't structure this lead. You can retry or use Manual Entry.",
    };
  }
}

/**
 * Phase 11: Parses bulk unstructured lead text (up to 50 leads) into an array of structured drafts with duplicate analysis.
 */
export async function structureBulkLeadAction(
  unstructuredText: string
): Promise<BulkStructureLeadResponse> {
  try {
    await requireAuthenticatedUser();

    const input = (unstructuredText || "").trim();
    if (!input) {
      return { success: false, error: "Please enter or paste lead details to structure." };
    }

    const drafts = await parseBulkUnstructuredLeadText(input);
    const reviewDto = await analyzeBulkLeadDuplicates(drafts);

    return {
      success: true,
      data: reviewDto,
    };
  } catch (error: unknown) {
    if (error instanceof AIConfigError) {
      return {
        success: false,
        error: error.message,
      };
    }

    if (error instanceof AIServiceError || error instanceof UserFacingError) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "AI couldn't structure these leads. You can retry or use Manual Entry.",
    };
  }
}

/**
 * Updates an existing lead record with structured draft information.
 */
export async function updateExistingLeadWithDraftAction(
  leadId: string,
  draft: StructuredLeadDraft
): Promise<LeadActionResult<Lead>> {
  try {
    const session = await requireAuthenticatedUser();

    const lead = await db.$transaction(async (tx) => {
      const oldLead = await tx.lead.findUnique({ where: { id: leadId } });
      if (!oldLead) {
        throw new UserFacingError("The existing lead was not found.");
      }

      const updateData: Prisma.LeadUpdateInput = {};
      const changed: string[] = [];

      if (draft.name && draft.name.trim() && draft.name.trim() !== oldLead.name) {
        updateData.name = draft.name.trim();
        changed.push("name");
      }

      if (draft.phone && draft.phone.trim() && draft.phone.trim() !== oldLead.phone) {
        updateData.phone = draft.phone.trim();
        changed.push("phone");
      }

      if (draft.email && draft.email.trim() && draft.email.trim() !== oldLead.email) {
        updateData.email = draft.email.trim();
        changed.push("email");
      }

      if (draft.business && draft.business.trim() && draft.business.trim() !== oldLead.business) {
        updateData.business = draft.business.trim();
        changed.push("business");
      }

      if (
        draft.industryOrRequirement &&
        draft.industryOrRequirement.trim() &&
        draft.industryOrRequirement.trim() !== oldLead.industry
      ) {
        updateData.industry = draft.industryOrRequirement.trim();
        changed.push("industry");
      }

      if (draft.budget !== null && draft.budget !== undefined) {
        const decBudget = new Prisma.Decimal(draft.budget);
        if (oldLead.budget?.toString() !== decBudget.toString()) {
          updateData.budget = decBudget;
          changed.push("budget");
        }
      }

      if (draft.status) {
        const dbStatus = statusToDatabase[draft.status as LeadStatus];
        if (dbStatus && dbStatus !== oldLead.status) {
          updateData.status = dbStatus as PrismaLeadStatus;
          changed.push("status");
        }
      }

      if (draft.notes && draft.notes.trim()) {
        const newNotes = draft.notes.trim();
        if (!oldLead.notes) {
          updateData.notes = newNotes;
          changed.push("notes");
        } else if (!oldLead.notes.includes(newNotes)) {
          updateData.notes = `${oldLead.notes}\n\n[Updated]: ${newNotes}`;
          changed.push("notes");
        }
      }

      if (draft.suggestedFollowUpDate && isValidDateStr(draft.suggestedFollowUpDate)) {
        const followUpDateObj = new Date(`${draft.suggestedFollowUpDate}T00:00:00.000Z`);
        updateData.nextFollowUpDate = followUpDateObj;
        changed.push("next follow-up date");

        const scheduledAt =
          parseKolkataDateTime(draft.suggestedFollowUpDate, draft.suggestedFollowUpTime || "10:00") ??
          followUpDateObj;

        await tx.followUp.create({
          data: {
            leadId: oldLead.id,
            scheduledAt,
            type: "CALL",
            note: draft.notes
              ? `Follow-up from AI update: ${draft.notes.slice(0, 500)}`
              : "Follow-up scheduled from lead update",
            status: "PENDING",
          },
        });

        await tx.leadActivity.create({
          data: {
            leadId: oldLead.id,
            type: ActivityType.FOLLOWUP_CREATED,
            message: `Scheduled a CALL follow-up for ${scheduledAt.toLocaleDateString()}`,
            metadata: { type: "CALL", scheduledAt },
            createdByUserId: session.id as string,
          },
        });
      }

      const updatedLead =
        changed.length > 0 ? await tx.lead.update({ where: { id: leadId }, data: updateData }) : oldLead;

      if (changed.length > 0) {
        await tx.leadActivity.create({
          data: {
            leadId,
            type: ActivityType.LEAD_UPDATED,
            message: `Lead was updated from AI entry: changed ${changed.join(", ")}`,
            createdByUserId: session.id as string,
          },
        });
      }

      await touchCrmSync(tx);

      return updatedLead;
    });

    try {
      revalidatePath("/leads");
      revalidatePath("/pipeline");
      revalidatePath("/dashboard");
    } catch {
      // safe fallback in test runner
    }

    return { success: true, data: serializeLead(lead) };
  } catch (error: unknown) {
    if (error instanceof UserFacingError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Could not update the existing lead. Please try again." };
  }
}

/**
 * Phase 11: Bulk Create Action
 * Creates and/or updates multiple reviewed lead drafts.
 * Supports partial failure: one invalid item does not fail the entire batch.
 */
export async function createBulkLeadsAction(
  items: BulkCreateLeadItem[]
): Promise<BulkCreateResponse> {
  try {
    const session = await requireAuthenticatedUser();

    if (!Array.isArray(items) || items.length === 0) {
      return {
        success: false,
        results: [],
        summary: { total: 0, created: 0, updated: 0, skipped: 0, failed: 0 },
        error: "No lead items provided to create.",
      };
    }

    if (items.length > 50) {
      return {
        success: false,
        results: [],
        summary: { total: items.length, created: 0, updated: 0, skipped: 0, failed: items.length },
        error: "Maximum 50 leads allowed per batch creation.",
      };
    }

    const results: BulkCreateItemResult[] = [];
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const draft = item.draft;
      const action = item.action || "CREATE";

      if (action === "SKIP") {
        results.push({
          index: i,
          name: draft?.name || null,
          phone: draft?.phone || null,
          outcome: "skipped",
          message: "Item skipped by user",
        });
        skippedCount++;
        continue;
      }

      if (action === "UPDATE_EXISTING" && item.targetLeadId) {
        try {
          const updateRes = await updateExistingLeadWithDraftAction(item.targetLeadId, draft);
          if (updateRes.success) {
            results.push({
              index: i,
              leadId: updateRes.data.id,
              name: updateRes.data.name,
              phone: updateRes.data.phone,
              outcome: "updated",
              message: "Existing lead updated",
            });
            updatedCount++;
          } else {
            results.push({
              index: i,
              outcome: "failed",
              error: updateRes.error,
            });
            failedCount++;
          }
        } catch (err) {
          results.push({
            index: i,
            outcome: "failed",
            error: err instanceof Error ? err.message : "Failed to update existing lead",
          });
          failedCount++;
        }
        continue;
      }

      // Default: CREATE new lead
      try {
        const leadName = (draft.name && draft.name.trim()) || draft.phone || "Unnamed Lead";
        const leadPhone = (draft.phone && draft.phone.trim()) || "Not Provided";

        if (!draft.name && !draft.phone) {
          results.push({
            index: i,
            outcome: "failed",
            error: "Lead must contain at least a name or a phone number.",
          });
          failedCount++;
          continue;
        }

        const dbStatus = draft.status ? (statusToDatabase[draft.status as LeadStatus] as PrismaLeadStatus) : PrismaLeadStatus.NEW;

        const newLead = await db.$transaction(async (tx) => {
          let nextFollowUpDateObj: Date | null = null;
          if (draft.suggestedFollowUpDate && isValidDateStr(draft.suggestedFollowUpDate)) {
            nextFollowUpDateObj = new Date(`${draft.suggestedFollowUpDate}T00:00:00.000Z`);
          }

          const created = await tx.lead.create({
            data: {
              name: leadName,
              phone: leadPhone,
              email: draft.email?.trim() || null,
              business: draft.business?.trim() || null,
              industry: draft.industryOrRequirement?.trim() || null,
              budget: draft.budget !== null && draft.budget !== undefined ? new Prisma.Decimal(draft.budget) : null,
              status: dbStatus,
              quotedAmount: null,
              lastContactDate: null,
              nextFollowUpDate: nextFollowUpDateObj,
              notes: item.customNotes?.trim() || draft.notes?.trim() || null,
            },
          });

          // Individual LEAD_CREATED activity for this lead
          await tx.leadActivity.create({
            data: {
              leadId: created.id,
              type: ActivityType.LEAD_CREATED,
              message: "Lead was created via Bulk AI Entry",
              createdByUserId: session.id as string,
            },
          });

          // Schedule follow-up if date is present
          if (nextFollowUpDateObj) {
            const scheduledAt =
              parseKolkataDateTime(draft.suggestedFollowUpDate!, draft.suggestedFollowUpTime || "10:00") ??
              nextFollowUpDateObj;

            await tx.followUp.create({
              data: {
                leadId: created.id,
                scheduledAt,
                type: "CALL",
                note: draft.notes ? `Bulk AI follow-up: ${draft.notes.slice(0, 500)}` : "Follow-up scheduled from Bulk Lead Entry",
                status: "PENDING",
              },
            });

            await tx.leadActivity.create({
              data: {
                leadId: created.id,
                type: ActivityType.FOLLOWUP_CREATED,
                message: `Scheduled a CALL follow-up for ${scheduledAt.toLocaleDateString()}`,
                metadata: { type: "CALL", scheduledAt },
                createdByUserId: session.id as string,
              },
            });
          }

          await markLeadAIInsightNeedsRefresh(created.id, tx);

          return created;
        });

        results.push({
          index: i,
          leadId: newLead.id,
          name: newLead.name,
          phone: newLead.phone,
          outcome: "created",
          message: "Lead created successfully",
        });
        createdCount++;
      } catch (err) {
        results.push({
          index: i,
          outcome: "failed",
          error: err instanceof Error ? err.message : "Failed to create lead",
        });
        failedCount++;
      }
    }

    if (createdCount > 0 || updatedCount > 0) {
      await touchCrmSync();
    }

    try {
      revalidatePath("/leads");
      revalidatePath("/pipeline");
      revalidatePath("/dashboard");
    } catch {
      // safe fallback in test runner
    }

    return {
      success: true,
      results,
      summary: {
        total: items.length,
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        failed: failedCount,
      },
    };
  } catch (error: unknown) {
    if (error instanceof UserFacingError) {
      return {
        success: false,
        results: [],
        summary: { total: items.length, created: 0, updated: 0, skipped: 0, failed: items.length },
        error: error.message,
      };
    }
    return {
      success: false,
      results: [],
      summary: { total: items.length, created: 0, updated: 0, skipped: 0, failed: items.length },
      error: "An unexpected error occurred while creating bulk leads.",
    };
  }
}

/**
 * Alias for createBulkLeadsAction to match standard naming.
 */
export const createBulkLeads = createBulkLeadsAction;
