import { Prisma, ActivityType, MetaReceiptStatus, LeadStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizePhone } from "@/features/leads/ai-parser/phone-utils";
import { markLeadAIInsightNeedsRefresh } from "@/features/ai-attention/services/attention-engine";
import { generateSmartNotifications } from "@/features/notifications/services/notification-generator";
import { fetchMetaLeadDetails } from "./meta-graph-client";
import { normalizeMetaLeadPayload } from "./lead-normalizer";
import type {
  MetaLeadRawResponse,
  NormalizedMetaLead,
  MetaLeadProcessingResult,
} from "../types";

function sanitizeRawPayload(raw: MetaLeadRawResponse): Prisma.InputJsonValue {
  return {
    id: raw.id,
    created_time: raw.created_time,
    form_id: raw.form_id ?? null,
    page_id: raw.page_id ?? null,
    ad_id: raw.ad_id ?? null,
    ad_name: raw.ad_name ?? null,
    adset_id: raw.adset_id ?? null,
    campaign_id: raw.campaign_id ?? null,
    campaign_name: raw.campaign_name ?? null,
    field_count: raw.field_data?.length ?? 0,
  } as Prisma.InputJsonValue;
}

async function findExistingLeadForMeta(
  normalized: NormalizedMetaLead
): Promise<{ id: string; name: string; phone: string; email: string | null; business: string | null; notes: string | null } | null> {
  // 1. Primary: Phone match
  if (normalized.phone && normalized.phone !== "Not Provided") {
    const phoneNorm = normalizePhone(normalized.phone);
    if (phoneNorm?.comparisonDigits && phoneNorm.comparisonDigits.length >= 7) {
      const candidates = await db.lead.findMany({
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          business: true,
          notes: true,
        },
        take: 200,
        orderBy: { createdAt: "desc" },
      });

      const targetDigits = phoneNorm.comparisonDigits;
      const matched = candidates.find((cand) => {
        const candNorm = normalizePhone(cand.phone);
        if (!candNorm?.comparisonDigits) return false;
        return (
          candNorm.comparisonDigits === targetDigits ||
          candNorm.comparisonDigits.endsWith(targetDigits) ||
          targetDigits.endsWith(candNorm.comparisonDigits)
        );
      });

      if (matched) return matched;
    }
  }

  // 2. Secondary: Email match
  if (normalized.email && normalized.email.trim()) {
    const matched = await db.lead.findFirst({
      where: {
        email: {
          equals: normalized.email.trim(),
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        business: true,
        notes: true,
      },
    });

    if (matched) return matched;
  }

  return null;
}

