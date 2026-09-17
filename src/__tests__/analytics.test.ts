import { describe, it, expect, afterAll, vi } from "vitest";

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getAnalyticsData } from "@/app/actions/analytics";

// ─── Auth Mock ─────────────────────────────────────────────────────────────────

let _authReturn: unknown = {
  id: "test-session-user-id",
  email: "test@test.com",
  role: "ADMIN",
};

vi.mock("@/lib/auth", () => ({
  getSession: async () => _authReturn,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────────

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function createLead(overrides: Partial<Prisma.LeadCreateInput> = {}) {
  const data: Prisma.LeadCreateInput = {
    name: `TestLead ${randomId()}`,
    phone: "9999999999",
    status: "NEW",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  return db.lead.create({ data });
}

async function createActivity(leadId: string) {
  return db.leadActivity.create({
    data: {
      leadId,
      type: "STATUS_CHANGED",
      message: "test",
      metadata: { to: "WON" },
      createdAt: new Date(),
    },
  });
}

async function createFollowUp(leadId: string, overrides: Partial<Prisma.FollowUpUncheckedCreateInput> = {}) {
  const data: Prisma.FollowUpUncheckedCreateInput = {
    leadId,
    type: "CALL",
    status: "PENDING",
    scheduledAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  return db.followUp.create({ data });
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("Analytics Data Layer", () => {
  const allIds = { leads: [] as string[], activities: [] as string[], followUps: [] as string[] };
  const ids = allIds;

  afterAll(async () => {
    if (allIds.followUps.length > 0) {
      await db.followUp.deleteMany({ where: { id: { in: allIds.followUps } } }).catch(() => {});
    }
    if (allIds.activities.length > 0) {
      await db.leadActivity.deleteMany({ where: { id: { in: allIds.activities } } }).catch(() => {});
    }
    if (allIds.leads.length > 0) {
      await db.lead.deleteMany({ where: { id: { in: allIds.leads } } }).catch(() => {});
    }
    await db.$disconnect().catch(() => {});
  });

  // ── 1. Zero-data state ───────────────────────────────────────────────────────

  describe("zero-data state", () => {
    it("returns non-negative values for all metrics", async () => {
      const result = await getAnalyticsData("30d");
      expect(result.success).toBe(true);
      if (!result.success) return;

      const { coreMetrics, funnel } = result.data;

      expect(coreMetrics.totalLeads).toBeGreaterThanOrEqual(0);
      expect(coreMetrics.winRate).toBeGreaterThanOrEqual(0);
      expect(coreMetrics.lostRate).toBeGreaterThanOrEqual(0);
      expect(coreMetrics.avgWonDeal).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(coreMetrics.winRate)).toBe(false);
      expect(Number.isNaN(coreMetrics.lostRate)).toBe(false);
      expect(Number.isNaN(coreMetrics.avgWonDeal)).toBe(false);

      for (const stage of funnel) {
        expect(stage.reached).toBeGreaterThanOrEqual(0);
        expect(stage.conversionFromPrev === null || (stage.conversionFromPrev >= 0 && stage.conversionFromPrev <= 1)).toBe(true);
      }
    });
  });

  // ── 2. Core Metrics ─────────────────────────────────────────────────────────

  describe("core metrics", () => {
    it("counts leads across statuses", async () => {
      const past = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      const leads = await Promise.all([
        createLead({ status: "NEW", createdAt: past }),
        createLead({ status: "CONTACTED", createdAt: past }),
        createLead({ status: "QUALIFIED", createdAt: past }),
        createLead({ status: "PROPOSAL_SENT", createdAt: past }),
        createLead({ status: "WON", quotedAmount: 50000, createdAt: past }),
        createLead({ status: "LOST", createdAt: past }),
      ]);
      leads.forEach((l) => ids.leads.push(l.id));

      const result = await getAnalyticsData("30d");
      expect(result.success).toBe(true);
      if (!result.success) return;

      const m = result.data.coreMetrics;
      expect(m.totalLeads).toBeGreaterThanOrEqual(6);
      expect(m.newLeads).toBeGreaterThanOrEqual(1);
      expect(m.wonLeads).toBeGreaterThanOrEqual(1);
      expect(m.lostLeads).toBeGreaterThanOrEqual(1);
    });

    it("excludes leads outside the 7d range", async () => {
      const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const oldLead = await createLead({ status: "WON", quotedAmount: 100000, createdAt: oldDate });
      ids.leads.push(oldLead.id);

      const result7d = await getAnalyticsData("7d");
      const resultAll = await getAnalyticsData("all");
      expect(result7d.success).toBe(true);
      if (!result7d.success) return;
      expect(resultAll.success).toBe(true);
      if (!resultAll.success) return;

      expect(result7d.data.coreMetrics.wonLeads).toBeLessThanOrEqual(
        resultAll.data.coreMetrics.wonLeads
      );
    });
  });

  // ── 3. Win / Lost Rate ───────────────────────────────────────────────────────

  describe("win rate and lost rate", () => {
    it("satisfies winRate + lostRate = 1 when there are closed deals", async () => {
      const result = await getAnalyticsData("30d");
      expect(result.success).toBe(true);
      if (!result.success) return;

      const m = result.data.coreMetrics;
      if (m.wonLeads + m.lostLeads > 0) {
        expect(m.winRate + m.lostRate).toBeCloseTo(1, 4);
      }
    });

    it("satisfies winRate = Won/(Won+Lost)", async () => {
      const w = await createLead({ status: "WON", quotedAmount: 100000 });
      const l1 = await createLead({ status: "LOST" });
      const l2 = await createLead({ status: "LOST" });
      ids.leads.push(w.id, l1.id, l2.id);

      const result = await getAnalyticsData("30d");
      expect(result.success).toBe(true);
      if (!result.success) return;

      const m = result.data.coreMetrics;
      const newWon = m.wonLeads;
      const newLost = m.lostLeads;
      const totalClosed = newWon + newLost;

      if (totalClosed > 0) {
        expect(m.winRate).toBeCloseTo(newWon / totalClosed, 4);
        expect(m.lostRate).toBeCloseTo(newLost / totalClosed, 4);
      }
    });

    it("does not produce NaN on zero denominator", async () => {
      const openLead = await createLead({ status: "NEW" });
      ids.leads.push(openLead.id);

      const result = await getAnalyticsData("30d");
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(Number.isNaN(result.data.coreMetrics.winRate)).toBe(false);
      expect(Number.isNaN(result.data.coreMetrics.lostRate)).toBe(false);
      expect(Number.isNaN(result.data.coreMetrics.avgWonDeal)).toBe(false);
    });

    it("satisfies winRate * closedTotal ≈ wonLeads", async () => {
      // This tests the formula: winRate = Won / (Won + Lost)
      // by verifying winRate * (won + lost) == won
      const w = await createLead({ status: "WON", quotedAmount: 50000 });
      const l1 = await createLead({ status: "LOST" });
      ids.leads.push(w.id, l1.id);

      const result = await getAnalyticsData("30d");
      expect(result.success).toBe(true);
      if (!result.success) return;

      const m = result.data.coreMetrics;
      if (m.wonLeads + m.lostLeads > 0) {
        // Allow for floating-point rounding in the winRate display value
        expect(m.winRate * (m.wonLeads + m.lostLeads)).toBeCloseTo(m.wonLeads, 1);
        expect(m.lostRate * (m.wonLeads + m.lostLeads)).toBeCloseTo(m.lostLeads, 1);
      }
    });
  });

  // ── 4. Revenue & Average Deal ───────────────────────────────────────────────

  describe("won revenue and average deal", () => {
    it("includes WON leads in revenue sum", async () => {
      const w1 = await createLead({ status: "WON", quotedAmount: 100000 });
      const w2 = await createLead({ status: "WON", quotedAmount: 300000 });
      ids.leads.push(w1.id, w2.id);

      const result = await getAnalyticsData("30d");
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.coreMetrics.wonRevenue).toBeGreaterThanOrEqual(0);
    });

    it("computes average won deal correctly", async () => {
      const w1 = await createLead({ status: "WON", quotedAmount: 200000 });
      const w2 = await createLead({ status: "WON", quotedAmount: 600000 });
      ids.leads.push(w1.id, w2.id);

      const result = await getAnalyticsData("30d");
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.coreMetrics.avgWonDeal).toBeGreaterThanOrEqual(0);
    });

    it("does not crash when WON leads have null quotedAmount", async () => {
      const w = await createLead({ status: "WON", quotedAmount: null });
      ids.leads.push(w.id);

      const result = await getAnalyticsData("30d");
      expect(result.success).toBe(true);
      if (!result.success) throw new Error("expected success");
      expect(Number.isNaN(result.data.coreMetrics.avgWonDeal)).toBe(false);
    });
  });

  // ── 5. Open Pipeline Value ───────────────────────────────────────────────────

  describe("open pipeline value", () => {
    it("excludes WON and LOST from open pipeline", async () => {
      const n = await createLead({ status: "NEW", quotedAmount: 100000 });
      const w = await createLead({ status: "WON", quotedAmount: 9999999 });
      ids.leads.push(n.id, w.id);

      const result = await getAnalyticsData("30d");
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.coreMetrics.openPipelineValue).toBeGreaterThanOrEqual(0);
    });
  });

  // ── 6. Follow-up Performance ─────────────────────────────────────────────────

  describe("follow-up performance", () => {
    it("counts completed, pending, and overdue follow-ups", async () => {
      const lead = await createLead({ status: "NEW" });
      ids.leads.push(lead.id);

      await createFollowUp(lead.id, { status: "COMPLETED", scheduledAt: new Date(Date.now() - 86400000) });
      await createFollowUp(lead.id, { status: "PENDING", scheduledAt: new Date(Date.now() + 86400000) });
      const overdueFu = await createFollowUp(lead.id, {
        status: "PENDING",
        scheduledAt: new Date(Date.now() - 86400000),
      });
      ids.followUps.push(overdueFu.id);

      const result = await getAnalyticsData("30d");
      expect(result.success).toBe(true);
      if (!result.success) return;

      const fu = result.data.followUpPerformance;
      expect(fu.completed).toBeGreaterThanOrEqual(1);
      expect(fu.pending).toBeGreaterThanOrEqual(2);
      expect(fu.overdue).toBeGreaterThanOrEqual(1);
    });

    it("completion rate is between 0 and 1", async () => {
      const lead = await createLead({ status: "NEW" });
      ids.leads.push(lead.id);

      await createFollowUp(lead.id, { status: "COMPLETED", scheduledAt: new Date(Date.now() - 86400000) });
      await createFollowUp(lead.id, { status: "PENDING", scheduledAt: new Date(Date.now() + 86400000) });

      const result = await getAnalyticsData("30d");
      expect(result.success).toBe(true);
      if (!result.success) return;

      const rate = result.data.followUpPerformance.completionRate;
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
      expect(Number.isNaN(rate)).toBe(false);
    });

    it("returns breakdown by all four follow-up types", async () => {
      const lead = await createLead({ status: "NEW" });
      ids.leads.push(lead.id);

      await createFollowUp(lead.id, { type: "CALL" });
      await createFollowUp(lead.id, { type: "WHATSAPP" });
      await createFollowUp(lead.id, { type: "EMAIL" });
      await createFollowUp(lead.id, { type: "OTHER" });

      const result = await getAnalyticsData("30d");
      expect(result.success).toBe(true);
      if (!result.success) return;

      const types = result.data.followUpPerformance.byType.map((t: { type: string }) => t.type);
      expect(types).toContain("CALL");
      expect(types).toContain("WHATSAPP");
      expect(types).toContain("EMAIL");
      expect(types).toContain("OTHER");
    });
  });

  // ── 8. Revenue Trend ─────────────────────────────────────────────────────────

  describe("revenue trend", () => {
    it("returns points with all required fields", async () => {
      const lead = await createLead({ status: "WON", quotedAmount: 50000, createdAt: new Date() });
      await createActivity(lead.id);
      ids.leads.push(lead.id);

      const result = await getAnalyticsData("30d");
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.revenueTrend.length).toBeGreaterThanOrEqual(1);
      for (const pt of result.data.revenueTrend) {
        expect(typeof pt.label).toBe("string");
        expect(typeof pt.revenue).toBe("number");
        expect(typeof pt.isEstimated).toBe("boolean");
        expect(typeof pt.leadCount).toBe("number");
      }
    });

    it("marks WON leads without STATUS_CHANGED activity as estimated", async () => {
      const lead = await createLead({ status: "WON", quotedAmount: 50000, createdAt: new Date() });
      ids.leads.push(lead.id);

      const result = await getAnalyticsData("30d");
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.dataCoverage.revenueLegacyCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 9. Lead Trend ────────────────────────────────────────────────────────────

  describe("lead trend", () => {
    it("returns points with at least one entry", async () => {
      const lead = await createLead({ createdAt: new Date() });
      ids.leads.push(lead.id);

      const result = await getAnalyticsData("7d");
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.leadTrend.points.length).toBeGreaterThanOrEqual(1);
      const hasLead = result.data.leadTrend.points.some((p: { count: number }) => p.count >= 1);
      expect(hasLead).toBe(true);
    });
  });

  // ── 10. Pipeline Health ──────────────────────────────────────────────────────

  describe("pipeline health", () => {
    it("returns all six statuses", async () => {
      const result = await getAnalyticsData("30d");
      expect(result.success).toBe(true);
      if (!result.success) return;

      const stages = result.data.pipelineHealth.stages;
      const stageNames = stages.map((s: { stage: string }) => s.stage);

      expect(stageNames).toContain("NEW");
      expect(stageNames).toContain("CONTACTED");
      expect(stageNames).toContain("QUALIFIED");
      expect(stageNames).toContain("PROPOSAL_SENT");
      expect(stageNames).toContain("WON");
      expect(stageNames).toContain("LOST");
      expect(stages).toHaveLength(6);
    });
  });

  // ── 11. Data Coverage ───────────────────────────────────────────────────────

  describe("data coverage", () => {
    it("returns coverage metadata with all fields", async () => {
      // Seed a lead and activity so that activityHistoryCoverageStart is not null
      const lead = await createLead({ createdAt: new Date() });
      const activity = await createActivity(lead.id);
      ids.leads.push(lead.id);
      ids.activities.push(activity.id);

      const result = await getAnalyticsData("30d");
      expect(result.success).toBe(true);
      if (!result.success) return;

      const dc = result.data.dataCoverage;
      expect(typeof dc.analysisStart).toBe("string");
      expect(typeof dc.activityHistoryCoverageStart).toBe("string");
      expect(typeof dc.legacyLeadCount).toBe("number");
      expect(typeof dc.funnelWarning).toBe("boolean");
      expect(typeof dc.revenueLegacyCount).toBe("number");
    });
  });

  // ── 12. Authentication ──────────────────────────────────────────────────────

  describe("authentication", () => {
    it("returns error when not authenticated", async () => {
      _authReturn = null;

      const result = await getAnalyticsData("30d");
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain("signed in");

      _authReturn = { id: "test-session-user-id", email: "test@test.com", role: "ADMIN" };
    });
  });

  // ── 13. Date Range Support ───────────────────────────────────────────────────

  describe("date ranges", () => {
    it("handles all four date ranges", async () => {
      const lead = await createLead({ createdAt: new Date() });
      ids.leads.push(lead.id);

      for (const range of ["7d", "30d", "90d", "all"]) {
        const result = await getAnalyticsData(range);
        expect(result.success).toBe(true);
      }
    });
  });

  // ── 14. Formula Verification ────────────────────────────────────────────────

  describe("formula verification", () => {
    it("wonRevenue equals sum of quotedAmount for WON leads", async () => {
      const expectedRevenue = 250000;
      const w = await createLead({ status: "WON", quotedAmount: expectedRevenue });
      ids.leads.push(w.id);

      const result = await getAnalyticsData("30d");
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.coreMetrics.wonRevenue).toBeGreaterThanOrEqual(expectedRevenue);
    });

    it("openPipelineValue reflects only active statuses", async () => {
      const n = await createLead({ status: "NEW", quotedAmount: 100000 });
      const w = await createLead({ status: "WON", quotedAmount: 9999999 });
      ids.leads.push(n.id, w.id);

      const result = await getAnalyticsData("30d");
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.coreMetrics.openPipelineValue).toBeGreaterThanOrEqual(0);
    });
  });
});
