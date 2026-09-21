"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { WebsitePackage, WebsiteSample, Prisma } from "@prisma/client";
import { touchCrmSync } from "@/lib/crm-sync";
import { recordUndoAction } from "@/features/undo/services/undo-engine";
import { getSession } from "@/lib/auth";

// --- PACKAGES ---

export async function getWebsitePackages() {
  try {
    const packages = await db.websitePackage.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return { success: true, data: packages };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createWebsitePackage(data: any) {
  try {
    const session = await getSession();
    const pkg = await db.websitePackage.create({
      data: {
        name: data.name,
        price: data.price,
        isStartingPrice: data.isStartingPrice,
        inclusions: data.inclusions,
        hosting: data.hosting,
        domain: data.domain,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
      },
    });

    let undoId: string | undefined;
    try {
      const undo = await recordUndoAction({
        actionType: "PACKAGE_CREATE",
        entityType: "PACKAGE",
        entityId: pkg.id,
        leadId: null,
        beforeSnapshot: null,
        afterSnapshot: pkg,
        description: `Create package "${pkg.name}"`,
        userId: session?.id as string | undefined,
      });
      undoId = undo.id;
    } catch (e) {
      console.error("[Undo] Failed to record undo for createWebsitePackage:", e);
    }

    await touchCrmSync();
    try {
      revalidatePath("/settings");
      revalidatePath("/sales-assets");
      revalidatePath("/", "layout");
    } catch {
      // Safe fallback in test contexts
    }
    return { success: true, data: pkg, undoId };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateWebsitePackage(id: string, data: any) {
  try {
    const session = await getSession();
    const existing = await db.websitePackage.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Package not found" };

    const pkg = await db.websitePackage.update({
      where: { id },
      data,
    });

    let undoId: string | undefined;
    try {
      const undo = await recordUndoAction({
        actionType: "PACKAGE_UPDATE",
        entityType: "PACKAGE",
        entityId: pkg.id,
        leadId: null,
        beforeSnapshot: existing,
        afterSnapshot: pkg,
        expectedUpdatedAt: existing.updatedAt,
        description: `Update package "${pkg.name}"`,
        userId: session?.id as string | undefined,
      });
      undoId = undo.id;
    } catch (e) {
      console.error("[Undo] Failed to record undo for updateWebsitePackage:", e);
    }

    await touchCrmSync();
    try {
      revalidatePath("/settings");
      revalidatePath("/sales-assets");
      revalidatePath("/", "layout");
    } catch {
      // Safe fallback in test contexts
    }
    return { success: true, data: pkg, undoId };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteWebsitePackage(id: string) {
  try {
    const session = await getSession();
    const existing = await db.websitePackage.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Package not found" };

    await db.websitePackage.delete({ where: { id } });

    let undoId: string | undefined;
    try {
      const undo = await recordUndoAction({
        actionType: "PACKAGE_DELETE",
        entityType: "PACKAGE",
        entityId: existing.id,
        leadId: null,
        beforeSnapshot: existing,
        afterSnapshot: null,
        expectedUpdatedAt: existing.updatedAt,
        description: `Delete package "${existing.name}"`,
        userId: session?.id as string | undefined,
      });
      undoId = undo.id;
    } catch (e) {
      console.error("[Undo] Failed to record undo for deleteWebsitePackage:", e);
    }

    await touchCrmSync();
    try {
      revalidatePath("/settings");
      revalidatePath("/sales-assets");
      revalidatePath("/", "layout");
    } catch {
      // Safe fallback in test contexts
    }
    return { success: true, undoId };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}

// --- SAMPLES ---

export async function getWebsiteSamples() {
  try {
    const samples = await db.websiteSample.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return { success: true, data: samples };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createWebsiteSample(data: any) {
  try {
    const session = await getSession();
    const sample = await db.websiteSample.create({
      data: {
        label: data.label,
        url: data.url,
        category: data.category,
        type: data.type,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
      },
    });

    let undoId: string | undefined;
    try {
      const undo = await recordUndoAction({
        actionType: "SAMPLE_CREATE",
        entityType: "SAMPLE",
        entityId: sample.id,
        leadId: null,
        beforeSnapshot: null,
        afterSnapshot: sample,
        description: `Create sample "${sample.label}"`,
        userId: session?.id as string | undefined,
      });
      undoId = undo.id;
    } catch (e) {
      console.error("[Undo] Failed to record undo for createWebsiteSample:", e);
    }

    await touchCrmSync();
    revalidatePath("/sales-assets");
    return { success: true, data: sample, undoId };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateWebsiteSample(id: string, data: any) {
  try {
    const session = await getSession();
    const existing = await db.websiteSample.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Sample not found" };

    const sample = await db.websiteSample.update({
      where: { id },
      data,
    });

    let undoId: string | undefined;
    try {
      const undo = await recordUndoAction({
        actionType: "SAMPLE_UPDATE",
        entityType: "SAMPLE",
        entityId: sample.id,
        leadId: null,
        beforeSnapshot: existing,
        afterSnapshot: sample,
        expectedUpdatedAt: existing.updatedAt,
        description: `Update sample "${sample.label}"`,
        userId: session?.id as string | undefined,
      });
      undoId = undo.id;
    } catch (e) {
      console.error("[Undo] Failed to record undo for updateWebsiteSample:", e);
    }

    await touchCrmSync();
    revalidatePath("/sales-assets");
    return { success: true, data: sample, undoId };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteWebsiteSample(id: string) {
  try {
    const session = await getSession();
    const existing = await db.websiteSample.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Sample not found" };

    await db.websiteSample.delete({ where: { id } });

    let undoId: string | undefined;
    try {
      const undo = await recordUndoAction({
        actionType: "SAMPLE_DELETE",
        entityType: "SAMPLE",
        entityId: existing.id,
        leadId: null,
        beforeSnapshot: existing,
        afterSnapshot: null,
        expectedUpdatedAt: existing.updatedAt,
        description: `Delete sample "${existing.label}"`,
        userId: session?.id as string | undefined,
      });
      undoId = undo.id;
    } catch (e) {
      console.error("[Undo] Failed to record undo for deleteWebsiteSample:", e);
    }

    await touchCrmSync();
    revalidatePath("/sales-assets");
    return { success: true, undoId };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}
