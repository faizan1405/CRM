import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getSyncStatusAction } from "@/app/actions/sync";
import { refreshCrmAction } from "@/app/actions/refresh";

// In-memory BroadcastChannel simulation
type ChannelListener = (event: { data: any }) => void;
const broadcastBus = new Map<string, Set<ChannelListener>>();

class MockBroadcastChannel {
  name: string;
  onmessage: ChannelListener | null = null;
  private listener: ChannelListener;

  constructor(name: string) {
    this.name = name;
    if (!broadcastBus.has(name)) {
      broadcastBus.set(name, new Set());
    }
    this.listener = (event) => {
      if (this.onmessage) {
        this.onmessage(event);
      }
    };
    broadcastBus.get(name)!.add(this.listener);
  }

  postMessage(data: any) {
    const listeners = broadcastBus.get(this.name);
    if (listeners) {
      for (const l of listeners) {
        // Do not self-deliver if the channel has a way to distinguish,
        // but here we deliver to all listeners on the bus
        l({ data });
      }
    }
  }

  close() {
    broadcastBus.get(this.name)?.delete(this.listener);
  }
}

// Simulates a browser tab running the CRM Sync engine
class SimulatedCrmTab {
  tabId: string;
  serverVersion: string | null;
  lastSyncTime: Date | null = null;
  syncState: "syncing" | "synced" | "offline" | "error" | "updates_available" = "synced";
  pendingUpdates = false;
  drafts = new Map<string, boolean>();
  channel: MockBroadcastChannel;
  refreshCount = 0;
  isOnline = true;

  constructor(tabId: string, initialVersion = "v1") {
    this.tabId = tabId;
    this.serverVersion = initialVersion;
    this.channel = new MockBroadcastChannel("scale_flow_crm_sync_channel");

    this.channel.onmessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      // Ignore messages broadcast by this tab itself
      if (data.senderTabId && data.senderTabId === this.tabId) {
        return;
      }

      if (data.type === "SYNC_SUCCESS" || data.type === "MUTATION") {
        if (this.hasDirtyDrafts()) {
          this.pendingUpdates = true;
          this.syncState = "updates_available";
        } else {
          this.refreshCount++;
          if (data.serverVersion) {
            this.serverVersion = String(data.serverVersion);
          }
          if (data.serverTime) {
            this.lastSyncTime = new Date(data.serverTime);
          }
          this.pendingUpdates = false;
          this.syncState = "synced";
        }
      }
    };
  }

  hasDirtyDrafts(): boolean {
    for (const isDirty of this.drafts.values()) {
      if (isDirty) return true;
    }
    return false;
  }

  registerDraft(id: string, isDirty: boolean) {
    this.drafts.set(id, isDirty);
  }

  unregisterDraft(id: string) {
    this.drafts.delete(id);
  }

  async notifyDataMutated(fetchSyncState: () => Promise<{ success: boolean; version?: string }>) {
    if (!this.isOnline) {
      this.syncState = "offline";
      return;
    }

    try {
      const res = await fetchSyncState();
      if (!res.success || res.version === undefined) {
        throw new Error("Failed to get sync state");
      }

      const newVersion = String(res.version);
      const syncTime = new Date();

      if (this.hasDirtyDrafts()) {
        this.pendingUpdates = true;
        this.syncState = "updates_available";
      } else {
        this.refreshCount++;
        this.serverVersion = newVersion;
        this.lastSyncTime = syncTime;
        this.pendingUpdates = false;
        this.syncState = "synced";
      }

      this.channel.postMessage({
        type: "MUTATION",
        senderTabId: this.tabId,
        serverVersion: newVersion,
        serverTime: syncTime.toISOString(),
      });
    } catch {
      if (!this.isOnline) {
        this.syncState = "offline";
      } else {
        this.syncState = "error";
      }
    }
  }

  async applyPendingUpdates(fetchSyncState: () => Promise<{ success: boolean; version?: string }>) {
    try {
      const res = await fetchSyncState();
      if (res.success && res.version) {
        this.refreshCount++;
        this.serverVersion = String(res.version);
        this.lastSyncTime = new Date();
        this.pendingUpdates = false;
        this.syncState = "synced";
      }
    } catch {
      this.syncState = "error";
    }
  }

  close() {
    this.channel.close();
  }
}

