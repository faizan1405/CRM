import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/app/actions/priority-leads", () => ({ getPriorityLeads: vi.fn() }));
import { getPriorityLeads } from "@/app/actions/priority-leads";
import { priorityPage, loadPriorityPage } from "@/features/dashboard/priority-page";
import { compactCurrency } from "@/features/dashboard/compact-currency";

const action = vi.mocked(getPriorityLeads);
const item = { id: "p1", leadId: "lead1", leadName: "Name", phone: "9876543210", business: "Company", actionNeeded: "Call", time: "9 AM", status: "New", statusColor: "", type: "NEW" as const };
beforeEach(() => vi.clearAllMocks());

describe("dashboard pagination integration", () => {
  it("requests page one and retains continuation for a full page without lookahead", async () => {
    action.mockResolvedValue({ success: true, data: { priorities: Array.from({ length: 10 }, (_, id) => ({ ...item, leadId: String(id) })), hasMore: false, nextCursor: 1 } });
    const page = await priorityPage(1);
    expect(action).toHaveBeenCalledWith(1);
    expect(page.items).toHaveLength(10);
    expect(page.nextCursor).toBe("2");
  });
  it("uses Agent A's numeric next page and finishes a short page", async () => {
    action.mockResolvedValue({ success: true, data: { priorities: [item], hasMore: false, nextCursor: 2 } });
    const page = await loadPriorityPage({ cursor: "2", limit: 10 });
    expect(action).toHaveBeenCalledWith(2);
    expect(page.nextCursor).toBeNull();
    expect(page.items[0]).toMatchObject({ leadId: "lead1", leadName: "Name", reason: "Call · 9 AM" });
  });
  it("propagates failure so the visible list can be preserved for retry", async () => {
    action.mockResolvedValue({ success: false, error: "Could not load priority leads." });
    await expect(priorityPage(2)).rejects.toThrow("Could not load priority leads.");
  });
});

describe("compact INR presentation", () => {
  it("renders the reported clipped value as lakhs", () => expect(compactCurrency(1668440)).toBe("₹16.68L"));
  it("handles zero and crore amounts", () => {
    expect(compactCurrency(0)).toBe("₹0");
    expect(compactCurrency(15000000)).toBe("₹1.5Cr");
  });
});
