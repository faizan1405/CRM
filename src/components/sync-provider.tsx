"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSyncStatusAction } from "@/app/actions/sync";
import { refreshCrmAction } from "@/app/actions/refresh";

export type SyncState = "syncing" | "synced" | "offline" | "error" | "updates_available";

export interface SyncContextValue {
  syncState: SyncState;
  lastSyncTime: Date | null;
  serverVersion: string | null;
  pendingUpdates: boolean;
  hasUnsavedDrafts: boolean;
  triggerSync: (options?: { forceRefresh?: boolean; manual?: boolean }) => Promise<boolean>;
  applyPendingUpdates: () => Promise<void>;
  registerDraft: (id: string, isDirty: boolean) => void;
  unregisterDraft: (id: string) => void;
  notifyDataMutated: () => void;
}

export const SyncContext = createContext<SyncContextValue | null>(null);

export const CrmSyncProvider = SyncProvider;

const SYNC_CHANNEL_NAME = "scale_flow_crm_sync_channel";
const POLLING_INTERVAL_MS = 3000;

export interface SyncProviderProps {
  children: React.ReactNode;
  initialSyncState?: SyncState;
  initialLastSyncTime?: Date | null;
  initialServerVersion?: string | null;
  autoSync?: boolean;
}

function isUserActivelyTyping(): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement;
  if (!active) return false;

  const tagName = active.tagName.toLowerCase();
  if (tagName === "textarea") {
    const val = (active as HTMLTextAreaElement).value;
    return Boolean(val && val.length > 0);
  }

  if (tagName === "input") {
    const inputEl = active as HTMLInputElement;
    const type = inputEl.type.toLowerCase();
    if (["text", "search", "tel", "email", "url", "number", "password"].includes(type)) {
      const val = inputEl.value;
      return Boolean(val && val.length > 0);
    }
  }

  return false;
}

