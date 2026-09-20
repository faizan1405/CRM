import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CrmRefreshButton } from "@/components/crm-refresh-button";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileHeader } from "@/components/mobile-header";
import { refreshCrmAction } from "@/app/actions/refresh";

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
  usePathname: () => "/leads",
  useSearchParams: () => new URLSearchParams("status=Contacted&q=test"),
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

describe("Global CRM Refresh Button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders RefreshCw button with aria-label on desktop", () => {
    const html = renderToStaticMarkup(<CrmRefreshButton variant="desktop" />);
    expect(html).toContain("aria-label=\"Refresh CRM\"");
    expect(html).toContain("data-testid=\"crm-refresh-button-desktop\"");
    expect(html).toContain("title=\"Refresh CRM\"");
    expect(html).toContain("lucide-refresh-cw");
  });

  it("renders RefreshCw button with aria-label on mobile", () => {
    const html = renderToStaticMarkup(<CrmRefreshButton variant="mobile" />);
    expect(html).toContain("aria-label=\"Refresh CRM\"");
    expect(html).toContain("data-testid=\"crm-refresh-button-mobile\"");
    expect(html).toContain("title=\"Refresh CRM\"");
    expect(html).toContain("lucide-refresh-cw");
  });

  it("is integrated cleanly into the desktop AppSidebar header", () => {
    const html = renderToStaticMarkup(<AppSidebar />);
    expect(html).toContain("data-testid=\"crm-refresh-button-desktop\"");
    expect(html).toContain("Scale Flow");
    expect(html).toContain("aria-label=\"Refresh CRM\"");
  });

  it("is integrated cleanly into the MobileHeader top bar", () => {
    const html = renderToStaticMarkup(<MobileHeader />);
    expect(html).toContain("data-testid=\"crm-refresh-button-mobile\"");
    expect(html).toContain("aria-label=\"Refresh CRM\"");
  });

  it("refreshCrmAction revalidates layout and current path without mutating data", async () => {
    const result = await refreshCrmAction("/leads");
    expect(result.success).toBe(true);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/leads", "page");
  });

  it("refreshCrmAction handles errors safely without throwing", async () => {
    mockRevalidatePath.mockImplementationOnce(() => {
      throw new Error("Revalidation cache failure");
    });

    const result = await refreshCrmAction("/pipeline");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Revalidation cache failure");
  });
});
