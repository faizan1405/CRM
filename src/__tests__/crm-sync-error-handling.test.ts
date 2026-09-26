import { describe, expect, it, vi, beforeEach } from "vitest";
import { touchCrmSync, touchCrmSyncBestEffort, getCrmSyncState } from "@/lib/crm-sync";
import fs from "fs";
import path from "path";

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

describe("CRM Sync - Error Handling & Durable Version Fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.$queryRawUnsafe.mockReset();
    mockDb.$executeRawUnsafe.mockReset();
  });

  describe("1. Strict touchCrmSync()", () => {
    it("returns real persisted version on success", async () => {
      const now = new Date("2026-09-21T16:00:00.000Z");
      mockDb.$queryRawUnsafe.mockResolvedValueOnce([
        { version: 42, updatedAt: now },
      ]);

      const result = await touchCrmSync();
      expect(result.id).toBe("global");
      expect(result.version).toBe(42);
      expect(result.updatedAt).toEqual(now.toISOString());
    });

    it("first touch on empty table produces durable version 1", async () => {
      const now = new Date("2026-09-21T16:00:00.000Z");
      mockDb.$queryRawUnsafe.mockResolvedValueOnce([
        { version: 1, updatedAt: now },
      ]);

      const result = await touchCrmSync();
      expect(result.version).toBe(1);
      expect(result.version).not.toBeGreaterThan(1000); // definitely not Date.now()
    });

    it("throws on database error instead of returning a fake Date.now() version", async () => {
      mockDb.$queryRawUnsafe.mockRejectedValueOnce(new Error("connection lost"));

      await expect(touchCrmSync()).rejects.toThrow("connection lost");
    });

    it("throws when INSERT … RETURNING returns no rows", async () => {
      mockDb.$queryRawUnsafe.mockResolvedValueOnce([]);

      await expect(touchCrmSync()).rejects.toThrow("RETURNING returned no rows");
    });
  });

  describe("2. Best-Effort touchCrmSyncBestEffort()", () => {
    it("returns real persisted version on success", async () => {
      const now = new Date("2026-09-21T16:00:00.000Z");
      mockDb.$queryRawUnsafe.mockResolvedValueOnce([
        { version: 10, updatedAt: now },
      ]);

      const result = await touchCrmSyncBestEffort();
      expect(result).not.toBeNull();
      expect(result?.version).toBe(10);
      expect(result?.id).toBe("global");
    });

    it("catches database failure safely and returns null (never throws, never returns fake Date.now())", async () => {
      mockDb.$queryRawUnsafe.mockRejectedValueOnce(new Error("deadlock detected"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await touchCrmSyncBestEffort();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[CRM Sync Best-Effort Failed]:"),
        expect.stringContaining("deadlock detected")
      );
      consoleSpy.mockRestore();
    });

    it("returns null when RETURNING returns no rows without throwing", async () => {
      mockDb.$queryRawUnsafe.mockResolvedValueOnce([]);
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await touchCrmSyncBestEffort();

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe("3. Concurrent Monotonic Increments", () => {
    it("returns monotonically increasing versions under concurrency simulation", async () => {
      let currentVersion = 100;
      mockDb.$queryRawUnsafe.mockImplementation(async () => {
        currentVersion += 1;
        return [{ version: currentVersion, updatedAt: new Date() }];
      });

      const results = await Promise.all([
        touchCrmSync(),
        touchCrmSync(),
        touchCrmSync(),
        touchCrmSync(),
      ]);

      const versions = results.map((r) => r.version);
      expect(versions).toEqual([101, 102, 103, 104]);
      // Verify all are sequential and monotonic
      for (let i = 1; i < versions.length; i++) {
        expect(versions[i]).toBe(versions[i - 1] + 1);
      }
    });
  });

  describe("4. Read State getCrmSyncState()", () => {
    it("returns real DB version when row exists", async () => {
      const now = new Date("2026-09-21T16:00:00.000Z");
      mockDb.$queryRawUnsafe.mockResolvedValueOnce([
        { version: 55, updatedAt: now },
      ]);

      const state = await getCrmSyncState();
      expect(state.version).toBe(55);
      expect(state.updatedAt).toBe(now.toISOString());
    });

    it("returns baseline version 0 when table does not exist or has no row", async () => {
      mockDb.$queryRawUnsafe.mockResolvedValueOnce([]);

      const state = await getCrmSyncState();
      expect(state.version).toBe(0);
      expect(state.version).not.toBeGreaterThan(0);
    });

    it("returns baseline version 0 on unexpected database error without throwing or faking version", async () => {
      mockDb.$queryRawUnsafe.mockRejectedValueOnce(new Error("read query failed"));

      const state = await getCrmSyncState();
      expect(state.version).toBe(0);
    });
  });

  describe("5. Static Verification of crm-sync.ts", () => {
    it("verifies that no fake Date.now() version fallback exists in src/lib/crm-sync.ts", () => {
      const filePath = path.resolve(process.cwd(), "src/lib/crm-sync.ts");
      const content = fs.readFileSync(filePath, "utf-8");

      // Verify no 'version: Date.now()'
      expect(content).not.toMatch(/version:\s*Date\.now\(\)/);
      // Verify no Date.now() used anywhere in the file
      expect(content).not.toContain("Date.now()");
    });
  });
});
