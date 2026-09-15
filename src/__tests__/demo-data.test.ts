import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { seedDemoLeads, clearDemoLeads, DEMO_TAG } from "@/features/demo-data/demo-seed";
import { deleteAllLeadsAction } from "@/app/actions/leads";
import { getDashboardData } from "@/app/actions/dashboard";
import { db } from "@/lib/db";

const mockUser = {
  id: "test-demo-data-user-id",
  name: "Demo Data Tester",
  email: "demo-data-test@test.com",
  role: "ADMIN",
};

vi.mock("@/lib/auth", () => ({
  getSession: async () => mockUser,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Demo Data & Production Purge", () => {
  beforeAll(async () => {
    const existingUser = await db.user.findUnique({ where: { email: mockUser.email } });
    if (!existingUser) {
      await db.user.create({
        data: {
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          passwordHash: "test_hash_demo",
          role: "ADMIN",
        },
      });
    }
  });

  afterAll(async () => {
    // Clean up any remaining demo leads
    await clearDemoLeads();
    // Clean up any remaining real leads (safety)
    const remainingLeads = await db.lead.findMany({ where: { name: { not: { startsWith: DEMO_TAG } } }, select: { id: true } });
    if (remainingLeads.length > 0) {
      const ids = remainingLeads.map(l => l.id);
      await db.salesNotification.deleteMany({ where: { leadId: { in: ids } } });
      await db.leadLossEvent.deleteMany({ where: { leadId: { in: ids } } });
      await db.followUp.deleteMany({ where: { leadId: { in: ids } } });
      await db.leadActivity.deleteMany({ where: { leadId: { in: ids } } });
      await db.leadAIInsight.deleteMany({ where: { leadId: { in: ids } } });
      await db.lead.deleteMany({ where: { id: { in: ids } } });
    }
    await db.user.deleteMany({ where: { email: mockUser.email } });
    await db.$disconnect();
  });

  // ============================================================
  // 1. seedDemoLeads creates exactly 10
  // ============================================================
  describe("seedDemoLeads", () => {
    it("creates exactly 10 demo leads with dependent records", async () => {
      const result = await seedDemoLeads(mockUser.id);
      expect(result.createdCount).toBe(10);

      const allLeads = await db.lead.findMany({
        where: { name: { startsWith: DEMO_TAG } },
        include: { activities: true, aiInsight: true, followUps: true, lossEvents: true },
      });
      expect(allLeads).toHaveLength(10);
      for (const lead of allLeads) {
        expect(lead.name.startsWith(DEMO_TAG)).toBe(true);
        expect(lead.email).toContain(".demo@example.com");
        expect(lead.activities.length).toBeGreaterThanOrEqual(1);
        expect(lead.aiInsight).not.toBeNull();
      }
    });

    it("is idempotent - no duplicates on re-run", async () => {
      const result = await seedDemoLeads(mockUser.id);
      expect(result.createdCount).toBe(10);

      const allLeads = await db.lead.findMany({
        where: { name: { startsWith: DEMO_TAG } },
      });
      expect(allLeads).toHaveLength(10);
    });
  });

  // ============================================================
  // 2. clearDemoLeads removes only demo leads
  // ============================================================
  describe("clearDemoLeads", () => {
    it("removes exactly 10 demo leads and their dependent records", async () => {
      await seedDemoLeads(mockUser.id);

      const beforeActivities = await db.leadActivity.count();
      const beforeInsights = await db.leadAIInsight.count();
      const beforeFollowUps = await db.followUp.count();
      const beforeLossEvents = await db.leadLossEvent.count();

      const result = await clearDemoLeads();
      expect(result.deletedCount).toBe(10);

      const afterLeads = await db.lead.findMany({ where: { name: { startsWith: DEMO_TAG } } });
      expect(afterLeads).toHaveLength(0);

      // Dependent records should be removed
      const afterActivities = await db.leadActivity.count();
      const afterInsights = await db.leadAIInsight.count();
      const afterFollowUps = await db.followUp.count();
      const afterLossEvents = await db.leadLossEvent.count();

      expect(afterActivities).toBeLessThan(beforeActivities);
      expect(afterInsights).toBeLessThan(beforeInsights);
      expect(afterFollowUps).toBeLessThan(beforeFollowUps);
      expect(afterLossEvents).toBeLessThan(beforeLossEvents);
    });
  });

  // ============================================================
  // 3. clearDemoLeads leaves real leads untouched
  // ============================================================
  describe("clearDemoLeads isolation", () => {
    it("does not touch non-demo leads", async () => {
      // Create a real lead
      const realLead = await db.lead.create({
        data: {
          name: "Real Client Person",
          phone: "+91 90000 00000",
          email: "real.client@example.com",
          business: "Real Business",
          status: "NEW",
          activities: {
            create: {
              type: "LEAD_CREATED",
              message: "Real lead created",
              createdByUserId: mockUser.id,
            },
          },
        },
        include: { activities: true },
      });

      // Seed demo leads
      await seedDemoLeads(mockUser.id);

      // Clear only demo leads
      await clearDemoLeads();

      // Verify real lead is untouched
      const realLeadAfter = await db.lead.findUnique({ where: { id: realLead.id } });
      expect(realLeadAfter).not.toBeNull();
      expect(realLeadAfter?.name).toBe("Real Client Person");
      expect(realLeadAfter?.email).toBe("real.client@example.com");

      const realActivities = await db.leadActivity.findMany({ where: { leadId: realLead.id } });
      expect(realActivities.length).toBeGreaterThanOrEqual(1);

      // Verify demo leads are gone
      const demoLeads = await db.lead.findMany({ where: { name: { startsWith: DEMO_TAG } } });
      expect(demoLeads).toHaveLength(0);
    });
  });

  // ============================================================
  // 4. deleteAllLeadsAction removes everything
  // ============================================================
  describe("deleteAllLeadsAction", () => {
    it("purges all leads and dependent records", async () => {
      // Seed demo leads
      await seedDemoLeads(mockUser.id);

      // Create a real lead too
      const realLead = await db.lead.create({
        data: {
          name: "Another Real Lead",
          phone: "+91 90000 00001",
          status: "QUALIFIED",
        },
      });

      const leadCountBefore = await db.lead.count();
      expect(leadCountBefore).toBeGreaterThan(0);

      const result = await deleteAllLeadsAction();
      expect(result.success).toBe(true);
      expect(result.leadCount).toBeGreaterThanOrEqual(1);

      const leadCountAfter = await db.lead.count();
      expect(leadCountAfter).toBe(0);

      const followUpCountAfter = await db.followUp.count();
      expect(followUpCountAfter).toBe(0);

      const activityCountAfter = await db.leadActivity.count();
      expect(activityCountAfter).toBe(0);

      const insightCountAfter = await db.leadAIInsight.count();
      expect(insightCountAfter).toBe(0);

      const lossEventCountAfter = await db.leadLossEvent.count();
      expect(lossEventCountAfter).toBe(0);

      // Clean up the real lead we just created (already deleted by the action, just verify)
      const check = await db.lead.findUnique({ where: { id: realLead.id } });
      expect(check).toBeNull();
    });
  });

  // ============================================================
  // 5. Dashboard renders empty state with 0 leads
  // ============================================================
  describe("Dashboard empty state", () => {
    it("getDashboardData returns zero counts when no leads exist", async () => {
      await deleteAllLeadsAction();

      const result = await getDashboardData();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      const { kpis, pipeline, needsAttention } = result.data!;
      expect(kpis.totalLeads).toBe(0);
      expect(kpis.newLeads).toBe(0);
      expect(kpis.qualifiedLeads).toBe(0);
      expect(kpis.wonClients).toBe(0);
      expect(kpis.followUpsToday).toBe(0);
      expect(kpis.wonRevenue).toBe(0);

      expect(pipeline.new).toBe(0);
      expect(pipeline.contacted).toBe(0);
      expect(pipeline.qualified).toBe(0);
      expect(pipeline.proposal).toBe(0);
      expect(pipeline.won).toBe(0);
      expect(pipeline.lost).toBe(0);

      expect(needsAttention.overdueFollowUps).toBe(0);
      expect(needsAttention.proposalsPending).toBe(0);
      expect(needsAttention.leadsNotContacted).toBe(0);

      expect(result.data!.priorities).toHaveLength(0);
      expect(result.data!.attentionLeads).toHaveLength(0);
      expect(result.data!.todayFollowUps).toHaveLength(0);
      expect(result.data!.recentActivity).toHaveLength(0);
    });
  });
});
