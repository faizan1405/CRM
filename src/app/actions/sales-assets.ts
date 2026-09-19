"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { WebsitePackage, WebsiteSample, Prisma } from "@prisma/client";

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
    try {
      revalidatePath("/settings");
      revalidatePath("/sales-assets");
      revalidatePath("/", "layout");
    } catch {
      // Safe fallback in test contexts
    }
    return { success: true, data: pkg };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateWebsitePackage(id: string, data: any) {
  try {
    const pkg = await db.websitePackage.update({
      where: { id },
      data,
    });
    try {
      revalidatePath("/settings");
      revalidatePath("/sales-assets");
      revalidatePath("/", "layout");
    } catch {
      // Safe fallback in test contexts
    }
    return { success: true, data: pkg };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteWebsitePackage(id: string) {
  try {
    await db.websitePackage.delete({ where: { id } });
    try {
      revalidatePath("/settings");
      revalidatePath("/sales-assets");
      revalidatePath("/", "layout");
    } catch {
      // Safe fallback in test contexts
    }
    return { success: true };
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
    revalidatePath("/sales-assets");
    return { success: true, data: sample };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateWebsiteSample(id: string, data: any) {
  try {
    const sample = await db.websiteSample.update({
      where: { id },
      data,
    });
    revalidatePath("/sales-assets");
    return { success: true, data: sample };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteWebsiteSample(id: string) {
  try {
    await db.websiteSample.delete({ where: { id } });
    revalidatePath("/sales-assets");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}
