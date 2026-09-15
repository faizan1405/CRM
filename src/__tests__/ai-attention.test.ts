import fs from "node:fs";
import path from "node:path";

// Ensure environment variables from .env.local and .env are loaded for Prisma
for (const envFile of [".env.local", ".env"]) {
  const p = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(p)) {
    const lines = fs.readFileSync(p, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const rawVal = trimmed.slice(eqIdx + 1).trim();
        const val = rawVal.replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

import { describe, it, expect, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import {
  computeLeadFactsSync,
} from "@/features/ai-attention/services/lead-facts";
import {
  applyDeterministicSafetyRules,
  analyzeLead,
  batchAnalyzeLeads,
  markLeadAIInsightNeedsRefresh,
} from "@/features/ai-attention/services/attention-engine";
import {
  deriveDashboardAttentionLeads,
} from "@/features/ai-attention/helpers";
import {
  getScoreCategory,
  type CalculatedLeadFacts,
} from "@/features/ai-attention/types";
import { STALE_THRESHOLDS_DAYS } from "@/features/ai-attention/constants";
import * as groqClient from "@/lib/ai/groq-client";
import { ActivityType, LeadStatus } from "@prisma/client";
import type { LeadStatus as FrontendLeadStatus } from "@/features/leads/types";

// Mock Auth Session for authenticated server actions
const mockUser = {
  id: "test-attention-agent-user",
  email: "attention@test.com",
  role: "ADMIN",
};

vi.mock("@/lib/auth", () => ({
  getSession: async () => mockUser,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Phase 8: AI Attention Engine Backend", () => {
  const testLeadIds: string[] = [];

  afterAll(async () => {
    // Controlled cleanup of all created test leads and cascades
    if (testLeadIds.length > 0) {
      await db.lead.deleteMany({
        where: { id: { in: testLeadIds } },
      });
    }
  });

  describe("1. Score Categories & Rubric Constants", () => {
    it("correctly maps 0-100 score bands to Hot, Warm, Cold", () => {
      expect(getScoreCategory(100)).toBe("hot");
      expect(getScoreCategory(80)).toBe("hot");
      expect(getScoreCategory(79)).toBe("warm");
      expect(getScoreCategory(50)).toBe("warm");
      expect(getScoreCategory(49)).toBe("cold");
      expect(getScoreCategory(0)).toBe("cold");
    });

    it("has expected centralized stale thresholds for active stages", () => {
      expect(STALE_THRESHOLDS_DAYS.NEW).toBe(1);
      expect(STALE_THRESHOLDS_DAYS.CONTACTED).toBe(2);
      expect(STALE_THRESHOLDS_DAYS.QUALIFIED).toBe(3);
      expect(STALE_THRESHOLDS_DAYS.PROPOSAL_SENT).toBe(2);
    });
  });

  describe("2. Deterministic Facts & Stale Detection", () => {
    it("Scenario A: detects New lead with no contact and computes stage aging", () => {
      const now = new Date();
      const facts = computeLeadFactsSync({
        id: "lead-new-a",
        name: "Test New Lead",
        status: "NEW",
        budget: 15000,
        quotedAmount: null,
        createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000), // 3 hours ago
        updatedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
        lastContactDate: null,
      });

      expect(facts.status).toBe("NEW");
      expect(facts.isStale).toBe(false); // under 1 day threshold
      expect(facts.stageAgeEstimated).toBe(false);
      expect(facts.stageAgeText).toContain("3 hours");
      expect(facts.hasOverdueFollowUp).toBe(false);
    });

    it("Scenario F: identifies Stale lead when exceeding stage threshold", () => {
      const now = new Date();
      // Contacted lead without contact for 3 days (threshold is 2 days)
      const facts = computeLeadFactsSync({
        id: "lead-stale-f",
        name: "Test Stale Lead",
        status: "CONTACTED",
        budget: 25000,
        quotedAmount: null,
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        lastContactDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      });

      expect(facts.isStale).toBe(true);
      expect(facts.staleFor).toBe("No contact for 3 days");
    });


    it("Scenario I: handles legacy lead with no status change history via estimated fallback", () => {
      const now = new Date();
      const facts = computeLeadFactsSync({
        id: "lead-legacy-i",
        name: "Legacy Lead",
        status: "QUALIFIED",
        budget: null,
        quotedAmount: null,
        createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        lastContactDate: null,
        activities: [], // No STATUS_CHANGED activity present
      });

      expect(facts.stageAgeEstimated).toBe(true);
      expect(facts.stageAgeDays).toBeGreaterThanOrEqual(4);
    });
  });

  describe("3. Deterministic Safety Rules", () => {
    it("Scenario E: upgrades priority to CRITICAL when follow-up is overdue", () => {
      const now = new Date();
      const facts: CalculatedLeadFacts = {
        leadId: "lead-overdue-e",
        name: "Overdue Lead",
        status: "QUALIFIED",
        budget: 40000,
        quotedAmount: null,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        lastContactAt: now,
        isStale: false,
        staleFor: "Active",
        durationWithoutContact: "0 hours",
        stageEnteredAt: now,
        stageAgeDays: 1,
        stageAgeText: "1 day",
        stageAgeEstimated: false,
        hasOverdueFollowUp: true,
        overdueFollowUpCount: 1,
        overdueHours: 5,
        pendingFollowUpCount: 1,
        nextFollowUpAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
        completedFollowUpCount: 0,
        recentNotes: [],
        recentActivitiesSummary: [],
      };

      // Even if raw LLM returned NORMAL, safety rules must UPGRADE to CRITICAL
      const safe = applyDeterministicSafetyRules(
        {
          score: 75,
          priority: "NORMAL",
          scoreReason: "Good qualified lead",
          recommendedAction: "Wait for client",
          recommendedActionType: "CALL",
        },
        facts
      );

      expect(safe.priority).toBe("CRITICAL");
      expect(safe.scoreReason).toContain("Critical");
      expect(safe.recommendedAction.toLowerCase()).toContain("overdue");
    });

    it("Scenario G & H: forces terminal leads (WON/LOST) to NORMAL priority and bounds scores", () => {
      const now = new Date();
      const baseFacts: CalculatedLeadFacts = {
        leadId: "lead-terminal",
        name: "Won Lead",
        status: "WON",
        budget: 50000,
        quotedAmount: 50000,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        lastContactAt: now,
        isStale: false,
        staleFor: "Closed Won",
        durationWithoutContact: "0 hours",
        stageEnteredAt: now,
        stageAgeDays: 2,
        stageAgeText: "2 days",
        stageAgeEstimated: false,
        hasOverdueFollowUp: false,
        overdueFollowUpCount: 0,
        overdueHours: 0,
        pendingFollowUpCount: 0,
        nextFollowUpAt: null,
        completedFollowUpCount: 2,
        recentNotes: [],
        recentActivitiesSummary: [],
      };

      // Won lead
      const wonSafe = applyDeterministicSafetyRules(
        {
          score: 85,
          priority: "CRITICAL",
          scoreReason: "Closed deal",
          recommendedAction: "Onboard",
          recommendedActionType: "OTHER",
        },
        baseFacts
      );
      expect(wonSafe.priority).toBe("NORMAL");
      expect(wonSafe.score).toBeGreaterThanOrEqual(90);

      // Lost lead
      const lostFacts = { ...baseFacts, status: "LOST", staleFor: "Closed Lost" };
      const lostSafe = applyDeterministicSafetyRules(
        {
          score: 40,
          priority: "CRITICAL",
          scoreReason: "Client selected competitor",
          recommendedAction: "Archive",
          recommendedActionType: "OTHER",
        },
        lostFacts
      );
      expect(lostSafe.priority).toBe("NORMAL");
      expect(lostSafe.score).toBeLessThanOrEqual(20);
    });

    it("clamps any out-of-bounds scores to 0-100", () => {
      const now = new Date();
      const facts: CalculatedLeadFacts = {
        leadId: "clamp-test",
        name: "Test",
        status: "CONTACTED",
        budget: null,
        quotedAmount: null,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        lastContactAt: now,
        isStale: false,
        staleFor: "Active",
        durationWithoutContact: "0 hours",
        stageEnteredAt: now,
        stageAgeDays: 0,
        stageAgeText: "0 hours",
        stageAgeEstimated: false,
        hasOverdueFollowUp: false,
        overdueFollowUpCount: 0,
        overdueHours: 0,
        pendingFollowUpCount: 0,
        nextFollowUpAt: null,
        completedFollowUpCount: 0,
        recentNotes: [],
        recentActivitiesSummary: [],
      };

      const high = applyDeterministicSafetyRules(
        { score: 120, priority: "NORMAL", scoreReason: "Over", recommendedAction: "Call", recommendedActionType: "CALL" },
        facts
      );
      expect(high.score).toBe(100);

      const low = applyDeterministicSafetyRules(
        { score: -15, priority: "NORMAL", scoreReason: "Under", recommendedAction: "Call", recommendedActionType: "CALL" },
        facts
      );
      expect(low.score).toBe(0);
    });

  });

  describe("4. End-to-End Database Operations & Scenarios A-D", () => {
    it("Scenario B & C: creates lead with activity, analyzes insight and stores snapshot in Neon", async () => {
      // Create a controlled qualified lead
      const lead = await db.lead.create({
        data: {
          name: "Amit Patel Logistics",
          phone: "+91 99001 12233",
          email: "amit@patellogistics.in",
          business: "Patel Logistics Pvt Ltd",
          budget: 65000,
          status: LeadStatus.QUALIFIED,
          quotedAmount: 60000,
        },
      });
      testLeadIds.push(lead.id);

      await db.leadActivity.create({
        data: {
          leadId: lead.id,
          type: ActivityType.LEAD_CREATED,
          message: "Lead created via CRM intake",
        },
      });

      // Analyze lead (using fallback if Groq API key is test stub, or real Groq if configured)
      const insight = await analyzeLead(lead.id, { force: true });
      expect(insight).not.toBeNull();
      expect(insight?.leadId).toBe(lead.id);
      expect(insight?.score).toBeGreaterThanOrEqual(50); // Qualified lead with 65k budget is at least warm
      expect(insight?.score).toBeLessThanOrEqual(100);
      expect(["CRITICAL", "IMPORTANT", "NORMAL"]).toContain(insight?.priority);
      expect(insight?.scoreReason.length).toBeGreaterThan(5);
      expect(insight?.recommendedAction.length).toBeGreaterThan(3);
      expect(insight?.needsRefresh).toBe(false);

      // Verify insight exists in DB
      const dbInsight = await db.leadAIInsight.findUnique({
        where: { leadId: lead.id },
      });
      expect(dbInsight).not.toBeNull();
      expect(dbInsight?.score).toBe(insight?.score);
    });

    it("Scenario D: analyzes high-value Proposal Sent lead", async () => {
      const lead = await db.lead.create({
        data: {
          name: "Suresh Infrastructure",
          phone: "+91 98220 33445",
          business: "Suresh Infra Projects",
          budget: 250000,
          quotedAmount: 220000,
          status: LeadStatus.PROPOSAL_SENT,
        },
      });
      testLeadIds.push(lead.id);

      const insight = await analyzeLead(lead.id, { force: true });
      expect(insight).not.toBeNull();
      // High value proposal sent should be hot or strong warm
      expect(insight!.score).toBeGreaterThanOrEqual(70);
      expect(insight!.scoreReason).toBeDefined();
    });

    it("Scenario G & H in Attention Queue: excludes WON and LOST leads from active attention queue", async () => {
      const wonLead = await db.lead.create({
        data: {
          name: "Closed Won Deal",
          phone: "+91 98888 11111",
          status: LeadStatus.WON,
          budget: 100000,
          quotedAmount: 100000,
        },
      });
      testLeadIds.push(wonLead.id);

      const lostLead = await db.lead.create({
        data: {
          name: "Closed Lost Deal",
          phone: "+91 98888 22222",
          status: LeadStatus.LOST,
        },
      });
      testLeadIds.push(lostLead.id);

      // Format leads as Lead type for helper
      const leadsForQueue = [
        {
          id: wonLead.id,
          name: wonLead.name,
          phone: wonLead.phone,
          email: "",
          business: "",
          industry: "",
          source: "",
          budget: 100000,
          status: "Won" as FrontendLeadStatus,
          quotedAmount: 100000,
          lastContactDate: null,
          nextFollowUpDate: null,
          notes: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: lostLead.id,
          name: lostLead.name,
          phone: lostLead.phone,
          email: "",
          business: "",
          industry: "",
          source: "",
          budget: null,
          status: "Lost" as FrontendLeadStatus,
          quotedAmount: null,
          lastContactDate: null,
          nextFollowUpDate: null,
          notes: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const queue = deriveDashboardAttentionLeads(leadsForQueue);
      expect(queue.length).toBe(0); // Both WON and LOST MUST be excluded!
    });
  });

  describe("5. AI Failure Simulation & Resilience (Scenario J)", () => {
    it("preserves previous insight and keeps needsRefresh = true when Groq fails", async () => {
      const lead = await db.lead.create({
        data: {
          name: "Failure Resilience Lead",
          phone: "+91 97777 66666",
          status: LeadStatus.CONTACTED,
          budget: 35000,
        },
      });
      testLeadIds.push(lead.id);

      // 1. Initial valid analysis
      const initial = await analyzeLead(lead.id, { force: true });
      expect(initial).not.toBeNull();
      const initialScore = initial!.score;

      // Mark needs refresh
      await markLeadAIInsightNeedsRefresh(lead.id);

      // 2. Simulate Groq network failure
      const spy = vi.spyOn(groqClient, "requestGroqJson").mockRejectedValueOnce(
        new Error("Groq API 503 Service Unavailable")
      );

      // Analyze again during failure
      const afterFailure = await analyzeLead(lead.id, { force: true });

      // Check: Previous insight preserved, needsRefresh remains true, no crash
      expect(afterFailure).not.toBeNull();
      expect(afterFailure!.score).toBe(initialScore);
      expect(afterFailure!.needsRefresh).toBe(true);

      spy.mockRestore();
    });
  });

  describe("6. Automatic Refresh Trigger & Batch Processing", () => {
    it("marks lead AI insight needsRefresh = true when state changes", async () => {
      const lead = await db.lead.create({
        data: {
          name: "Refresh Test Lead",
          phone: "+91 95555 44444",
          status: LeadStatus.NEW,
        },
      });
      testLeadIds.push(lead.id);

      await analyzeLead(lead.id, { force: true });

      let insight = await db.leadAIInsight.findUnique({ where: { leadId: lead.id } });
      expect(insight?.needsRefresh).toBe(false);

      // Call refresh trigger (e.g. after note or follow-up change)
      await markLeadAIInsightNeedsRefresh(lead.id);

      insight = await db.leadAIInsight.findUnique({ where: { leadId: lead.id } });
      expect(insight?.needsRefresh).toBe(true);
    });

    it("runs batch analysis on leads needing refresh", async () => {
      const result = await batchAnalyzeLeads({ limit: 5, concurrency: 2 });
      expect(result).toHaveProperty("analyzed");
      expect(result).toHaveProperty("skipped");
      expect(result).toHaveProperty("errors");
      expect(typeof result.analyzed).toBe("number");
    });
  });
});
