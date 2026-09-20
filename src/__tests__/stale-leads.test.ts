import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getLeads, getLead } from "@/app/actions/leads";
import { getDashboardData } from "@/app/actions/dashboard";
import { LeadStatus, ActivityType } from "@prisma/client";
import {
  calculateLeadStaleness,
  getLastMeaningfulActivity,
  getStaleLeads,
  getStaleLeadsCount,
  STALE_THRESHOLD_DAYS,
} from "@/lib/stale-leads";

const TEST_USER_ID = "test-stale-user-" + Date.now();
const testLeadIds: string[] = [];

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

describe("Stale Lead Auto-Detection - Targeted Verification", () => {
  const now = new Date("2026-09-20T12:00:00.000Z");

  // ============================================================
  // SECTION 1: PURE ISOLATED UNIT TESTS FOR SCENARIOS A - H
  // ============================================================
  describe("Isolated Rule Verification (Scenarios A - H)", () => {
    it("A. NEW lead created 4 days ago with no activity -> STALE", () => {
      const createdAt = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
      const lead = {
        id: "lead-a",
        status: "NEW",
        createdAt,
        activities: [],
      };

      const result = calculateLeadStaleness(lead, now);
      expect(result.isStale).toBe(true);
      expect(result.inactivityDays).toBe(4);
      expect(result.staleLabel).toBe("Stale · No activity for 4 days");
      expect(result.warningMessage).toBe("No meaningful activity for 4 days.");
      expect(result.inactivityText).toBe("4 days ago");
    });

    it("B. CONTACTED lead with meaningful activity 2 days ago -> NOT STALE", () => {
      const createdAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const activityTime = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const lead = {
        id: "lead-b",
        status: "CONTACTED",
        createdAt,
        activities: [
          {
            type: ActivityType.WHATSAPP_OPENED,
            message: "Opened WhatsApp chat with lead",
            createdAt: activityTime,
          },
        ],
      };

      const result = calculateLeadStaleness(lead, now);
      expect(result.isStale).toBe(false);
      expect(result.inactivityDays).toBe(2);
      expect(result.staleLabel).toBe("");
      expect(result.inactivityText).toBe("2 days ago");
    });

    it("C. QUALIFIED lead with last activity 5 days ago -> STALE", () => {
      const createdAt = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      const activityTime = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const lead = {
        id: "lead-c",
        status: "QUALIFIED",
        createdAt,
        activities: [
          {
            type: ActivityType.NOTE_ADDED,
            message: "Qualified budget confirmed",
            createdAt: activityTime,
          },
        ],
      };

      const result = calculateLeadStaleness(lead, now);
      expect(result.isStale).toBe(true);
      expect(result.inactivityDays).toBe(5);
      expect(result.staleLabel).toBe("Stale · No activity for 5 days");
      expect(result.warningMessage).toBe("No meaningful activity for 5 days.");
      expect(result.inactivityText).toBe("5 days ago");
    });

    it("D. PROPOSAL_SENT lead with proposal activity 4 days ago -> STALE with Proposal context", () => {
      const createdAt = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
      const activityTime = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
      const lead = {
        id: "lead-d",
        status: "PROPOSAL_SENT",
        createdAt,
        activities: [
          {
            type: ActivityType.STATUS_CHANGED,
            message: "Status changed to PROPOSAL_SENT with quote",
            createdAt: activityTime,
          },
        ],
      };

      const result = calculateLeadStaleness(lead, now);
      expect(result.isStale).toBe(true);
      expect(result.inactivityDays).toBe(4);
      expect(result.staleLabel).toBe("Stale · Proposal waiting 4 days");
      expect(result.warningMessage).toBe("Proposal has had no follow-up activity for 4 days.");
      expect(result.inactivityText).toBe("4 days ago");
    });

    it("E. WON lead 10 days inactive -> NOT STALE (Terminal status excluded)", () => {
      const createdAt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const activityTime = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const lead = {
        id: "lead-e",
        status: "WON",
        createdAt,
        activities: [
          {
            type: ActivityType.STATUS_CHANGED,
            message: "Status changed to WON",
            createdAt: activityTime,
          },
        ],
      };

      const result = calculateLeadStaleness(lead, now);
      expect(result.isStale).toBe(false);
      expect(result.staleLabel).toBe("");
    });

    it("F. LOST lead 10 days inactive -> NOT STALE (Terminal status excluded)", () => {
      const createdAt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const activityTime = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const lead = {
        id: "lead-f",
        status: "LOST",
        createdAt,
        activities: [
          {
            type: ActivityType.STATUS_CHANGED,
            message: "Status changed to LOST",
            createdAt: activityTime,
          },
        ],
      };

      const result = calculateLeadStaleness(lead, now);
      expect(result.isStale).toBe(false);
      expect(result.staleLabel).toBe("");
    });

    it("G. Waste lead -> EXCLUDED from stale detection", () => {
      const createdAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const lead = {
        id: "lead-g",
        status: "NEW",
        isWaste: true,
        createdAt,
        activities: [],
      };

      const result = calculateLeadStaleness(lead, now);
      expect(result.isStale).toBe(false);
      expect(result.staleLabel).toBe("");
    });

    it("H. Deleted lead -> EXCLUDED from stale detection", () => {
      const createdAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const lead = {
        id: "lead-h",
        status: "NEW",
        deletedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        createdAt,
        activities: [],
      };

      const result = calculateLeadStaleness(lead, now);
      expect(result.isStale).toBe(false);
      expect(result.staleLabel).toBe("");
    });

    it("Follow-up rule: future follow-up does NOT make a lead non-stale", () => {
      // Lead created 5 days ago, future follow-up is tomorrow, but no actual activity logged since creation
      const createdAt = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const futureFollowUp = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
      const lead = {
        id: "lead-future-fu",
        status: "NEW",
        createdAt,
        nextFollowUpDate: futureFollowUp,
        activities: [], // No actual activity since creation
      };

      const result = calculateLeadStaleness(lead, now);
      expect(result.isStale).toBe(true);
      expect(result.inactivityDays).toBe(5);
    });
  });

  // ============================================================
  // SECTION 2: END-TO-END DATABASE INTEGRATION VERIFICATION
  // ============================================================
  describe("Database Integration & End-to-End Flow", () => {
    let leadAId: string;
    let leadBId: string;
    let leadCId: string;
    let leadDId: string;
    let leadEId: string;
    let leadFId: string;
    let leadGId: string;

    beforeAll(async () => {
      await db.user.upsert({
        where: { id: TEST_USER_ID },
        update: {},
        create: {
          id: TEST_USER_ID,
          name: "Stale Test User",
          email: `stale-test-${Date.now()}@example.com`,
          passwordHash: "dummyhash",
          role: "ADMIN",
        },
      });

      vi.mocked(getSession).mockResolvedValue({
        id: TEST_USER_ID,
        email: "stale-test@example.com",
        role: "ADMIN",
      });

      const dbNow = new Date();
      const fourDaysAgo = new Date(dbNow.getTime() - 4 * 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(dbNow.getTime() - 2 * 24 * 60 * 60 * 1000);
      const fiveDaysAgo = new Date(dbNow.getTime() - 5 * 24 * 60 * 60 * 1000);
      const tenDaysAgo = new Date(dbNow.getTime() - 10 * 24 * 60 * 60 * 1000);

      // A. NEW lead created 4 days ago, no activity
      const leadA = await db.lead.create({
        data: {
          name: "Stale Lead A (New 4d)",
          phone: "+919876500001",
          status: LeadStatus.NEW,
          createdAt: fourDaysAgo,
          updatedAt: fourDaysAgo,
        },
      });
      leadAId = leadA.id;
      testLeadIds.push(leadAId);

      // B. CONTACTED lead with meaningful activity 2 days ago
      const leadB = await db.lead.create({
        data: {
          name: "Active Lead B (Contacted 2d)",
          phone: "+919876500002",
          status: LeadStatus.CONTACTED,
          createdAt: tenDaysAgo,
          updatedAt: twoDaysAgo,
        },
      });
      leadBId = leadB.id;
      testLeadIds.push(leadBId);
      await db.leadActivity.create({
        data: {
          leadId: leadBId,
          type: ActivityType.WHATSAPP_OPENED,
          message: "Opened WhatsApp chat with client",
          createdAt: twoDaysAgo,
        },
      });

      // C. QUALIFIED lead with last activity 5 days ago (and pinned!)
      const leadC = await db.lead.create({
        data: {
          name: "Stale Lead C (Qualified 5d)",
          phone: "+919876500003",
          status: LeadStatus.QUALIFIED,
          isPinned: true, // Pinned + Stale + Qualified!
          createdAt: tenDaysAgo,
          updatedAt: fiveDaysAgo,
        },
      });
      leadCId = leadC.id;
      testLeadIds.push(leadCId);
      await db.leadActivity.create({
        data: {
          leadId: leadCId,
          type: ActivityType.NOTE_ADDED,
          message: "Discussed project scope",
          createdAt: fiveDaysAgo,
        },
      });

      // D. PROPOSAL_SENT lead with proposal activity 4 days ago
      const leadD = await db.lead.create({
        data: {
          name: "Stale Lead D (Proposal 4d)",
          phone: "+919876500004",
          status: LeadStatus.PROPOSAL_SENT,
          createdAt: tenDaysAgo,
          updatedAt: fourDaysAgo,
        },
      });
      leadDId = leadD.id;
      testLeadIds.push(leadDId);
      await db.leadActivity.create({
        data: {
          leadId: leadDId,
          type: ActivityType.STATUS_CHANGED,
          message: "Status changed to PROPOSAL_SENT",
          createdAt: fourDaysAgo,
        },
      });

      // E. WON lead 10 days inactive
      const leadE = await db.lead.create({
        data: {
          name: "Won Lead E",
          phone: "+919876500005",
          status: LeadStatus.WON,
          createdAt: tenDaysAgo,
          updatedAt: tenDaysAgo,
        },
      });
      leadEId = leadE.id;
      testLeadIds.push(leadEId);

      // F. LOST lead 10 days inactive
      const leadF = await db.lead.create({
        data: {
          name: "Lost Lead F",
          phone: "+919876500006",
          status: LeadStatus.LOST,
          createdAt: tenDaysAgo,
          updatedAt: tenDaysAgo,
        },
      });
      leadFId = leadF.id;
      testLeadIds.push(leadFId);

      // G. Waste lead
      const leadG = await db.lead.create({
        data: {
          name: "Waste Lead G",
          phone: "+919876500007",
          status: LeadStatus.NEW,
          isWaste: true,
          createdAt: tenDaysAgo,
          updatedAt: tenDaysAgo,
        },
      });
      leadGId = leadG.id;
      testLeadIds.push(leadGId);
    });

    afterAll(async () => {
      if (testLeadIds.length > 0) {
        await db.leadActivity.deleteMany({ where: { leadId: { in: testLeadIds } } });
        await db.followUp.deleteMany({ where: { leadId: { in: testLeadIds } } });
        await db.lead.deleteMany({ where: { id: { in: testLeadIds } } });
      }
      await db.user.delete({ where: { id: TEST_USER_ID } }).catch(() => {});
    });

    it("getLeads serializes leads with accurate centralized staleInfo", async () => {
      const res = await getLeads();
      expect(res.success).toBe(true);
      if (!res.success) return;

      const leadA = res.data.find((l) => l.id === leadAId);
      const leadB = res.data.find((l) => l.id === leadBId);
      const leadC = res.data.find((l) => l.id === leadCId);
      const leadD = res.data.find((l) => l.id === leadDId);
      const leadE = res.data.find((l) => l.id === leadEId);
      const leadF = res.data.find((l) => l.id === leadFId);

      // Lead A: STALE
      expect(leadA).toBeDefined();
      expect(leadA?.staleInfo?.isStale).toBe(true);
      expect(leadA?.staleInfo?.inactivityDays).toBeGreaterThanOrEqual(3);
      expect(leadA?.staleInfo?.staleLabel).toMatch(/Stale · No activity for \d+ days/);

      // Lead B: NOT STALE
      expect(leadB).toBeDefined();
      expect(leadB?.staleInfo?.isStale).toBe(false);

      // Lead C: Pinned + Stale + Qualified!
      expect(leadC).toBeDefined();
      expect(leadC?.isPinned).toBe(true);
      expect(leadC?.status).toBe("Qualified");
      expect(leadC?.staleInfo?.isStale).toBe(true);
      expect(leadC?.staleInfo?.inactivityDays).toBeGreaterThanOrEqual(5);

      // Lead D: PROPOSAL_SENT with proposal context
      expect(leadD).toBeDefined();
      expect(leadD?.staleInfo?.isStale).toBe(true);
      expect(leadD?.staleInfo?.staleLabel).toMatch(/Stale · Proposal waiting \d+ days/);
      expect(leadD?.staleInfo?.warningMessage).toMatch(/Proposal has had no follow-up activity for \d+ days\./);

      // Lead E: WON -> NOT STALE
      expect(leadE).toBeDefined();
      expect(leadE?.staleInfo?.isStale).toBe(false);

      // Lead F: LOST -> NOT STALE
      expect(leadF).toBeDefined();
      expect(leadF?.staleInfo?.isStale).toBe(false);
    });

    it("Stale filter returns only stale leads", async () => {
      const res = await getLeads();
      expect(res.success).toBe(true);
      if (!res.success) return;

      const staleOnly = res.data.filter((l) => l.staleInfo?.isStale);
      const staleIds = staleOnly.map((l) => l.id);

      expect(staleIds).toContain(leadAId);
      expect(staleIds).toContain(leadCId);
      expect(staleIds).toContain(leadDId);
      expect(staleIds).not.toContain(leadBId);
      expect(staleIds).not.toContain(leadEId);
      expect(staleIds).not.toContain(leadFId);
      expect(staleIds).not.toContain(leadGId);
    });

    it("Most Stale First sort orders higher inactivity first while preserving pin independence", async () => {
      const res = await getLeads();
      expect(res.success).toBe(true);
      if (!res.success) return;

      const relevant = res.data.filter((l) => [leadAId, leadBId, leadCId, leadDId].includes(l.id));

      const sorted = [...relevant].sort((a, b) => {
        // Pinned on top
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

        // Most stale first
        const aDays = a.staleInfo?.inactivityDays ?? 0;
        const bDays = b.staleInfo?.inactivityDays ?? 0;
        return bDays - aDays;
      });

      // Lead C is pinned, so it remains at index 0
      expect(sorted[0].id).toBe(leadCId);
      expect(sorted[0].isPinned).toBe(true);

      // Non-pinned leads: Lead A and Lead D (4 days) come before Lead B (2 days)
      const nonPinned = sorted.filter((l) => !l.isPinned);
      expect(nonPinned[nonPinned.length - 1].id).toBe(leadBId);
    });

    it("Lead Detail shows correct inactivity age and warning message", async () => {
      const resD = await getLead(leadDId);
      expect(resD.success).toBe(true);
      if (!resD.success) return;

      expect(resD.data.staleInfo?.isStale).toBe(true);
      expect(resD.data.staleInfo?.inactivityText).toMatch(/\d+ days ago/);
      expect(resD.data.staleInfo?.warningMessage).toMatch(/Proposal has had no follow-up activity for \d+ days\./);

      const resA = await getLead(leadAId);
      expect(resA.success).toBe(true);
      if (!resA.success) return;

      expect(resA.data.staleInfo?.isStale).toBe(true);
      expect(resA.data.staleInfo?.warningMessage).toMatch(/No meaningful activity for \d+ days\./);
    });

    it("Pipeline cards match Leads workspace stale information identically", async () => {
      // In this CRM, PipelinePage loads data through the exact same getLeads()
      const res = await getLeads();
      expect(res.success).toBe(true);
      if (!res.success) return;

      for (const lead of res.data) {
        if ([leadAId, leadBId, leadCId, leadDId].includes(lead.id)) {
          const directCheck = calculateLeadStaleness(lead);
          expect(lead.staleInfo?.isStale).toBe(directCheck.isStale);
          expect(lead.staleInfo?.staleLabel).toBe(directCheck.staleLabel);
        }
      }
    });

    it("Dashboard shortcut count reflects total active stale leads", async () => {
      const dashboardRes = await getDashboardData();
      expect(dashboardRes.success).toBe(true);
      if (!dashboardRes.success || !dashboardRes.data) return;

      const directStaleCount = await getStaleLeadsCount();
      expect(dashboardRes.data.kpis.staleLeads).toBe(directStaleCount);
      expect(dashboardRes.data.kpis.staleLeads).toBeGreaterThanOrEqual(3);
    });

    it("Determinism: page refresh does not change stale calculation without state mutation", async () => {
      const first = await getLeads();
      const second = await getLeads();
      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      if (!first.success || !second.success) return;

      const firstLeadC = first.data.find((l) => l.id === leadCId);
      const secondLeadC = second.data.find((l) => l.id === leadCId);

      expect(firstLeadC?.staleInfo?.isStale).toBe(secondLeadC?.staleInfo?.isStale);
      expect(firstLeadC?.staleInfo?.inactivityDays).toBe(secondLeadC?.staleInfo?.inactivityDays);
    });
  });
});
