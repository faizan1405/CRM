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
  notifyDataMutated: (options?: { immediate?: boolean }) => Promise<void> | void;
}

export const SyncContext = createContext<SyncContextValue | null>(null);

export const CrmSyncProvider = SyncProvider;

const SYNC_CHANNEL_NAME = "scale_flow_crm_sync_channel";
const POLLING_INTERVAL_MS = 10_000;

export interface SyncRouter {
  refresh: () => void | Promise<void>;
}

export interface SyncProviderProps {
  children?: React.ReactNode;
  initialSyncState?: SyncState;
  initialLastSyncTime?: Date | null;
  initialServerVersion?: string | null;
  autoSync?: boolean;
  router?: SyncRouter;
}

export function isStrictlyNewerVersion(
  incoming: string | number | null | undefined,
  current: string | number | null | undefined
): boolean {
  if (incoming === null || incoming === undefined) return false;
  if (current === null || current === undefined) return true;

  const incomingClean = String(incoming).replace(/^v/i, "").trim();
  const currentClean = String(current).replace(/^v/i, "").trim();

  const incNum = Number(incomingClean);
  const curNum = Number(currentClean);

  if (!Number.isNaN(incNum) && !Number.isNaN(curNum)) {
    return incNum > curNum;
  }

  return incomingClean !== currentClean;
}

