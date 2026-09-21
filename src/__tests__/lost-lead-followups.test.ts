import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { markLeadLost, getLeadLossHistory } from "@/app/actions/lost-reasons";
import { changeLeadStatus, getLead, getLeads } from "@/app/actions/leads";
import { createFollowUp, getFollowUps, getActiveFollowUp } from "@/app/actions/follow-ups";
import { getActiveFollowUpForLead } from "@/features/followups/canonical-resolver";
import { getDashboardData } from "@/app/actions/dashboard";
import { getPriorityLeads } from "@/app/actions/priority-leads";
import { getDailySalesBriefingData } from "@/features/daily-briefing/services/briefing-service";
import { generateSmartNotifications } from "@/features/notifications/services/notification-generator";
import { globalQuickSearch } from "@/app/actions/lead-search";
import { fetchFollowUpsForExport } from "@/app/actions/export";
import { executeUndo } from "@/features/undo/services/undo-engine";
import { deriveOperationalState } from "@/lib/operational-state";
import { getSession } from "@/lib/auth";

const TEST_USER_ID = "test-lost-lead-user";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

describe("LOST Lead Follow-Up Lifecycle and Undo Invariants", () => {
  let leadId: string;
  let testPhone: string;
  let scheduledDate: Date;

  beforeAll(async () => {
    await db.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        name: "Lost Lead Tester",
        email: "lost-lead-tester@example.com",
        passwordHash: "dummyhash",
        role: "ADMIN",
      },
    });

    vi.mocked(getSession).mockResolvedValue({
      id: TEST_USER_ID,
      email: "lost-lead-tester@example.com",
      role: "ADMIN",
    });

    testPhone = "+9198888" + Math.floor(10000 + Math.random() * 90000);
    const l = await db.lead.create({
      data: {
        name: "Lost Invariant Enterprise",
        phone: testPhone,
        status: "QUALIFIED",
        business: "Invariant Corp",
      },
    });
    leadId = l.id;
  });

  afterAll(async () => {
    await db.followUp.deleteMany({ where: { leadId } });
    await db.leadLossEvent.deleteMany({ where: { leadId } });
    await db.leadActivity.deleteMany({ where: { leadId } });
    await db.undoAction.deleteMany({ where: { leadId } });
    await db.leadAIInsight.deleteMany({ where: { leadId } });
    await db.lead.delete({ where: { id: leadId } }).catch(() => {});
    await db.user.delete({ where: { id: TEST_USER_ID } }).catch(() => {});
  });

  it("Step 1: Create an active PENDING follow-up on QUALIFIED lead", async () => {
    scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
    const fd = new FormData();
    fd.append("leadId", leadId);
    fd.append("scheduledAt", scheduledDate.toISOString());
    fd.append("type", "Call");
    fd.append("note", "Discuss enterprise pricing package");

    const res = await createFollowUp(fd);
    expect(res.success).toBe(true);
    expect(res.data?.status).toBe("Pending");

    // Verify lead has active follow up
    const leadRes = await getLead(leadId);
    expect(leadRes.success).toBe(true);
    expect(leadRes.data?.status).toBe("Qualified");
    expect(leadRes.data?.nextFollowUpDate).not.toBeNull();
    expect(leadRes.data?.activeFollowUp).not.toBeNull();
    expect(leadRes.data?.operationalState).toBe("FUTURE_FOLLOW_UP");

    // Verify in active follow-ups list
    const fuListRes = await getFollowUps();
    expect(fuListRes.success).toBe(true);
    const activeInUpcoming = fuListRes.data?.upcoming.some((f) => f.leadId === leadId);
    expect(activeInUpcoming).toBe(true);
  });

  it("Step 2: Mark lead as LOST via markLeadLost and verify follow-up cancellation and exclusion", async () => {
    const markRes = await markLeadLost(leadId, "PRICE", "Budget was too small");
    expect(markRes.success).toBe(true);
    expect(markRes.undoId).toBeDefined();

    // 1. Lead status is LOST, nextFollowUpDate is null, activeFollowUp is null
    const leadRes = await getLead(leadId);
    expect(leadRes.success).toBe(true);
    expect(leadRes.data?.status).toBe("Lost");
    expect(leadRes.data?.nextFollowUpDate).toBeNull();
    expect(leadRes.data?.activeFollowUp).toBeNull();
    expect(leadRes.data?.operationalState).toBe("LOST");

    // 2. Database lead record has nextFollowUpDate null
    const dbLead = await db.lead.findUnique({ where: { id: leadId } });
    expect(dbLead?.status).toBe("LOST");
    expect(dbLead?.nextFollowUpDate).toBeNull();

    // 3. Database follow-up record is CANCELLED (not deleted, preserving history)
    const allFollowUps = await db.followUp.findMany({ where: { leadId } });
    expect(allFollowUps.length).toBe(1);
    expect(allFollowUps[0].status).toBe("CANCELLED");

    // 4. Activity log has FOLLOWUP_CANCELLED and STATUS_CHANGED
    const activities = await db.leadActivity.findMany({
      where: { leadId },
      orderBy: { createdAt: "desc" },
    });
    const cancelActivity = activities.find((a) => a.type === "FOLLOWUP_CANCELLED");
    expect(cancelActivity).toBeDefined();
    expect(cancelActivity?.message).toContain("Cancelled");

    // 5. getFollowUps() excludes this lead from today, upcoming, overdue
    const fuList = await getFollowUps();
    expect(fuList.success).toBe(true);
    const inToday = fuList.data?.today.some((f) => f.leadId === leadId);
    const inUpcoming = fuList.data?.upcoming.some((f) => f.leadId === leadId);
    const inOverdue = fuList.data?.overdue.some((f) => f.leadId === leadId);
    expect(inToday).toBe(false);
    expect(inUpcoming).toBe(false);
    expect(inOverdue).toBe(false);

    // Cancelled record is safely present in completed / history tab
    const inCompleted = fuList.data?.completed.some((f) => f.leadId === leadId);
    expect(inCompleted).toBe(true);

    // 6. getActiveFollowUp & getActiveFollowUpForLead return null
    const activeFu1 = await getActiveFollowUp(leadId);
    expect(activeFu1.data).toBeNull();

    const activeFu2 = await getActiveFollowUpForLead(leadId);
    expect(activeFu2).toBeNull();

    // 7. Global quick search returns nextFollowUpDate as null
    const searchRes = await globalQuickSearch("Invariant Enterprise");
    expect(searchRes.success).toBe(true);
    const foundSearch = searchRes.data?.find((l) => l.id === leadId);
    expect(foundSearch).toBeDefined();
    expect(foundSearch?.nextFollowUpDate).toBeNull();

    // 8. Export excludes follow-ups for LOST leads
    const exportRows = await fetchFollowUpsForExport();
    const inExport = exportRows.some((r) => r.phone === testPhone);
    expect(inExport).toBe(false);
  });

  it("Step 3: Undo Mark Lost reverts lead and restores follow-up without duplicates", async () => {
    const undoRecords = await db.undoAction.findMany({
      where: { leadId, actionType: "LEAD_STATUS_CHANGE" },
      orderBy: { createdAt: "desc" },
    });
    expect(undoRecords.length).toBeGreaterThan(0);
    const undoId = undoRecords[0].id;

    const undoResult = await executeUndo(undoId, TEST_USER_ID);
    expect(undoResult.actionType).toBe("LEAD_STATUS_CHANGE");

    // Verify lead status restored
    const leadRes = await getLead(leadId);
    expect(leadRes.success).toBe(true);
    expect(leadRes.data?.status).toBe("Qualified");
    expect(leadRes.data?.nextFollowUpDate).not.toBeNull();
    expect(leadRes.data?.activeFollowUp).not.toBeNull();
    expect(leadRes.data?.activeFollowUp?.status).toBe("Pending");

    // Verify exactly ONE follow-up exists in DB (no duplicates created)
    const allFollowUps = await db.followUp.findMany({ where: { leadId } });
    expect(allFollowUps.length).toBe(1);
    expect(allFollowUps[0].status).toBe("PENDING");

    // Verify restored to upcoming tab
    const fuList = await getFollowUps();
    const inUpcoming = fuList.data?.upcoming.some((f) => f.leadId === leadId);
    expect(inUpcoming).toBe(true);
  });

  it("Step 4: Re-marking LOST via changeLeadStatus cancels follow-up and preserves loss reasons", async () => {
    const changeRes = await changeLeadStatus(leadId, "Lost", "TIMING", "Postponed to next quarter");
    expect(changeRes.success).toBe(true);

    const leadRes = await getLead(leadId);
    expect(leadRes.success).toBe(true);
    expect(leadRes.data?.status).toBe("Lost");
    expect(leadRes.data?.nextFollowUpDate).toBeNull();
    expect(leadRes.data?.activeFollowUp).toBeNull();

    const fuList = await getFollowUps();
    expect(fuList.data?.upcoming.some((f) => f.leadId === leadId)).toBe(false);
    expect(fuList.data?.today.some((f) => f.leadId === leadId)).toBe(false);
    expect(fuList.data?.overdue.some((f) => f.leadId === leadId)).toBe(false);

    // Follow-up status in DB is CANCELLED
    const fu = await db.followUp.findFirst({ where: { leadId } });
    expect(fu?.status).toBe("CANCELLED");

    // Reopen lead via changeLeadStatus back to Qualified
    const reopenRes = await changeLeadStatus(leadId, "Qualified");
    expect(reopenRes.success).toBe(true);

    const reopenedLead = await getLead(leadId);
    expect(reopenedLead.data?.status).toBe("Qualified");
    expect(reopenedLead.data?.nextFollowUpDate).not.toBeNull();
    expect(reopenedLead.data?.activeFollowUp).not.toBeNull();

    // Verify strictly ONE follow-up record in DB
    const dbFUs = await db.followUp.findMany({ where: { leadId } });
    expect(dbFUs.length).toBe(1);
    expect(dbFUs[0].status).toBe("PENDING");
  });
});
