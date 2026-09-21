"use server";

import { revalidatePath } from "next/cache";
import { getSyncStatusAction } from "./sync";

export async function refreshCrmAction(pathname?: string): Promise<{ success: boolean; serverVersion?: string; serverTime?: string; error?: string }> {
  try {
    // Purge cached RSC payload across the CRM shell layout
    revalidatePath("/", "layout");
    if (pathname && pathname !== "/") {
      revalidatePath(pathname, "page");
    }
    const syncRes = await getSyncStatusAction();
    return {
      success: true,
      serverVersion: syncRes.serverVersion,
      serverTime: syncRes.serverTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to revalidate CRM data",
    };
  }
}
