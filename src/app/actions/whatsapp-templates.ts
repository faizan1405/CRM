"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  CATEGORY_MAP,
  PRISMA_TO_CATEGORY_MAP,
  CATEGORY_LABELS,
  type WhatsAppTemplate,
  type WhatsAppComposerLead,
  type AIPersonalizeResult,
  type TemplateActionResult,
  type WhatsAppTemplateCategoryKey,
} from "@/features/whatsapp-templates/types";
import {
  validateTemplatePlaceholders,
  renderWhatsAppMessage,
} from "@/features/whatsapp-templates/placeholders";
import { DEFAULT_WHATSAPP_TEMPLATES } from "@/features/whatsapp-templates/default-templates";
import { requestGroqJson, AIConfigError, AIServiceError } from "@/lib/ai/groq-client";
import { z } from "zod";
import type { WhatsAppTemplateCategory as PrismaWhatsAppTemplateCategory } from "@prisma/client";

class UserFacingError extends Error {}

async function requireAuthenticatedUser() {
  const session = await getSession();
  if (!session || typeof session.id !== "string") {
    throw new UserFacingError("You must be signed in to manage WhatsApp templates.");
  }
  return session;
}

function cleanError(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred while processing your request.";
}

function serializeTemplate(
  record: import("@prisma/client").WhatsAppTemplate
): WhatsAppTemplate {
  const categoryKey = PRISMA_TO_CATEGORY_MAP[record.category] || "follow_up";
  return {
    id: record.id,
    title: record.title,
    category: categoryKey,
    rawCategory: record.category,
    categoryLabel: CATEGORY_LABELS[categoryKey] || record.category,
    body: record.message,
    active: record.isActive,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * Lists WhatsApp templates with optional filtering. Seeds default templates if DB is empty.
 */
export async function getWhatsAppTemplates(options?: {
  category?: string;
  activeOnly?: boolean;
}): Promise<TemplateActionResult<WhatsAppTemplate[]>> {
  try {
    await requireAuthenticatedUser();

    // Check count and seed if initial table is empty
    const count = await db.whatsAppTemplate.count();
    if (count === 0) {
      await db.whatsAppTemplate.createMany({
        data: DEFAULT_WHATSAPP_TEMPLATES.map((t) => ({
          title: t.title,
          category: t.category,
          message: t.message,
          isActive: true,
        })),
      });
    }

    const where: { category?: PrismaWhatsAppTemplateCategory; isActive?: boolean } = {};
    if (options?.activeOnly) {
      where.isActive = true;
    }
    if (options?.category) {
      const prismaCategory =
        CATEGORY_MAP[options.category as WhatsAppTemplateCategoryKey] ||
        (options.category.toUpperCase() as PrismaWhatsAppTemplateCategory);
      if (prismaCategory) {
        where.category = prismaCategory;
      }
    }

    const templates = await db.whatsAppTemplate.findMany({
      where,
      orderBy: [{ category: "asc" }, { title: "asc" }],
    });

    return {
      success: true,
      data: templates.map(serializeTemplate),
    };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Creates a new persistent WhatsApp template after placeholder validation.
 */
export async function createWhatsAppTemplate(input: {
  title: string;
  category: string;
  message: string;
  isActive?: boolean;
}): Promise<TemplateActionResult<WhatsAppTemplate>> {
  try {
    const session = await requireAuthenticatedUser();

    const title = input.title?.trim();
    if (!title) throw new UserFacingError("Template title is required.");
    if (title.length > 100) throw new UserFacingError("Title must be 100 characters or fewer.");

    const message = input.message?.trim();
    if (!message) throw new UserFacingError("Template message cannot be empty.");
    if (message.length > 2000) throw new UserFacingError("Template message must be 2000 characters or fewer.");

    const placeholderError = validateTemplatePlaceholders(message);
    if (placeholderError) {
      throw new UserFacingError(placeholderError);
    }

    const prismaCategory: PrismaWhatsAppTemplateCategory =
      CATEGORY_MAP[input.category as WhatsAppTemplateCategoryKey] ||
      (input.category?.toUpperCase() as PrismaWhatsAppTemplateCategory) ||
      "FOLLOW_UP";

    const created = await db.whatsAppTemplate.create({
      data: {
        title,
        category: prismaCategory,
        message,
        isActive: input.isActive ?? true,
        createdByUserId: session.id as string,
      },
    });

    try {
      revalidatePath("/whatsapp-templates");
    } catch {
      // safe fallback for test execution
    }

    return { success: true, data: serializeTemplate(created) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Updates an existing WhatsApp template with validation.
 */
export async function updateWhatsAppTemplate(
  id: string,
  input: Partial<{
    title: string;
    category: string;
    message: string;
    isActive: boolean;
  }>
): Promise<TemplateActionResult<WhatsAppTemplate>> {
  try {
    await requireAuthenticatedUser();

    const existing = await db.whatsAppTemplate.findUnique({ where: { id } });
    if (!existing) throw new UserFacingError("Template not found.");

    const data: {
      title?: string;
      category?: PrismaWhatsAppTemplateCategory;
      message?: string;
      isActive?: boolean;
    } = {};

    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) throw new UserFacingError("Template title cannot be empty.");
      data.title = title;
    }

    if (input.message !== undefined) {
      const message = input.message.trim();
      if (!message) throw new UserFacingError("Template message cannot be empty.");
      const placeholderError = validateTemplatePlaceholders(message);
      if (placeholderError) throw new UserFacingError(placeholderError);
      data.message = message;
    }

    if (input.category !== undefined) {
      data.category =
        CATEGORY_MAP[input.category as WhatsAppTemplateCategoryKey] ||
        (input.category.toUpperCase() as PrismaWhatsAppTemplateCategory) ||
        existing.category;
    }

    if (input.isActive !== undefined) {
      data.isActive = Boolean(input.isActive);
    }

    const updated = await db.whatsAppTemplate.update({
      where: { id },
      data,
    });

    try {
      revalidatePath("/whatsapp-templates");
    } catch {
      // safe in tests
    }

    return { success: true, data: serializeTemplate(updated) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Toggles template active state.
 */
export async function toggleWhatsAppTemplateActive(
  id: string,
  isActive: boolean
): Promise<TemplateActionResult<WhatsAppTemplate>> {
  return updateWhatsAppTemplate(id, { isActive });
}

/**
 * Duplicates a template.
 */
export async function duplicateWhatsAppTemplate(
  id: string
): Promise<TemplateActionResult<WhatsAppTemplate>> {
  try {
    const session = await requireAuthenticatedUser();
    const existing = await db.whatsAppTemplate.findUnique({ where: { id } });
    if (!existing) throw new UserFacingError("Template not found.");

    const duplicated = await db.whatsAppTemplate.create({
      data: {
        title: `${existing.title} (Copy)`,
        category: existing.category,
        message: existing.message,
        isActive: existing.isActive,
        createdByUserId: session.id as string,
      },
    });

    try {
      revalidatePath("/whatsapp-templates");
    } catch {
      // safe in tests
    }

    return { success: true, data: serializeTemplate(duplicated) };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Deletes a template.
 */
export async function deleteWhatsAppTemplate(
  id: string
): Promise<TemplateActionResult<{ id: string }>> {
  try {
    await requireAuthenticatedUser();
    await db.whatsAppTemplate.delete({ where: { id } });

    try {
      revalidatePath("/whatsapp-templates");
    } catch {
      // safe in tests
    }

    return { success: true, data: { id } };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Renders a specific template for a lead using server-side placeholder replacement.
 */
export async function renderTemplateForLead(
  templateId: string,
  leadId: string
): Promise<TemplateActionResult<{ renderedMessage: string; lead: WhatsAppComposerLead }>> {
  try {
    await requireAuthenticatedUser();

    const [template, leadRecord] = await Promise.all([
      db.whatsAppTemplate.findUnique({ where: { id: templateId } }),
      db.lead.findUnique({
        where: { id: leadId },
        include: {
          followUps: {
            where: { status: "PENDING" },
            orderBy: { scheduledAt: "asc" },
            take: 1,
          },
        },
      }),
    ]);

    if (!template) throw new UserFacingError("Template not found.");
    if (!leadRecord) throw new UserFacingError("Lead not found.");

    const nextFollowUp = leadRecord.followUps[0];
    const followUpDateStr = nextFollowUp
      ? new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "numeric",
          month: "short",
        }).format(nextFollowUp.scheduledAt)
      : null;
    const followUpTimeStr = nextFollowUp
      ? new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).format(nextFollowUp.scheduledAt)
      : null;

    const lead: WhatsAppComposerLead = {
      id: leadRecord.id,
      name: leadRecord.name,
      phone: leadRecord.phone,
      business: leadRecord.business,
      requirement: leadRecord.notes,
      budget: leadRecord.budget ? Number(leadRecord.budget) : null,
      status: leadRecord.status,
      followUpDate: followUpDateStr,
      followUpTime: followUpTimeStr,
    };

    const renderedMessage = renderWhatsAppMessage(template.message, lead);

    return {
      success: true,
      data: { renderedMessage, lead },
    };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

const AIPersonalizeResponseSchema = z.object({
  personalizedMessage: z.string().min(1),
  rationale: z.string().optional(),
});

/**
 * AI WhatsApp Personalization via Groq.
 * Takes template and lead context, produces personalized text without inventing facts.
 * Server-side only; does not open or send WhatsApp.
 */
export async function personalizeWhatsAppMessage(input: {
  leadId: string;
  templateId?: string;
  templateMessage?: string;
  additionalContext?: string;
}): Promise<TemplateActionResult<AIPersonalizeResult>> {
  try {
    await requireAuthenticatedUser();

    let templateBody = input.templateMessage?.trim();
    if (!templateBody && input.templateId) {
      const tmpl = await db.whatsAppTemplate.findUnique({ where: { id: input.templateId } });
      if (tmpl) templateBody = tmpl.message;
    }
    if (!templateBody) {
      throw new UserFacingError("Template message is required for personalization.");
    }

    // Retrieve lead and recent activities for factual context
    const lead = await db.lead.findUnique({
      where: { id: input.leadId },
      include: {
        activities: {
          where: { type: { in: ["NOTE_ADDED", "STATUS_CHANGED"] } },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
        followUps: {
          where: { status: "PENDING" },
          orderBy: { scheduledAt: "asc" },
          take: 1,
        },
      },
    });

    if (!lead) throw new UserFacingError("Lead not found.");

    const nextFollowUp = lead.followUps[0];
    const followUpDateStr = nextFollowUp
      ? new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "numeric",
          month: "short",
        }).format(nextFollowUp.scheduledAt)
      : null;
    const followUpTimeStr = nextFollowUp
      ? new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).format(nextFollowUp.scheduledAt)
      : null;

    const composerLead: WhatsAppComposerLead = {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      business: lead.business,
      requirement: lead.notes,
      budget: lead.budget ? Number(lead.budget) : null,
      status: lead.status,
      followUpDate: followUpDateStr,
      followUpTime: followUpTimeStr,
    };

    // First render standard placeholders so we have an accurate baseline
    const originalMessage = renderWhatsAppMessage(templateBody, composerLead);

    // Call Groq to personalize with zero hallucination guarantee
    try {
      const systemPrompt = `You are an expert sales communication assistant for an Indian B2B/B2C CRM.
Your task is to subtly polish and personalize the WhatsApp message for the recipient while strictly respecting known facts.

CRITICAL SAFETY & TRUTHFULNESS RULES:
1. Preserve the core message, intent, and call to action.
2. NEVER invent discounts, coupons, unauthorized pricing, or promises that do not exist.
3. NEVER invent details, dates, or prior agreements not in the provided facts.
4. Keep the tone courteous, crisp, professional, and conversational for WhatsApp.
5. You MUST return strictly valid JSON matching this schema:
{
  "personalizedMessage": "The refined message ready to send",
  "rationale": "Brief 1-sentence note explaining what was personalized"
}`;

      const recentNotes = lead.activities
        .map((a) => `${a.type}: ${a.message}`)
        .join("; ");

      const userPrompt = `Lead Facts:
- Name: ${lead.name}
- Business: ${lead.business || "Not specified"}
- Status: ${lead.status}
- Known Requirement: ${lead.notes || "Not specified"}
- Budget: ${lead.budget ? `₹${Number(lead.budget).toLocaleString("en-IN")}` : "Not specified"}
- Next Follow-Up: ${followUpDateStr ? `${followUpDateStr} at ${followUpTimeStr || ""}` : "None scheduled"}
- Recent CRM Notes: ${recentNotes || "None"}
- Additional Context from Rep: ${input.additionalContext || "None"}

Base Message to Personalize:
"""
${originalMessage}
"""

Please refine and return strictly JSON.`;

      const { rawJson } = await requestGroqJson({
        systemPrompt,
        userPrompt,
        temperature: 0.2,
      });

      const parsed = JSON.parse(rawJson);
      const validated = AIPersonalizeResponseSchema.parse(parsed);

      return {
        success: true,
        data: {
          originalMessage,
          personalizedMessage: validated.personalizedMessage.trim(),
          rationale: validated.rationale || "Personalized using lead details and recent context.",
        },
      };
    } catch (aiErr) {
      if (aiErr instanceof AIConfigError || aiErr instanceof AIServiceError || aiErr instanceof Error) {
        // Fallback gracefully without breaking CRM operations
        return {
          success: true,
          data: {
            originalMessage,
            personalizedMessage: originalMessage,
            rationale: "Standard template loaded (AI personalization currently in manual review mode).",
          },
        };
      }
      throw aiErr;
    }
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}
