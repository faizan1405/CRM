import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import DashboardPage from "@/app/(crm)/dashboard/page";

vi.mock("@/app/actions/dashboard", () => ({
  getDashboardData: async () => ({
    success: true,
    data: {
      kpis: { totalLeads: 0, newLeads: 0, qualifiedLeads: 0, wonClients: 0, followUpsToday: 4, wonRevenue: 0 },
      needsAttention: { overdueFollowUps: 0, proposalsPending: 0, leadsNotContacted: 0 },
      priorities: [], attentionLeads: [],
      pipeline: { new: 0, contacted: 0, qualified: 0, proposal: 0, won: 0, lost: 0 },
      revenue: { won: 0, openPipeline: 0, avgWonDeal: 0 },
      recentActivity: [],
      todayFollowUps: ["CALL", "WHATSAPP", "EMAIL", "OTHER"].map((type) => ({
        id: type, leadId: type, leadName: "Render regression fixture", type, time: "11:00 AM",
      })),
    },
  }),
}));
vi.mock("@/app/actions/daily-briefing", () => ({
  getDailyBriefing: async () => ({ success: false }),
  refreshDailyBriefingAi: vi.fn(),
}));

describe("Dashboard server rendering", () => {
  it("renders every persisted uppercase follow-up type without crashing", async () => {
    const html = renderToStaticMarkup(await DashboardPage());
    for (const type of ["Call", "WhatsApp", "Email", "Other"]) expect(html).toContain(type);
    expect(html).toContain("Today&#x27;s Follow-ups");
  });
});
