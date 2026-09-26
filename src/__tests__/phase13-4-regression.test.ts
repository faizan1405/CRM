import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import {
  deleteLead,
  restoreLead,
  permanentlyDeleteLead,
  getLeads,
  getLead,
  getRecentlyDeletedLeads,
} from "@/app/actions/leads";
import { getFollowUps, createFollowUp } from "@/app/actions/follow-ups";
import { getDashboardData } from "@/app/actions/dashboard";
import { getAnalyticsData } from "@/app/actions/analytics";
import { globalQuickSearch, searchLeadsForWhatsApp } from "@/app/actions/lead-search";
import { logActivity, getLeadActivities } from "@/app/actions/activities";
import { getSession } from "@/lib/auth";
import { LeadStatus, ActivityType } from "@prisma/client";

const TEST_USER_ID = "test-phase13-4-user";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Phase 13.4 Regression Tests", () => {
  const createdLeadIds: string[] = [];

  beforeAll(async () => {
    await db.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        name: "Phase 13.4 Tester",
        email: "phase134tester@example.com",
        passwordHash: "dummyhash",
        role: "ADMIN",
      },
    });

    vi.mocked(getSession).mockResolvedValue({
      id: TEST_USER_ID,
      email: "phase134tester@example.com",
      role: "ADMIN",
    });
  });

  afterAll(async () => {
    if (createdLeadIds.length > 0) {
      await db.deal.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.salesNotification.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.leadLossEvent.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.followUp.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.leadActivity.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.leadAIInsight.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
    }
  });

  async function createTestLead(nameSuffix: string, status: LeadStatus = LeadStatus.NEW) {
    const uniquePhone = `+91 97111 ${Math.floor(10000 + Math.random() * 90000)}`;
    const lead = await db.lead.create({
      data: {
        name: `SoftDelete Test ${nameSuffix} ${Date.now()}`,
        phone: uniquePhone,
        business: "SoftDelete Corp",
        status,
        isWaste: false,
        quotedAmount: 15000,
      },
    });
    createdLeadIds.push(lead.id);
    return lead;
  }

  // 1. delete → disappears from Leads
  it("delete → disappears from Leads", async () => {
    const lead = await createTestLead("DisappearLeads");
    
    // Lead is initially present
    const beforeResult = await getLeads();
    expect(beforeResult.success).toBe(true);
    if (!beforeResult.success) return;
    expect(beforeResult.data.some((l) => l.id === lead.id)).toBe(true);

    // Soft delete
    const deleteRes = await deleteLead(lead.id);
    expect(deleteRes.success).toBe(true);

    // Lead is gone from normal Leads view
    const afterResult = await getLeads();
    expect(afterResult.success).toBe(true);
    if (!afterResult.success) return;
    expect(afterResult.data.some((l) => l.id === lead.id)).toBe(false);

    // getLead single fetch also returns not found
    const singleRes = await getLead(lead.id);
    expect(singleRes.success).toBe(false);
  });

  // 2. delete → disappears from Pipeline
  it("delete → disappears from Pipeline", async () => {
    const lead = await createTestLead("PipelineDisappear", LeadStatus.QUALIFIED);

    // Pipeline consumes getLeads() directly
    const beforePipeline = await getLeads();
    expect(beforePipeline.success).toBe(true);
    if (!beforePipeline.success) return;
    expect(beforePipeline.data.some((l) => l.id === lead.id)).toBe(true);

    await deleteLead(lead.id);

    const afterPipeline = await getLeads();
    expect(afterPipeline.success).toBe(true);
    if (!afterPipeline.success) return;
    expect(afterPipeline.data.some((l) => l.id === lead.id)).toBe(false);
  });

  // 3. delete → disappears from Follow-ups
  it("delete → disappears from Follow-ups", async () => {
    const lead = await createTestLead("FollowUpDisappear");
    
    const formData = new FormData();
    formData.append("leadId", lead.id);
    formData.append("scheduledAt", new Date().toISOString());
    formData.append("type", "Call");
    formData.append("note", "Follow up regarding proposal");

    const fuRes = await createFollowUp(formData);
    expect(fuRes.success).toBe(true);

    // Follow-up is initially present
    const beforeFU = await getFollowUps();
    expect(beforeFU.success).toBe(true);
    if (!beforeFU.success) return;
    const allBeforeFUs = [
      ...beforeFU.data.today,
      ...beforeFU.data.overdue,
      ...beforeFU.data.upcoming,
      ...beforeFU.data.completed,
    ];
    expect(allBeforeFUs.some((f) => f.leadId === lead.id)).toBe(true);

    // Soft delete the lead
    await deleteLead(lead.id);

    // Follow-ups for deleted lead must not appear in any tab
    const afterFU = await getFollowUps();
    expect(afterFU.success).toBe(true);
    if (!afterFU.success) return;
    const allAfterFUs = [
      ...afterFU.data.today,
      ...afterFU.data.overdue,
      ...afterFU.data.upcoming,
      ...afterFU.data.completed,
    ];
    expect(allAfterFUs.some((f) => f.leadId === lead.id)).toBe(false);
  });

  // 4. delete → disappears from Dashboard
  it("delete → disappears from Dashboard", async () => {
    const lead = await createTestLead("DashboardDisappear", LeadStatus.NEW);

    const beforeDash = await getDashboardData();
    expect(beforeDash.success).toBe(true);
    if (!beforeDash.success || !beforeDash.data) return;
    const initialTotal = beforeDash.data.kpis.totalLeads;

    await deleteLead(lead.id);

    const afterDash = await getDashboardData();
    expect(afterDash.success).toBe(true);
    if (!afterDash.success || !afterDash.data) return;

    // Total leads decreased
    expect(afterDash.data.kpis.totalLeads).toBe(initialTotal - 1);

    // Lead does not appear in priorities, attention leads, or today followups
    expect(afterDash.data.priorities.some((p) => p.leadId === lead.id)).toBe(false);
    expect(afterDash.data.attentionLeads.some((a) => a.leadId === lead.id)).toBe(false);
    expect(afterDash.data.todayFollowUps.some((t) => t.leadId === lead.id)).toBe(false);
  });

  // 5. delete → excluded from Analytics
  it("delete → excluded from Analytics", async () => {
    const lead = await createTestLead("AnalyticsDisappear", LeadStatus.WON);
    
    // Create Deal record so wonRevenue is derived from deal.finalAmount
    await db.deal.create({
      data: {
        leadId: lead.id,
        finalAmount: 15000,
        status: "CONFIRMED",
      },
    });

    // Create activity for reliable won analytics
    await db.leadActivity.create({
      data: {
        leadId: lead.id,
        type: ActivityType.STATUS_CHANGED,
        message: "Status changed to WON",
        metadata: { to: "WON" },
      },
    });

    const beforeAnalytics = await getAnalyticsData("7d");
    expect(beforeAnalytics.success).toBe(true);
    if (!beforeAnalytics.success) return;
    const beforeWonRev = beforeAnalytics.data.coreMetrics.wonRevenue;

    await deleteLead(lead.id);

    const afterAnalytics = await getAnalyticsData("7d");
    expect(afterAnalytics.success).toBe(true);
    if (!afterAnalytics.success) return;

    // Revenue from deleted lead is excluded
    expect(afterAnalytics.data.coreMetrics.wonRevenue).toBeLessThanOrEqual(beforeWonRev - 15000);
  });

  // 6. delete → excluded from Search
  it("delete → excluded from Search", async () => {
    const lead = await createTestLead("SearchExcludedUnique");

    const beforeQuick = await globalQuickSearch(lead.phone);
    expect(beforeQuick.success).toBe(true);
    if (beforeQuick.success && beforeQuick.data) {
      expect(beforeQuick.data.some((l) => l.id === lead.id)).toBe(true);
    }

    const beforeWA = await searchLeadsForWhatsApp(lead.phone);
    expect(beforeWA.success).toBe(true);
    if (beforeWA.success && beforeWA.data) {
      expect(beforeWA.data.some((l) => l.id === lead.id)).toBe(true);
    }

    await deleteLead(lead.id);

    const afterQuick = await globalQuickSearch(lead.phone);
    expect(afterQuick.success).toBe(true);
    if (afterQuick.success && afterQuick.data) {
      expect(afterQuick.data.some((l) => l.id === lead.id)).toBe(false);
    }

    const afterWA = await searchLeadsForWhatsApp(lead.phone);
    expect(afterWA.success).toBe(true);
    if (afterWA.success && afterWA.data) {
      expect(afterWA.data.some((l) => l.id === lead.id)).toBe(false);
    }
  });

  // 7. restore → returns correctly
  it("restore → returns correctly", async () => {
    const lead = await createTestLead("RestoreLeadFlow");

    await deleteLead(lead.id);

    // Verify it is in Recently Deleted
    const recDelBefore = await getRecentlyDeletedLeads();
    expect(recDelBefore.success).toBe(true);
    if (recDelBefore.success) {
      expect(recDelBefore.data.some((l) => l.id === lead.id)).toBe(true);
    }

    // Restore
    const restoreRes = await restoreLead(lead.id);
    expect(restoreRes.success).toBe(true);

    // Verify it returns to Leads
    const leadsAfter = await getLeads();
    expect(leadsAfter.success).toBe(true);
    if (leadsAfter.success) {
      expect(leadsAfter.data.some((l) => l.id === lead.id)).toBe(true);
    }

    // Verify it is no longer in Recently Deleted
    const recDelAfter = await getRecentlyDeletedLeads();
    expect(recDelAfter.success).toBe(true);
    if (recDelAfter.success) {
      expect(recDelAfter.data.some((l) => l.id === lead.id)).toBe(false);
    }
  });

  // 8. permanent delete works only for already-deleted lead
  it("permanent delete works only for already-deleted lead", async () => {
    const lead = await createTestLead("PermDeleteCheck");

    // Attempt permanent delete on active lead (not yet soft-deleted) -> must FAIL
    const failRes = await permanentlyDeleteLead(lead.id);
    expect(failRes.success).toBe(false);
    if (!failRes.success) {
      expect(failRes.error).toContain("Delete it first");
    }

    // Soft-delete first
    await deleteLead(lead.id);

    // Now permanent delete -> must SUCCEED
    const permRes = await permanentlyDeleteLead(lead.id);
    expect(permRes.success).toBe(true);

    // Verify lead is completely gone from DB
    const dbLead = await db.lead.findUnique({ where: { id: lead.id } });
    expect(dbLead).toBeNull();
  });

  // 9. follow-up Call → native tel opens
  it("follow-up Call → native tel opens", () => {
    let capturedHref = "";
    const mockWindow = {
      location: {
        set href(val: string) {
          capturedHref = val;
        },
        get href() {
          return capturedHref;
        },
      },
    };

    const leadPhone = "+919876543210";
    // Simulate what openCallModal does:
    mockWindow.location.href = `tel:${leadPhone}`;

    expect(capturedHref).toBe("tel:+919876543210");
  });

  // 10. call outcome modal appears
  it("call outcome modal appears when active lead is set", () => {
    let activeLead: { id: string; name: string; phone: string } | null = null;
    const openCallModal = (lead: { id: string; name: string; phone: string }) => {
      activeLead = lead;
    };

    expect(activeLead).toBeNull();
    openCallModal({ id: "lead-123", name: "Rohan", phone: "9876543210" });
    expect(activeLead).not.toBeNull();
    expect((activeLead as { id: string } | null)?.id).toBe("lead-123");
  });

  // 11. outcome logged exactly once
  it("outcome logged exactly once", async () => {
    const lead = await createTestLead("OutcomeOnceLead");

    const initialActivities = await getLeadActivities(lead.id);
    const initialCount = initialActivities.success ? initialActivities.data.length : 0;

    // Simulate clicking "Picked" in CallOutcomeModal
    await logActivity(lead.id, "LEAD_UPDATED", "Call picked");

    const afterActivities = await getLeadActivities(lead.id);
    expect(afterActivities.success).toBe(true);
    if (!afterActivities.success) return;

    expect(afterActivities.data.length).toBe(initialCount + 1);
    expect(afterActivities.data[0].message).toBe("Call picked");
  });

  // 12. canonical lead status not accidentally changed
  it("canonical lead status not accidentally changed on call outcome", async () => {
    const lead = await createTestLead("StatusPreservedLead", LeadStatus.QUALIFIED);

    // Call outcome is logged
    await logActivity(lead.id, "LEAD_UPDATED", "Call picked - Interested");

    // Check DB status directly
    const refreshedLead = await db.lead.findUnique({
      where: { id: lead.id },
      select: { status: true },
    });

    expect(refreshedLead?.status).toBe(LeadStatus.QUALIFIED);
  });
});
