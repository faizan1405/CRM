"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { seedDemoLeads, clearDemoLeads } from "@/features/demo-data/demo-seed";
import { touchCrmSync } from "@/lib/crm-sync";

class UserFacingError extends Error {}

async function requireAuthenticatedUser() {
  const session = await getSession();
  if (!session || typeof session.id !== "string") {
    throw new UserFacingError("You must be signed in to manage demo data.");
  }
  return session;
}

export async function populateDemoDataAction(): Promise<{
  success: boolean;
  createdCount?: number;
  error?: string;
}> {
  try {
    const session = await requireAuthenticatedUser();
    const result = await seedDemoLeads(session.id as string);

    await touchCrmSync();

    try {
      revalidatePath("/leads");
      revalidatePath("/pipeline");
      revalidatePath("/dashboard");
      revalidatePath("/analytics");
      revalidatePath("/daily-briefing");
    } catch {
      // Safe fallback
    }

    return { success: true, createdCount: result.createdCount };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to seed demo data.",
    };
  }
}

export async function clearDemoDataAction(): Promise<{
  success: boolean;
  deletedCount?: number;
  error?: string;
}> {
  try {
    await requireAuthenticatedUser();
    const result = await clearDemoLeads();

    await touchCrmSync();

    try {
      revalidatePath("/leads");
      revalidatePath("/pipeline");
      revalidatePath("/dashboard");
      revalidatePath("/analytics");
      revalidatePath("/daily-briefing");
    } catch {
      // Safe fallback
    }

    return { success: true, deletedCount: result.deletedCount };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to clear demo data.",
    };
  }
}
