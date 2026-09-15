"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { META_CONFIG } from "@/lib/meta/config";
import { processMetaLead } from "@/features/meta-leads/services/meta-lead-processor";
import type { MetaConnectionStatus, MetaLeadProcessingResult } from "@/features/meta-leads/types";

class UserFacingError extends Error {}

async function requireAuthenticatedUser() {
  const session = await getSession();
  if (!session || typeof session.id !== "string") {
    throw new UserFacingError("You must be signed in to manage Meta Lead integrations.");
  }
  return session;
}

function cleanError(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred.";
}

export async function getMetaConnectionStatus(): Promise<{
  success: boolean;
  data?: MetaConnectionStatus;
  error?: string;
}> {
  try {
    await requireAuthenticatedUser();

    const [
      totalReceipts,
      processedCount,
      duplicateUpdatedCount,
      failedCount,
      lastSuccess,
      lastFail,
      recentReceipts,
    ] = await Promise.all([
      db.metaLeadReceipt.count(),
      db.metaLeadReceipt.count({ where: { status: "PROCESSED" } }),
      db.metaLeadReceipt.count({ where: { status: "DUPLICATE_UPDATED" } }),
      db.metaLeadReceipt.count({ where: { status: "FAILED" } }),
      db.metaLeadReceipt.findFirst({
        where: { status: { in: ["PROCESSED", "DUPLICATE_UPDATED"] } },
        orderBy: { processedAt: "desc" },
      }),
      db.metaLeadReceipt.findFirst({
        where: { status: "FAILED" },
        orderBy: { receivedAt: "desc" },
      }),
      db.metaLeadReceipt.findMany({
        take: 10,
        orderBy: { receivedAt: "desc" },
        select: {
          id: true,
          metaLeadId: true,
          leadId: true,
          status: true,
          errorMessage: true,
          receivedAt: true,
          processedAt: true,
          retryCount: true,
        },
      }),
    ]);

    const isConfigured = META_CONFIG.isConfigured();
    const missingVariables = META_CONFIG.getMissingConfig();

    const data: MetaConnectionStatus = {
      isConfigured,
      missingVariables,
      graphApiVersion: META_CONFIG.graphApiVersion,
      hasAppSecret: Boolean(META_CONFIG.appSecret),
      hasVerifyToken: Boolean(META_CONFIG.verifyToken),
      hasPageAccessToken: Boolean(META_CONFIG.pageAccessToken),
      totalReceipts,
      processedCount,
      duplicateUpdatedCount,
      failedCount,
      lastSuccessfulLeadAt: lastSuccess?.processedAt?.toISOString() ?? null,
      lastFailure: lastFail
        ? {
            metaLeadId: lastFail.metaLeadId,
            error: lastFail.errorMessage || "Unknown error",
            timestamp: lastFail.receivedAt.toISOString(),
          }
        : null,
      recentReceipts: recentReceipts.map((r) => ({
        id: r.id,
        metaLeadId: r.metaLeadId,
        leadId: r.leadId,
        status: r.status,
        errorMessage: r.errorMessage,
        receivedAt: r.receivedAt.toISOString(),
        processedAt: r.processedAt?.toISOString() ?? null,
        retryCount: r.retryCount,
      })),
    };

    return { success: true, data };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function retryMetaLeadReceipt(
  receiptId: string
): Promise<MetaLeadProcessingResult> {
  try {
    await requireAuthenticatedUser();
    if (!receiptId) {
      throw new UserFacingError("Receipt ID is required.");
    }

    const receipt = await db.metaLeadReceipt.findUnique({
      where: { id: receiptId },
    });

    if (!receipt) {
      throw new UserFacingError("Receipt not found.");
    }

    const result = await processMetaLead(receipt.metaLeadId, {
      formId: receipt.formId ?? undefined,
      pageId: receipt.pageId ?? undefined,
      adId: receipt.adId ?? undefined,
    });

    try {
      revalidatePath("/leads");
      revalidatePath("/pipeline");
      revalidatePath("/settings");
    } catch {
      // Safe fallback
    }

    return result;
  } catch (error) {
    return {
      success: false,
      status: "FAILED",
      error: cleanError(error),
    };
  }
}

export async function ingestManualMetaLead(
  metaLeadId: string
): Promise<MetaLeadProcessingResult> {
  try {
    await requireAuthenticatedUser();
    const cleanId = (metaLeadId || "").trim();
    if (!cleanId) {
      throw new UserFacingError("Meta Lead ID is required.");
    }

    const result = await processMetaLead(cleanId);

    try {
      revalidatePath("/leads");
      revalidatePath("/pipeline");
      revalidatePath("/settings");
    } catch {
      // Safe fallback
    }

    return result;
  } catch (error) {
    return {
      success: false,
      status: "FAILED",
      error: cleanError(error),
    };
  }
}