function isUserActivelyTyping(): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement;
  if (!active) return false;

  const tagName = active.tagName?.toLowerCase();
  if (tagName === "textarea") {
    const val = (active as HTMLTextAreaElement).value;
    return Boolean(val && val.length > 0);
  }

  if (tagName === "input") {
    const inputEl = active as HTMLInputElement;
    const type = inputEl.type?.toLowerCase();
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
  router: customRouter,
}: SyncProviderProps) {
  let defaultRouter: SyncRouter | null = null;
  try {
    defaultRouter = useRouter();
  } catch {
    defaultRouter = { refresh: () => {} };
  }
  const router = customRouter || defaultRouter;

  let pathname = "/";
  try {
    pathname = usePathname() || "/";
  } catch {
    pathname = "/";
  }

  const [, startTransition] = useTransition();

  const [syncState, setSyncState] = useState<SyncState>(initialSyncState);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(initialLastSyncTime);
  const [serverVersion, setServerVersion] = useState<string | null>(initialServerVersion);
  const [pendingUpdates, setPendingUpdates] = useState<boolean>(false);

  // Draft tracking map: id -> isDirty
  const draftsRef = useRef<Map<string, boolean>>(new Map());
  const [hasUnsavedDrafts, setHasUnsavedDrafts] = useState<boolean>(false);

  const serverVersionRef = useRef<string | null>(initialServerVersion);
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

  // Executes router.refresh inside startTransition and only commits fresh server state
  // once the refresh has actually completed.
  const executeRefresh = useCallback(
    async (targetVersion: string, syncTime: Date): Promise<boolean> => {
      setSyncState("syncing");
      try {
        await new Promise<void>((resolve, reject) => {
          startTransition(async () => {
            try {
              const res = router.refresh();
              if (res && typeof (res as Promise<unknown>).then === "function") {
                await res;
              }
              resolve();
            } catch (err) {
              reject(err);
            }
          });
        });

        // Fresh server data has settled! Commit state.
        serverVersionRef.current = targetVersion;
        setServerVersion(targetVersion);
        setLastSyncTime(syncTime);
        setPendingUpdates(false);
        setSyncState("synced");
        return true;
      } catch {
        setSyncState("error");
        return false;
      }
    },
    [router]
  );

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
      if (options?.manual || options?.forceRefresh) {
        setSyncState("syncing");
      }

      try {
        if (options?.forceRefresh) {
          // Manual or forced refresh: revalidate server cache and refresh router
          const res = await refreshCrmAction(pathname);
          if (!res.success) throw new Error(res.error || "Failed to refresh CRM");

          const syncTime = res.serverTime ? new Date(res.serverTime) : new Date();
          const newVersion = res.serverVersion || "v0";

          const ok = await executeRefresh(newVersion, syncTime);
          if (!ok) return false;

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
          if (!data.success || data.version === undefined) {
            throw new Error(data.error || "Failed to get sync state");
          }
          newVersion = String(data.version);
          syncTime = new Date(); // Record time immediately after successful fetch
        } catch {
          const status = await getSyncStatusAction();
          if (!status.success) {
            throw new Error(status.error || "Failed to query server sync state");
          }
          newVersion = String(status.serverVersion);
          syncTime = new Date(); // Record time immediately after successful action
        }

        const currentKnownVersion = serverVersionRef.current;

        if (currentKnownVersion === null) {
          // Initial hydration sync
          serverVersionRef.current = newVersion;
          setServerVersion(newVersion);
          setLastSyncTime(syncTime);
          setPendingUpdates(false);
          setSyncState("synced");
          return true;
        }

        if (isStrictlyNewerVersion(newVersion, currentKnownVersion)) {
          // Newer mutation detected remotely!
          const isDirty = checkHasDirtyDrafts();
          if (isDirty) {
            // Safe guard: don't overwrite user's in-progress unsaved draft
            setPendingUpdates(true);
            setSyncState("updates_available");
          } else {
            return await executeRefresh(newVersion, syncTime);
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
    [checkHasDirtyDrafts, executeRefresh, pathname, pendingUpdates]
  );

  const tabIdRef = useRef<string>("");
  useEffect(() => {
    tabIdRef.current =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
  }, []);

  const mutationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const applyPendingUpdates = useCallback(async () => {
    await triggerSync({ forceRefresh: true });
  }, [triggerSync]);

  const runMutationSync = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSyncState("offline");
      return;
    }

    setSyncState("syncing");

    try {
      let newVersion: string;
      let syncTime: Date;

      try {
        const res = await fetch("/api/crm/sync-state", {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("Sync state HTTP " + res.status);
        }
        const data = await res.json();
        if (!data.success || data.version === undefined) {
          throw new Error(data.error || "Failed to get sync state");
        }
        newVersion = String(data.version);
        syncTime = new Date();
      } catch {
        const status = await getSyncStatusAction();
        if (!status.success) {
          throw new Error(status.error || "Failed to query server sync state");
        }
        newVersion = String(status.serverVersion);
        syncTime = new Date();
      }

      const isDirty = checkHasDirtyDrafts();
      if (isDirty) {
        setPendingUpdates(true);
        setSyncState("updates_available");
      } else {
        const ok = await executeRefresh(newVersion, syncTime);
        if (!ok) return;
      }

      // Broadcast to other tabs so they refresh
      try {
        broadcastChannelRef.current?.postMessage({
          type: "MUTATION",
          senderTabId: tabIdRef.current,
          serverVersion: newVersion,
          serverTime: syncTime.toISOString(),
        });
      } catch {
        // ignore broadcast failure
      }
    } catch {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setSyncState("offline");
      } else {
        setSyncState("error");
      }
    }
  }, [checkHasDirtyDrafts, executeRefresh]);

  const notifyDataMutated = useCallback(
    (options?: { immediate?: boolean }) => {
      if (mutationTimeoutRef.current) {
        clearTimeout(mutationTimeoutRef.current);
        mutationTimeoutRef.current = null;
      }

      if (options?.immediate) {
        return runMutationSync();
      }

      mutationTimeoutRef.current = setTimeout(runMutationSync, 100);
    },
    [runMutationSync]
  );

  // Initial sync & BroadcastChannel setup
  useEffect(() => {
    if (typeof window === "undefined" || !autoSync) return;

    // Setup broadcast channel for cross-tab sync
    if (typeof BroadcastChannel !== "undefined") {
      try {
        const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        broadcastChannelRef.current = channel;

        channel.onmessage = async (event) => {
          const data = event.data;
          if (!data || typeof data !== "object") return;

          // Ignore self-broadcasted messages from same tab
          if (data.senderTabId && data.senderTabId === tabIdRef.current) {
            return;
          }

          if (data.type === "SYNC_SUCCESS" || data.type === "MUTATION") {
            const incomingVer = data.serverVersion ? String(data.serverVersion) : null;
            const currentVer = serverVersionRef.current;

            // Enforce version ordering: only process if strictly newer
            if (!isStrictlyNewerVersion(incomingVer, currentVer)) {
              return;
            }

            const isDirty = checkHasDirtyDrafts();
            if (isDirty) {
              setPendingUpdates(true);
              setSyncState("updates_available");
              return;
            }

            const syncTime = data.serverTime ? new Date(data.serverTime) : new Date();
            await executeRefresh(incomingVer!, syncTime);
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
      if (mutationTimeoutRef.current) {
        clearTimeout(mutationTimeoutRef.current);
      }
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      clearInterval(intervalId);
      broadcastChannelRef.current?.close();
    };
  }, [autoSync, checkHasDirtyDrafts, executeRefresh, triggerSync]);

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