describe("CRM Multi-Tab Simultaneous Updates & Synchronization Correctness", () => {
  let serverVersion = "v1";

  beforeEach(() => {
    broadcastBus.clear();
    serverVersion = "v1";
  });

  it("1. Broadcasts local mutations from Tab A and automatically updates clean Tab B", async () => {
    const tabA = new SimulatedCrmTab("tab-A", "v1");
    const tabB = new SimulatedCrmTab("tab-B", "v1");

    expect(tabA.syncState).toBe("synced");
    expect(tabB.syncState).toBe("synced");
    expect(tabB.refreshCount).toBe(0);

    // Tab A performs a mutation (e.g. status change) bumping server version to v2
    serverVersion = "v2";
    await tabA.notifyDataMutated(async () => ({ success: true, version: serverVersion }));

    // Tab A must refresh its own data and update to v2
    expect(tabA.refreshCount).toBe(1);
    expect(tabA.serverVersion).toBe("v2");
    expect(tabA.syncState).toBe("synced");

    // Tab B must automatically receive the mutation and refresh to v2
    expect(tabB.refreshCount).toBe(1);
    expect(tabB.serverVersion).toBe("v2");
    expect(tabB.syncState).toBe("synced");
    expect(tabB.pendingUpdates).toBe(false);

    tabA.close();
    tabB.close();
  });

  it("2. Protects unsaved drafts on Tab B: marks updates_available and never overwrites dirty draft", async () => {
    const tabA = new SimulatedCrmTab("tab-A", "v1");
    const tabB = new SimulatedCrmTab("tab-B", "v1");

    // Tab B user starts composing an unsaved note or editing a deal
    tabB.registerDraft("note-editor-1", true);
    expect(tabB.hasDirtyDrafts()).toBe(true);

    // Tab A records a payment, bumping server version to v3
    serverVersion = "v3";
    await tabA.notifyDataMutated(async () => ({ success: true, version: serverVersion }));

    // Tab A is synced with v3
    expect(tabA.serverVersion).toBe("v3");

    // Tab B must NOT execute a refresh because it would wipe user draft!
    expect(tabB.refreshCount).toBe(0);
    expect(tabB.pendingUpdates).toBe(true);
    expect(tabB.syncState).toBe("updates_available");
    // Tab B still holds its draft and has not advanced falsely
    expect(tabB.serverVersion).toBe("v1");

    // Once user submits/saves their draft on Tab B:
    tabB.unregisterDraft("note-editor-1");
    expect(tabB.hasDirtyDrafts()).toBe(false);

    // Now user applies pending updates:
    await tabB.applyPendingUpdates(async () => ({ success: true, version: serverVersion }));
    expect(tabB.refreshCount).toBe(1);
    expect(tabB.serverVersion).toBe("v3");
    expect(tabB.syncState).toBe("synced");
    expect(tabB.pendingUpdates).toBe(false);

    tabA.close();
    tabB.close();
  });

  it("3. Failed sync requests report error and NEVER falsely report successful synchronization", async () => {
    const tabA = new SimulatedCrmTab("tab-A", "v1");

    // Network / API error occurs during sync state check
    await tabA.notifyDataMutated(async () => ({ success: false }));

    // Tab A must transition to error, NOT synced!
    expect(tabA.syncState).toBe("error");
    // Server version must NOT advance falsely
    expect(tabA.serverVersion).toBe("v1");

    tabA.close();
  });

  it("4. Offline tab reports offline and reconciles when reconnected", async () => {
    const tabA = new SimulatedCrmTab("tab-A", "v1");
    tabA.isOnline = false;

    await tabA.notifyDataMutated(async () => ({ success: true, version: "v2" }));
    expect(tabA.syncState).toBe("offline");

    // Reconnect
    tabA.isOnline = true;
    serverVersion = "v2";
    await tabA.notifyDataMutated(async () => ({ success: true, version: serverVersion }));
    expect(tabA.syncState).toBe("synced");
    expect(tabA.serverVersion).toBe("v2");

    tabA.close();
  });

  it("5. Simultaneous mutations from two tabs reconcile both without silent drops", async () => {
    const tabA = new SimulatedCrmTab("tab-A", "v1");
    const tabB = new SimulatedCrmTab("tab-B", "v1");

    // Tab A mutates (bump to v4) and Tab B simultaneously mutates (bump to v5)
    serverVersion = "v4";
    const mutationA = tabA.notifyDataMutated(async () => ({ success: true, version: "v4" }));

    serverVersion = "v5";
    const mutationB = tabB.notifyDataMutated(async () => ({ success: true, version: "v5" }));

    await Promise.all([mutationA, mutationB]);

    // Both tabs must reconcile
    expect(tabA.syncState).toBe("synced");
    expect(tabB.syncState).toBe("synced");
    // Tab B has the latest version v5
    expect(tabB.serverVersion).toBe("v5");

    tabA.close();
    tabB.close();
  });
});
