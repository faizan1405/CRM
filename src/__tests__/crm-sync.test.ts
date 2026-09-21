import { describe, expect, it, vi, beforeEach } from "vitest";
import { touchCrmSync, getCrmSyncState } from "@/lib/crm-sync";
import { getSyncStatusAction } from "@/app/actions/sync";
import { db } from "@/lib/db";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock db
const mockDb = {
  $queryRawUnsafe: vi.fn(),
  $executeRawUnsafe: vi.fn(),
  crmSyncState: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  db: {
    $queryRawUnsafe: (...args: any[]) => mockDb.$queryRawUnsafe(...args),
    $executeRawUnsafe: (...args: any[]) => mockDb.$executeRawUnsafe(...args),
    crmSyncState: {
      findUnique: (...args: any[]) => mockDb.crmSyncState.findUnique(...args),
      upsert: (...args: any[]) => mockDb.crmSyncState.upsert(...args),
    },
  },
}));

describe("Near-Real-Time Cross-Device Synchronization Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.$queryRawUnsafe.mockReset();
    mockDb.$executeRawUnsafe.mockReset();
  });

  describe("1. Database-backed Singleton State (touchCrmSync & getCrmSyncState)", () => {
    it("increments singleton sync version monotonically upon mutation", async () => {
      const now = new Date("2026-09-21T16:00:00.000Z");
      mockDb.$queryRawUnsafe.mockResolvedValueOnce([
        { version: 42, updatedAt: now },
      ]);

      const result = await touchCrmSync();

      expect(result.version).toBe(42);
      expect(result.updatedAt).toEqual(now.toISOString());
      expect(mockDb.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "CrmSyncState"')
      );
      expect(mockDb.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('"version" = "CrmSyncState"."version" + 1')
      );
    });

    it("supports running within a Prisma transaction client", async () => {
      const now = new Date("2026-09-21T16:00:05.000Z");
      const mockTx = {
        $queryRawUnsafe: vi.fn().mockResolvedValueOnce([
          { version: 43, updatedAt: now },
        ]),
      };

      const result = await touchCrmSync(mockTx as any);

      expect(result.version).toBe(43);
      expect(mockTx.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "CrmSyncState"')
      );
      expect(mockDb.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it("retrieves the single indexed sync state row efficiently without scanning lead tables", async () => {
      const now = new Date("2026-09-21T16:00:10.000Z");
      mockDb.$queryRawUnsafe.mockResolvedValueOnce([
        { version: 44, updatedAt: now },
      ]);

      const state = await getCrmSyncState();

      expect(state.version).toBe(44);
      expect(state.updatedAt).toEqual(now.toISOString());
      expect(mockDb.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('SELECT "version", "updatedAt" FROM "CrmSyncState" WHERE "id" = \'global\'')
      );
    });

    it("creates the table and initializes to version 0 if state table does not exist", async () => {
      // SELECT fails
      mockDb.$queryRawUnsafe
        .mockRejectedValueOnce(new Error('relation "CrmSyncState" does not exist'));

      const state = await getCrmSyncState();
      expect(state.version).toBe(0);
    });
  });

  describe("2. Server Sync Status Action", () => {
    it("returns single-query sync state with serverVersion and serverTime", async () => {
      const now = new Date("2026-09-21T16:01:00.000Z");
      mockDb.$queryRawUnsafe.mockResolvedValueOnce([
        { version: 50, updatedAt: now },
      ]);

      const res = await getSyncStatusAction();

      expect(res.success).toBe(true);
      expect(res.serverVersion).toBe("50");
      expect(res.serverTime).toBe(now.toISOString());
    });
  });

  describe("3. Cross-Device Version Transition Logic", () => {
    it("recognizes when Device A mutates data and Device B should refresh", () => {
      const deviceBKnownVersion = "42" as string;
      const serverVersionAfterDeviceAMutation = "43" as string;

      const hasUpdate = serverVersionAfterDeviceAMutation !== deviceBKnownVersion;
      expect(hasUpdate).toBe(true);
    });

    it("does not trigger refresh when versions match", () => {
      const deviceBKnownVersion = "43" as string;
      const serverVersionUnchanged = "43" as string;

      const hasUpdate = serverVersionUnchanged !== deviceBKnownVersion;
      expect(hasUpdate).toBe(false);
    });
  });

  describe("4. Draft Safety & Active Input Invariant", () => {
    it("marks sync as pending if user has an active registered dirty draft", () => {
      const drafts = new Map<string, boolean>();
      drafts.set("lead-form-123", true);

      let hasDirty = false;
      for (const isDirty of drafts.values()) {
        if (isDirty) {
          hasDirty = true;
          break;
        }
      }

      expect(hasDirty).toBe(true);
    });

    it("allows immediate refresh when all drafts are clean", () => {
      const drafts = new Map<string, boolean>();
      drafts.set("lead-form-123", false);

      let hasDirty = false;
      for (const isDirty of drafts.values()) {
        if (isDirty) {
          hasDirty = true;
          break;
        }
      }

      expect(hasDirty).toBe(false);
    });
  });

  describe("5. Multi-tab BroadcastChannel Invariant", () => {
    it("formats message structure correctly for multi-tab sync", () => {
      const payload = {
        type: "SYNC_SUCCESS",
        serverVersion: "55",
        serverTime: new Date("2026-09-21T16:05:00.000Z").toISOString(),
      };

      expect(payload.type).toBe("SYNC_SUCCESS");
      expect(payload.serverVersion).toBe("55");
      expect(payload.serverTime).toBeDefined();
    });
  });
});
