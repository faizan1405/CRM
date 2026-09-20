"use server";

import { revalidatePath } from "next/cache";

export async function refreshCrmAction(pathname?: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Purge cached RSC payload across the CRM shell layout
    revalidatePath("/", "layout");
    if (pathname && pathname !== "/") {
      revalidatePath(pathname, "page");
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to revalidate CRM data",
    };
  }
}