export function SyncProvider({
  children,
  initialSyncState = "syncing",
  initialLastSyncTime = null,
  initialServerVersion = null,
  autoSync = true,
}: SyncProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const [syncState, setSyncState] = useState<SyncState>(initialSyncState);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(initialLastSyncTime);
  const [serverVersion, setServerVersion] = useState<string | null>(initialServerVersion);
  const [pendingUpdates, setPendingUpdates] = useState<boolean>(false);

  // Draft tracking map: id -> isDirty
  const draftsRef = useRef<Map<string, boolean>>(new Map());
  const [hasUnsavedDrafts, setHasUnsavedDrafts] = useState<boolean>(false);

  const serverVersionRef = useRef<string | null>(null);
  serverVersionRef.current = serverVersion;

  const isSyncingRef = useRef<boolean>(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  const updateDraftsState = useCallback(() => {
    let dirty = false;
    for (const isDirty of draftsRef.current.values()) {
      if (isDirty) {
        dirty = true;
        break;
      }
    }
    setHasUnsavedDrafts(dirty);
  }, []);

  const registerDraft = useCallback((id: string, isDirty: boolean) => {
    draftsRef.current.set(id, isDirty);
    updateDraftsState();
  }, [updateDraftsState]);

  const unregisterDraft = useCallback((id: string) => {
    draftsRef.current.delete(id);
    updateDraftsState();
  }, [updateDraftsState]);

  const checkHasDirtyDrafts = useCallback((): boolean => {
    for (const isDirty of draftsRef.current.values()) {
      if (isDirty) return true;
    }
    if (isUserActivelyTyping()) return true;
    return false;
  }, []);

  // Perform a sync check or full refresh
  const triggerSync = useCallback(
    async (options?: { forceRefresh?: boolean; manual?: boolean }): Promise<boolean> => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setSyncState("offline");
        return false;
      }

      if (isSyncingRef.current && !options?.forceRefresh) {
        return false;
      }

      isSyncingRef.current = true;
      setSyncState("syncing");

      try {
        if (options?.forceRefresh) {
          // Manual or forced refresh: revalidate server cache and refresh router
          const res = await refreshCrmAction(pathname);
          if (!res.success) throw new Error(res.error || "Failed to refresh CRM");

          const syncTime = res.serverTime ? new Date(res.serverTime) : new Date();
          const newVersion = res.serverVersion || "v0";

          await new Promise<void>((resolve) => {
            startTransition(() => {
              router.refresh();
              resolve();
            });
          });

          setServerVersion(newVersion);
          setLastSyncTime(syncTime);
          setPendingUpdates(false);
          setSyncState("synced");

          // Notify other tabs
          try {
            broadcastChannelRef.current?.postMessage({
              type: "SYNC_SUCCESS",
              serverVersion: newVersion,
              serverTime: syncTime.toISOString(),
            });
          } catch {
            // Ignore broadcast failure
          }
          return true;
        }

        // Standard background sync query via lightweight API endpoint with fallback to server action
        let newVersion: string;
        let syncTime: Date;

        try {
          const res = await fetch("/api/crm/sync-state", {
            method: "GET",
            headers: { Accept: "application/json" },
            cache: "no-store",
          });
          if (!res.ok) throw new Error("Sync state HTTP " + res.status);
          const data = await res.json();
          if (!data.success) throw new Error(data.error || "Failed to get sync state");
          newVersion = String(data.version);
          syncTime = new Date(); // Record time immediately after successful fetch
        } catch {
          const status = await getSyncStatusAction();
          if (!status.success) {
            throw new Error(status.error || "Failed to query server sync state");
          }
          newVersion = status.serverVersion;
          syncTime = new Date(); // Record time immediately after successful action
        }

        const currentKnownVersion = serverVersionRef.current;

        if (currentKnownVersion === null) {
          // Initial hydration sync
          setServerVersion(newVersion);
          setLastSyncTime(syncTime);
          setPendingUpdates(false);
          setSyncState("synced");
          return true;
        }

        if (newVersion !== currentKnownVersion) {
          // Newer mutation detected remotely!
          const isDirty = checkHasDirtyDrafts();
          if (isDirty) {
            // Safe guard: don't overwrite user's in-progress unsaved draft
            setPendingUpdates(true);
            setSyncState("updates_available");
          } else {
            // Safe to refresh data
            await new Promise<void>((resolve) => {
              startTransition(() => {
                router.refresh();
                resolve();
              });
            });
            setServerVersion(newVersion);
            setLastSyncTime(syncTime);
            setPendingUpdates(false);
            setSyncState("synced");
          }
        } else {
          // No remote change: update lastSyncTime to confirm server verification
          setLastSyncTime(syncTime);
          if (pendingUpdates) {
            setSyncState("updates_available");
          } else {
            setSyncState("synced");
          }
        }

        return true;
      } catch {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setSyncState("offline");
        } else {
          setSyncState("error");
        }
        return false;
      } finally {
        isSyncingRef.current = false;
      }
    },
    [checkHasDirtyDrafts, pathname, pendingUpdates, router]
  );

  const applyPendingUpdates = useCallback(async () => {
    await triggerSync({ forceRefresh: true });
  }, [triggerSync]);

  const notifyDataMutated = useCallback(() => {
    // Local mutation happened, immediately sync
    triggerSync({ forceRefresh: true });
  }, [triggerSync]);

  // Initial sync & BroadcastChannel setup
  useEffect(() => {
    if (typeof window === "undefined" || !autoSync) return;

    // Setup broadcast channel for cross-tab sync
    if (typeof BroadcastChannel !== "undefined") {
      try {
        const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        broadcastChannelRef.current = channel;

        channel.onmessage = (event) => {
          const data = event.data;
          if (!data || typeof data !== "object") return;

          if (data.type === "SYNC_SUCCESS" || data.type === "MUTATION") {
            const isDirty = checkHasDirtyDrafts();
            if (isDirty) {
              setPendingUpdates(true);
              setSyncState("updates_available");
            } else {
              startTransition(() => {
                router.refresh();
              });
              if (data.serverVersion) setServerVersion(data.serverVersion);
              if (data.serverTime) setLastSyncTime(new Date(data.serverTime));
              setPendingUpdates(false);
              setSyncState("synced");
            }
          }
        };
      } catch {
        // BroadcastChannel unavailable
      }
    }

    // Online / Offline handlers
    const handleOnline = () => {
      triggerSync();
    };

    const handleOffline = () => {
      setSyncState("offline");
    };

    // Focus / Visibility handler to catch up when user returns to tab
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        triggerSync();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    // Initial sync
    triggerSync();

    // Polling interval
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        triggerSync();
      }
    }, POLLING_INTERVAL_MS);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      clearInterval(intervalId);
      broadcastChannelRef.current?.close();
    };
  }, [checkHasDirtyDrafts, router, triggerSync]);

  const value: SyncContextValue = {
    syncState,
    lastSyncTime,
    serverVersion,
    pendingUpdates,
    hasUnsavedDrafts,
    triggerSync,
    applyPendingUpdates,
    registerDraft,
    unregisterDraft,
    notifyDataMutated,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

const defaultSyncContext: SyncContextValue = {
  syncState: "synced",
  lastSyncTime: null,
  serverVersion: null,
  pendingUpdates: false,
  hasUnsavedDrafts: false,
  triggerSync: async () => true,
  applyPendingUpdates: async () => {},
  registerDraft: () => {},
  unregisterDraft: () => {},
  notifyDataMutated: () => {},
};

export function useSyncStatus(): SyncContextValue {
  const context = useContext(SyncContext);
  return context || defaultSyncContext;
}

/**
 * Hook for forms and draft editors to register their dirty status.
 * Automatically unregisters when the component unmounts.
 */
export function useDraftRegistration(draftId: string, isDirty: boolean) {
  const { registerDraft, unregisterDraft } = useSyncStatus();

  useEffect(() => {
    registerDraft(draftId, isDirty);
    return () => {
      unregisterDraft(draftId);
    };
  }, [draftId, isDirty, registerDraft, unregisterDraft]);
}
