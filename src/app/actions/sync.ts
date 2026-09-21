"use server";

import { getCrmSyncState } from "@/lib/crm-sync";

export interface SyncStatusResult {
  success: boolean;
  serverVersion: string;
  serverTime: string;
  error?: string;
}

export async function getSyncStatusAction(): Promise<SyncStatusResult> {
  try {
    const state = await getCrmSyncState();

    return {
      success: true,
      serverVersion: String(state.version),
      serverTime: typeof state.updatedAt === "string" ? state.updatedAt : new Date(state.updatedAt).toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      serverVersion: "1",
      serverTime: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Failed to fetch sync status",
    };
  }
}

