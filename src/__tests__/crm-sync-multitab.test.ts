// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  SyncProvider,
  useSyncStatus,
  SyncContextValue,
  isStrictlyNewerVersion,
  SyncRouter,
} from "@/components/sync-provider";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Ensure BroadcastChannel in happy-dom uses the native Node BroadcastChannel
if (typeof window !== "undefined" && !window.BroadcastChannel && typeof globalThis.BroadcastChannel !== "undefined") {
  window.BroadcastChannel = globalThis.BroadcastChannel as any;
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard",
}));

const mockRefreshCrmAction = vi.fn();
const mockGetSyncStatusAction = vi.fn();

vi.mock("@/app/actions/refresh", () => ({
  refreshCrmAction: (...args: any[]) => mockRefreshCrmAction(...args),
}));

vi.mock("@/app/actions/sync", () => ({
  getSyncStatusAction: (...args: any[]) => mockGetSyncStatusAction(...args),
}));

describe("CRM Multi-Tab Sync with Real SyncProvider", () => {
  let serverVersion = "v1";
  let fetchMock: any;

  // Tab A harness
  let containerA: HTMLDivElement;
  let rootA: Root;
  let routerA: SyncRouter & { refresh: any };
  let contextA: SyncContextValue | null = null;

  // Tab B harness
  let containerB: HTMLDivElement;
  let rootB: Root;
  let routerB: SyncRouter & { refresh: any };
  let contextB: SyncContextValue | null = null;

  function ConsumerA() {
    const ctx = useSyncStatus();
    contextA = ctx;
    return React.createElement("div", { id: "tab-a" }, ctx.syncState);
  }

  function ConsumerB() {
    const ctx = useSyncStatus();
    contextB = ctx;
    return React.createElement("div", { id: "tab-b" }, ctx.syncState);
  }

  beforeEach(() => {
    serverVersion = "v1";
    contextA = null;
    contextB = null;

    mockRefreshCrmAction.mockImplementation(async () => ({
      success: true,
      serverVersion: serverVersion,
      serverTime: new Date().toISOString(),
    }));

    mockGetSyncStatusAction.mockImplementation(async () => ({
      success: true,
      serverVersion: serverVersion,
      serverTime: new Date().toISOString(),
    }));

    routerA = { refresh: vi.fn().mockImplementation(() => Promise.resolve()) };
    routerB = { refresh: vi.fn().mockImplementation(() => Promise.resolve()) };

    fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/api/crm/sync-state")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            version: serverVersion,
            updatedAt: new Date().toISOString(),
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    globalThis.fetch = fetchMock;

    containerA = document.createElement("div");
    document.body.appendChild(containerA);
    rootA = createRoot(containerA);

    containerB = document.createElement("div");
    document.body.appendChild(containerB);
    rootB = createRoot(containerB);
  });

  afterEach(() => {
    act(() => {
      rootA.unmount();
      rootB.unmount();
    });
    containerA.remove();
    containerB.remove();
    vi.restoreAllMocks();
  });

  it("0. Strict version ordering helper correctly handles integer, prefixed, and edge versions", () => {
    expect(isStrictlyNewerVersion("2", "1")).toBe(true);
    expect(isStrictlyNewerVersion("1", "2")).toBe(false);
    expect(isStrictlyNewerVersion("2", "2")).toBe(false);
    expect(isStrictlyNewerVersion("v3", "v2")).toBe(true);
    expect(isStrictlyNewerVersion("v2", "v3")).toBe(false);
    expect(isStrictlyNewerVersion("v10", "v9")).toBe(true);
    expect(isStrictlyNewerVersion("1", null)).toBe(true);
    expect(isStrictlyNewerVersion(null, "1")).toBe(false);
    expect(isStrictlyNewerVersion(undefined, "1")).toBe(false);
  });

  it("1. Scheduling router.refresh() is NOT treated as proof that fresh server data has arrived", async () => {
    // Setup router A with a deferred promise for refresh
    let resolveRefreshA!: () => void;
    const refreshPromiseA = new Promise<void>((resolve) => {
      resolveRefreshA = resolve;
    });
    routerA.refresh = vi.fn().mockImplementation(() => refreshPromiseA);

    await act(async () => {
      rootA.render(
        React.createElement(
          SyncProvider,
          {
            initialSyncState: "synced",
            initialServerVersion: "v1",
            router: routerA,
            autoSync: false,
          },
          React.createElement(ConsumerA)
        )
      );
    });

    expect(contextA?.syncState).toBe("synced");
    expect(contextA?.serverVersion).toBe("v1");

    // Mutation occurs on server bumping version to v2
    serverVersion = "v2";

    // Trigger local mutation on Tab A
    let mutationPromise: Promise<void> | void;
    await act(async () => {
      mutationPromise = contextA?.notifyDataMutated({ immediate: true });
    });

    // router.refresh has now been scheduled/called:
    expect(routerA.refresh).toHaveBeenCalled();

    // CRITICAL: While router.refresh is in flight, the tab MUST still be 'syncing'
    // and MUST NOT prematurely acknowledge or claim 'synced' before the fresh RSC data arrives!
    expect(contextA?.syncState).toBe("syncing");
    expect(contextA?.serverVersion).toBe("v1"); // Not yet committed!

    // Now resolve the refresh promise (server data arrives)
    await act(async () => {
      resolveRefreshA();
      await mutationPromise;
    });

    // Now that the refresh has actually completed, the provider commits state:
    expect(contextA?.syncState).toBe("synced");
    expect(contextA?.serverVersion).toBe("v2");
  });

  it("2. Broadcasts local mutations from Tab A and automatically updates clean Tab B", async () => {
    await act(async () => {
      rootA.render(
        React.createElement(
          SyncProvider,
          {
            initialSyncState: "synced",
            initialServerVersion: "v1",
            router: routerA,
            autoSync: true,
          },
          React.createElement(ConsumerA)
        )
      );
      rootB.render(
        React.createElement(
          SyncProvider,
          {
            initialSyncState: "synced",
            initialServerVersion: "v1",
            router: routerB,
            autoSync: true,
          },
          React.createElement(ConsumerB)
        )
      );
    });

    expect(contextA?.syncState).toBe("synced");
    expect(contextB?.syncState).toBe("synced");
    expect(routerB.refresh).not.toHaveBeenCalled();

    // Tab A performs a mutation bumping version to v2
    serverVersion = "v2";
    await act(async () => {
      await contextA?.notifyDataMutated({ immediate: true });
    });

    // Tab A must be synced with v2
    expect(contextA?.serverVersion).toBe("v2");
    expect(contextA?.syncState).toBe("synced");

    // Allow broadcast delivery and Tab B processing
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });

    // Tab B must automatically receive the broadcast, refresh its data, and advance to v2
    expect(routerB.refresh).toHaveBeenCalled();
    expect(contextB?.serverVersion).toBe("v2");
    expect(contextB?.syncState).toBe("synced");
    expect(contextB?.pendingUpdates).toBe(false);
  });

  it("3. Protects unsaved drafts on Tab B: marks updates_available and never overwrites dirty draft", async () => {
    await act(async () => {
      rootA.render(
        React.createElement(
          SyncProvider,
          {
            initialSyncState: "synced",
            initialServerVersion: "v1",
            router: routerA,
            autoSync: true,
          },
          React.createElement(ConsumerA)
        )
      );
      rootB.render(
        React.createElement(
          SyncProvider,
          {
            initialSyncState: "synced",
            initialServerVersion: "v1",
            router: routerB,
            autoSync: true,
          },
          React.createElement(ConsumerB)
        )
      );
    });

    // Tab B user starts typing or edits a lead note
    act(() => {
      contextB?.registerDraft("lead-editor-1", true);
    });
    expect(contextB?.hasUnsavedDrafts).toBe(true);

    // Tab A updates a deal and bumps version to v3
    serverVersion = "v3";
    await act(async () => {
      await contextA?.notifyDataMutated({ immediate: true });
    });

    // Allow broadcast delivery
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });

    // Tab B must NOT refresh because it would wipe user draft!
    expect(routerB.refresh).not.toHaveBeenCalled();
    expect(contextB?.pendingUpdates).toBe(true);
    expect(contextB?.syncState).toBe("updates_available");
    expect(contextB?.serverVersion).toBe("v1"); // Stays on v1

    // Once user finishes/submits their draft on Tab B:
    act(() => {
      contextB?.unregisterDraft("lead-editor-1");
    });
    expect(contextB?.hasUnsavedDrafts).toBe(false);

    // Now user applies pending updates:
    await act(async () => {
      await contextB?.applyPendingUpdates();
    });

    expect(routerB.refresh).toHaveBeenCalled();
    expect(contextB?.serverVersion).toBe("v3");
    expect(contextB?.syncState).toBe("synced");
    expect(contextB?.pendingUpdates).toBe(false);
  });

  it("4. Failed sync requests report error and NEVER falsely report successful synchronization", async () => {
    // Server endpoint fails
    fetchMock.mockImplementation(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: "Database timeout" }),
    }));
    mockGetSyncStatusAction.mockImplementation(async () => ({
      success: false,
      serverVersion: "v1",
      serverTime: new Date().toISOString(),
      error: "Database timeout",
    }));

    await act(async () => {
      rootA.render(
        React.createElement(
          SyncProvider,
          {
            initialSyncState: "synced",
            initialServerVersion: "v1",
            router: routerA,
            autoSync: false,
          },
          React.createElement(ConsumerA)
        )
      );
    });

    await act(async () => {
      await contextA?.notifyDataMutated({ immediate: true });
    });

    // Must be in error state
    expect(contextA?.syncState).toBe("error");
    // Server version must NOT advance falsely
    expect(contextA?.serverVersion).toBe("v1");
  });

  it("5. When router.refresh rejects, tab transitions to error and does NOT commit fresh state", async () => {
    routerA.refresh = vi.fn().mockImplementation(() => Promise.reject(new Error("RSC stream error")));

    await act(async () => {
      rootA.render(
        React.createElement(
          SyncProvider,
          {
            initialSyncState: "synced",
            initialServerVersion: "v1",
            router: routerA,
            autoSync: false,
          },
          React.createElement(ConsumerA)
        )
      );
    });

    serverVersion = "v4";
    await act(async () => {
      await contextA?.notifyDataMutated({ immediate: true });
    });

    expect(contextA?.syncState).toBe("error");
    expect(contextA?.serverVersion).toBe("v1"); // Never committed v4
  });

  it("6. Version ordering: ignores older or duplicate broadcasts and prevents rollback", async () => {
    await act(async () => {
      rootB.render(
        React.createElement(
          SyncProvider,
          {
            initialSyncState: "synced",
            initialServerVersion: "v5",
            router: routerB,
            autoSync: true,
          },
          React.createElement(ConsumerB)
        )
      );
    });

    expect(contextB?.serverVersion).toBe("v5");

    const channel = new BroadcastChannel("scale_flow_crm_sync_channel");

    // Simulate an out-of-order stale broadcast from earlier (v4)
    channel.postMessage({
      type: "MUTATION",
      senderTabId: "other-tab",
      serverVersion: "v4",
      serverTime: new Date().toISOString(),
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    // Stale broadcast must be completely ignored
    expect(routerB.refresh).not.toHaveBeenCalled();
    expect(contextB?.serverVersion).toBe("v5");

    // Simulate duplicate broadcast of same version (v5)
    channel.postMessage({
      type: "MUTATION",
      senderTabId: "other-tab",
      serverVersion: "v5",
      serverTime: new Date().toISOString(),
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    // Duplicate broadcast must be ignored
    expect(routerB.refresh).not.toHaveBeenCalled();
    expect(contextB?.serverVersion).toBe("v5");

    // Simulate strictly newer broadcast (v6)
    serverVersion = "v6";
    channel.postMessage({
      type: "MUTATION",
      senderTabId: "other-tab",
      serverVersion: "v6",
      serverTime: new Date().toISOString(),
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    // Newer broadcast must trigger refresh and advance version
    expect(routerB.refresh).toHaveBeenCalled();
    expect(contextB?.serverVersion).toBe("v6");

    channel.close();
  });

  it("7. Simultaneous mutations from two tabs reconcile properly without corrupting state", async () => {
    await act(async () => {
      rootA.render(
        React.createElement(
          SyncProvider,
          {
            initialSyncState: "synced",
            initialServerVersion: "v1",
            router: routerA,
            autoSync: true,
          },
          React.createElement(ConsumerA)
        )
      );
      rootB.render(
        React.createElement(
          SyncProvider,
          {
            initialSyncState: "synced",
            initialServerVersion: "v1",
            router: routerB,
            autoSync: true,
          },
          React.createElement(ConsumerB)
        )
      );
    });

    // Tab A mutates (bumping to v7) and Tab B mutates (bumping to v8) concurrently
    serverVersion = "v8";
    await act(async () => {
      const mutA = contextA?.notifyDataMutated({ immediate: true });
      const mutB = contextB?.notifyDataMutated({ immediate: true });
      await Promise.all([mutA, mutB]);
      await new Promise((r) => setTimeout(r, 80));
    });

    expect(contextA?.syncState).toBe("synced");
    expect(contextB?.syncState).toBe("synced");
    expect(contextA?.serverVersion).toBe("v8");
    expect(contextB?.serverVersion).toBe("v8");
  });
});