export async function processMetaLead(
  metaLeadId: string,
  options?: {
    preloadedRaw?: MetaLeadRawResponse;
    formId?: string;
    pageId?: string;
    adId?: string;
  }
): Promise<MetaLeadProcessingResult> {
  const cleanLeadId = metaLeadId.trim();
  if (!cleanLeadId) {
    return {
      success: false,
      status: "FAILED",
      error: "Meta Lead ID is required.",
    };
  }

  // 1. Idempotency Check
  let receipt = await db.metaLeadReceipt.findUnique({
    where: { metaLeadId: cleanLeadId },
  });

  if (receipt && (receipt.status === "PROCESSED" || receipt.status === "DUPLICATE_UPDATED")) {
    return {
      success: true,
      status: receipt.status as "PROCESSED" | "DUPLICATE_UPDATED",
      leadId: receipt.leadId ?? undefined,
      receiptId: receipt.id,
      isDuplicate: true,
      message: "Lead has already been processed idempotently.",
    };
  }

  if (!receipt) {
    receipt = await db.metaLeadReceipt.create({
      data: {
        metaLeadId: cleanLeadId,
        formId: options?.formId ?? null,
        pageId: options?.pageId ?? null,
        adId: options?.adId ?? null,
        status: MetaReceiptStatus.RECEIVED,
      },
    });
  }

  // 2. Fetch Lead from Graph API (or use preloaded)
  let rawLead: MetaLeadRawResponse;
  try {
    if (options?.preloadedRaw) {
      rawLead = options.preloadedRaw;
    } else {
      rawLead = await fetchMetaLeadDetails(cleanLeadId);
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Failed to fetch lead from Meta Graph API.";
    await db.metaLeadReceipt.update({
      where: { id: receipt.id },
      data: {
        status: MetaReceiptStatus.FAILED,
        errorMessage: errorMsg,
        retryCount: { increment: 1 },
        lastRetryAt: new Date(),
      },
    });

    return {
      success: false,
      status: "FAILED",
      receiptId: receipt.id,
      error: errorMsg,
    };
  }

  // 3. Normalize Lead Payload
  const normalized = normalizeMetaLeadPayload(rawLead);
  const sanitizedMeta = sanitizeRawPayload(rawLead);

  // 4. Check for Existing Lead (Phone primary, Email secondary)
  const existingLead = await findExistingLeadForMeta(normalized);

  try {
    if (existingLead) {
      // Update existing lead with non-destructive merge
      const updateData: {
        email?: string;
        business?: string;
        industry?: string;
        budget?: Prisma.Decimal;
        notes?: string;
      } = {};

      if (!existingLead.email && normalized.email) {
        updateData.email = normalized.email;
      }
      if (!existingLead.business && normalized.business) {
        updateData.business = normalized.business;
      }
      if (normalized.budget !== null) {
        updateData.budget = new Prisma.Decimal(normalized.budget);
      }
      if (normalized.notes) {
        const timestamp = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
        const existingNotes = existingLead.notes || "";
        updateData.notes = existingNotes
          ? `${existingNotes}\n\n--- [Meta Ad Update ${timestamp}] ---\n${normalized.notes}`
          : normalized.notes;
      }

      await db.$transaction(async (tx) => {
        if (Object.keys(updateData).length > 0) {
          await tx.lead.update({
            where: { id: existingLead.id },
            data: updateData,
          });
        }

        await tx.leadActivity.create({
          data: {
            leadId: existingLead.id,
            type: ActivityType.LEAD_UPDATED,
            message: `New Meta Lead Form submission received (Form: ${normalized.formId || "Meta Ad Form"})`,
            metadata: {
              metaLeadId: cleanLeadId,
              formId: normalized.formId,
              pageId: normalized.pageId,
              adId: normalized.adId,
              campaignId: normalized.campaignId,
            },
          },
        });

        await markLeadAIInsightNeedsRefresh(existingLead.id, tx);

        await tx.metaLeadReceipt.update({
          where: { id: receipt.id },
          data: {
            leadId: existingLead.id,
            formId: normalized.formId,
            pageId: normalized.pageId,
            adId: normalized.adId,
            adsetId: normalized.adsetId,
            campaignId: normalized.campaignId,
            status: MetaReceiptStatus.DUPLICATE_UPDATED,
            rawPayload: sanitizedMeta,
            errorMessage: null,
            processedAt: new Date(),
          },
        });
      });

      return {
        success: true,
        status: "DUPLICATE_UPDATED",
        leadId: existingLead.id,
        receiptId: receipt.id,
        isDuplicate: true,
        message: "Existing lead updated with new Meta submission.",
      };
    }

    // 5. Genuinely New Lead Creation
    const result = await db.$transaction(async (tx) => {
      const newLead = await tx.lead.create({
        data: {
          name: normalized.name,
          phone: normalized.phone,
          email: normalized.email,
          business: normalized.business,
          industry: normalized.industry,
          budget: normalized.budget !== null ? new Prisma.Decimal(normalized.budget) : null,
          status: LeadStatus.NEW,
          notes: normalized.notes,
        },
      });

      await tx.leadActivity.create({
        data: {
          leadId: newLead.id,
          type: ActivityType.LEAD_CREATED,
          message: `Lead created from Meta Lead Form submission (Form: ${normalized.formId || "Meta Ad Form"})`,
          metadata: {
            metaLeadId: cleanLeadId,
            formId: normalized.formId,
            pageId: normalized.pageId,
            adId: normalized.adId,
            campaignId: normalized.campaignId,
          },
        },
      });

      await markLeadAIInsightNeedsRefresh(newLead.id, tx);

      await tx.metaLeadReceipt.update({
        where: { id: receipt.id },
        data: {
          leadId: newLead.id,
          formId: normalized.formId,
          pageId: normalized.pageId,
          adId: normalized.adId,
          adsetId: normalized.adsetId,
          campaignId: normalized.campaignId,
          status: MetaReceiptStatus.PROCESSED,
          rawPayload: sanitizedMeta,
          errorMessage: null,
          processedAt: new Date(),
        },
      });

      return newLead;
    });

    // 6. Trigger Smart Notifications asynchronously
    try {
      await generateSmartNotifications();
    } catch {
      // Do not block webhook success if notifications fail
    }

    return {
      success: true,
      status: "PROCESSED",
      leadId: result.id,
      receiptId: receipt.id,
      isDuplicate: false,
      message: "New Meta Lead created successfully.",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to persist Meta lead in database.";
    await db.metaLeadReceipt.update({
      where: { id: receipt.id },
      data: {
        status: MetaReceiptStatus.FAILED,
        errorMessage: errorMsg,
        retryCount: { increment: 1 },
        lastRetryAt: new Date(),
      },
    });

    return {
      success: false,
      status: "FAILED",
      receiptId: receipt.id,
      error: errorMsg,
    };
  }
}
