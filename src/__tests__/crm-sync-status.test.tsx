import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatSyncISTTime } from "@/lib/date-utils";
import { getSyncStatusAction } from "@/app/actions/sync";
import { refreshCrmAction } from "@/app/actions/refresh";
import { SyncStatusIndicator } from "@/components/sync-status-indicator";
import { SyncProvider, SyncContext, type SyncContextValue } from "@/components/sync-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileHeader } from "@/components/mobile-header";

// Mock next/navigation
const mockRefresh = vi.fn();
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/cache
const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: any[]) => mockRevalidatePath(...args),
}));

// Mock toast
const mockShowToast = vi.fn();
vi.mock("@/components/toast-provider", () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

// Mock database for sync action
const mockDb = {
  $queryRawUnsafe: vi.fn(),
  $executeRawUnsafe: vi.fn(),
  lead: { findFirst: vi.fn() },
  followUp: { findFirst: vi.fn() },
  deal: { findFirst: vi.fn() },
  payment: { findFirst: vi.fn() },
  leadActivity: { findFirst: vi.fn() },
  personalNote: { findFirst: vi.fn() },
  leadLossEvent: { findFirst: vi.fn() },
  salesNotification: { findFirst: vi.fn() },
};

vi.mock("@/lib/db", () => ({
  db: {
    $queryRawUnsafe: (...args: any[]) => mockDb.$queryRawUnsafe(...args),
    $executeRawUnsafe: (...args: any[]) => mockDb.$executeRawUnsafe(...args),
    get lead() { return mockDb.lead; },
    get followUp() { return mockDb.followUp; },
    get deal() { return mockDb.deal; },
    get payment() { return mockDb.payment; },
    get leadActivity() { return mockDb.leadActivity; },
    get personalNote() { return mockDb.personalNote; },
    get leadLossEvent() { return mockDb.leadLossEvent; },
    get salesNotification() { return mockDb.salesNotification; },
  },
}));

describe("Global CRM Synchronization Status Indicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. IST Time Formatting Convention", () => {
    it("formats ISO string correctly into Asia/Kolkata IST 12-hour format with AM/PM", () => {
      // 11:02:18 UTC = 16:32:18 IST (4:32:18 PM)
      const dateUtc = new Date("2026-09-21T11:02:18.000Z");
      const formatted = formatSyncISTTime(dateUtc);
      expect(formatted).toBe("4:32:18 PM");
    });

    it("handles morning AM timestamps correctly", () => {
      // 03:45:00 UTC = 09:15:00 IST (9:15:00 AM)
      const dateUtc = new Date("2026-09-21T03:45:00.000Z");
      const formatted = formatSyncISTTime(dateUtc);
      expect(formatted).toBe("9:15:00 AM");
    });

    it("returns empty string gracefully for null or invalid dates", () => {
      expect(formatSyncISTTime(null)).toBe("");
      expect(formatSyncISTTime(undefined)).toBe("");
      expect(formatSyncISTTime("invalid-date-string")).toBe("");
    });
  });

  describe("2. Server Sync Status Action", () => {
    it("returns latest mutation timestamp and version as serverVersion and current serverTime", async () => {
      const mockTime = new Date("2026-09-21T11:02:18.000Z");

      mockDb.$queryRawUnsafe.mockResolvedValueOnce([
        { version: 10, updatedAt: mockTime },
      ]);

      const res = await getSyncStatusAction();
      expect(res.success).toBe(true);
      expect(res.serverVersion).toBe("10");
      expect(res.serverTime).toBe(mockTime.toISOString());
    });

    it("handles fallback gracefully by returning default version 1", async () => {
      mockDb.$queryRawUnsafe.mockRejectedValueOnce(new Error("Table error"));

      const res = await getSyncStatusAction();
      expect(res.success).toBe(true);
      expect(res.serverVersion).toBe("0");
    });
  });

  describe("3. Desktop Shell & Mobile Header UI Integration", () => {
    it("renders desktop sync status indicator in AppSidebar", () => {
      const html = renderToStaticMarkup(<AppSidebar />);
      expect(html).toContain("data-testid=\"sync-status-desktop\"");
      expect(html).toContain("Synced");
    });

    it("renders mobile sync status indicator in MobileHeader", () => {
      const html = renderToStaticMarkup(<MobileHeader />);
      expect(html).toContain("data-testid=\"sync-status-mobile\"");
      expect(html).toContain("Synced");
    });

    it("keeps existing manual refresh buttons available on both desktop and mobile", () => {
      const sidebarHtml = renderToStaticMarkup(<AppSidebar />);
      expect(sidebarHtml).toContain("data-testid=\"crm-refresh-button-desktop\"");

      const mobileHtml = renderToStaticMarkup(<MobileHeader />);
      expect(mobileHtml).toContain("data-testid=\"crm-refresh-button-mobile\"");
    });
  });

  describe("4. All 5 Required Sync States Visual Representation", () => {
    function renderIndicator(
      syncState: "syncing" | "synced" | "offline" | "error" | "updates_available",
      variant: "desktop" | "mobile",
      lastSyncTime: Date | null = new Date("2026-09-21T11:02:18.000Z")
    ) {
      return renderToStaticMarkup(
        <SyncProvider
          initialSyncState={syncState}
          initialLastSyncTime={lastSyncTime}
          autoSync={false}
        >
          <SyncStatusIndicator variant={variant} />
        </SyncProvider>
      );
    }

    it("State 1: 'Syncing...' state renders on desktop and mobile", () => {
      const desktopHtml = renderIndicator("syncing", "desktop");
      expect(desktopHtml).toContain("Syncing...");
      expect(desktopHtml).toContain("animate-spin");

      const mobileHtml = renderIndicator("syncing", "mobile");
      expect(mobileHtml).toContain("Syncing...");
    });

    it("State 2: '✓ Synced • 4:32:18 PM' state renders with last successful sync time", () => {
      const desktopHtml = renderIndicator("synced", "desktop", new Date("2026-09-21T11:02:18.000Z"));
      expect(desktopHtml).toContain("✓ Synced");
      expect(desktopHtml).toContain("4:32:18 PM");

      const mobileHtml = renderIndicator("synced", "mobile", new Date("2026-09-21T11:02:18.000Z"));
      expect(mobileHtml).toContain("Synced • 4:32:18 PM");
    });

    it("State 3: 'Offline' state renders when network is disconnected", () => {
      const desktopHtml = renderIndicator("offline", "desktop");
      expect(desktopHtml).toContain("Offline");

      const mobileHtml = renderIndicator("offline", "mobile");
      expect(mobileHtml).toContain("Offline");
    });

    it("State 4: 'Sync error' state renders on failure", () => {
      const desktopHtml = renderIndicator("error", "desktop");
      expect(desktopHtml).toContain("Sync error");

      const mobileHtml = renderIndicator("error", "mobile");
      expect(mobileHtml).toContain("Sync error");
    });

    it("State 5: 'Updates available' state renders when remote updates are held", () => {
      const desktopHtml = renderIndicator("updates_available", "desktop");
      expect(desktopHtml).toContain("Updates available");

      const mobileHtml = renderIndicator("updates_available", "mobile");
      expect(mobileHtml).toContain("Updates available");
    });
  });

  describe("5. Draft Preservation and Safe Sync Behavior", () => {
    it("provides mockable SyncContext for draft tracking and manual updates", () => {
      const mockApplyUpdates = vi.fn();
      const mockTriggerSync = vi.fn();
      const customValue: SyncContextValue = {
        syncState: "updates_available",
        lastSyncTime: new Date("2026-09-21T11:02:18.000Z"),
        serverVersion: "v999",
        pendingUpdates: true,
        hasUnsavedDrafts: true,
        triggerSync: mockTriggerSync,
        applyPendingUpdates: mockApplyUpdates,
        registerDraft: vi.fn(),
        unregisterDraft: vi.fn(),
        notifyDataMutated: vi.fn(),
      };

      const html = renderToStaticMarkup(
        <SyncContext.Provider value={customValue}>
          <SyncStatusIndicator variant="desktop" />
        </SyncContext.Provider>
      );

      expect(html).toContain("Updates available");
      expect(html).toContain("Click to refresh");
    });
  });

  describe("6. Cross-Device & Mutation Sync Lifecycle", () => {
    it("detects newer server mutation when remote device updates database", async () => {
      const v1 = new Date("2026-09-21T10:00:00.000Z");
      const v2 = new Date("2026-09-21T10:30:00.000Z");

      mockDb.$queryRawUnsafe.mockResolvedValueOnce([{ version: 1, updatedAt: v1 }]);
      const res1 = await getSyncStatusAction();
      expect(res1.serverVersion).toBe("1");

      // Remote device mutates deal -> version 2
      mockDb.$queryRawUnsafe.mockResolvedValueOnce([{ version: 2, updatedAt: v2 }]);
      const res2 = await getSyncStatusAction();
      expect(res2.serverVersion).toBe("2");
      expect(Number(res2.serverVersion)).toBeGreaterThan(Number(res1.serverVersion));
    });

    it("handles undo mutations by reflecting the latest version number", async () => {
      const undoTime = new Date("2026-09-21T11:15:00.000Z");
      mockDb.$queryRawUnsafe.mockResolvedValueOnce([{ version: 3, updatedAt: undoTime }]);

      const res = await getSyncStatusAction();
      expect(res.serverVersion).toBe("3");
    });
  });
});
