import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { scheduleLeadFollowUp, getFollowUps } from "@/app/actions/follow-ups";
import { getLead, getLeads } from "@/app/actions/leads";
import { globalQuickSearch } from "@/app/actions/lead-search";
import { getKolkataTodayString } from "@/features/followups/canonical-resolver";
import { getSession } from "@/lib/auth";

const TEST_USER_ID = "test-isolated-flow-user";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

describe("Isolated Lead Follow-Up Lifecycle Verification", () => {
  let leadId: string;
  let testPhone: string;
  const todayStr = getKolkataTodayString();

  beforeAll(async () => {
    await db.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        name: "Isolated Tester",
        email: "isolated-tester@example.com",
        passwordHash: "dummyhash",
        role: "ADMIN",
      },
    });

    vi.mocked(getSession).mockResolvedValue({
      id: TEST_USER_ID,
      email: "isolated-tester@example.com",
      role: "ADMIN",
    });

    testPhone = "+9192222" + Math.floor(10000 + Math.random() * 90000);
    const l = await db.lead.create({
      data: {
        name: "Saksham Isolated Lifecycle Test",
        phone: testPhone,
        status: "NEW",
        business: "Lifecycle Enterprise",
      },
    });
    leadId = l.id;
  });

  afterAll(async () => {
    await db.followUp.deleteMany({ where: { leadId } });
    await db.leadActivity.deleteMany({ where: { leadId } });
    await db.leadAIInsight.deleteMany({ where: { leadId } });
    await db.lead.delete({ where: { id: leadId } });
    await db.user.delete({ where: { id: TEST_USER_ID } }).catch(() => {});
  });

  it("Step 1: Schedule for Today 4:30 PM", async () => {
    const todayIso = `${todayStr}T16:30:00+05:30`;
    const res1 = await scheduleLeadFollowUp({
      leadId,
      scheduledAt: todayIso,
      type: "Call",
      note: "Step 1: Today 4:30 PM",
    });
    expect(res1.success).toBe(true);

    // Verify DB: exactly 1 PENDING follow-up
    const pendingRows = await db.followUp.findMany({
      where: { leadId, status: "PENDING" },
    });
    expect(pendingRows.length).toBe(1);

    // Verify Follow-ups page: present in Today tab, absent in Upcoming and Overdue
    const followUpsPage = await getFollowUps();
    expect(followUpsPage.success).toBe(true);
    const todayMatches = followUpsPage.data!.today.filter((f) => f.leadId === leadId);
    const overdueMatches = followUpsPage.data!.overdue.filter((f) => f.leadId === leadId);
    const upcomingMatches = followUpsPage.data!.upcoming.filter((f) => f.leadId === leadId);

    expect(todayMatches.length).toBe(1);
    expect(overdueMatches.length).toBe(0);
    expect(upcomingMatches.length).toBe(0);

    // Verify Lead Detail
    const leadDetail = await getLead(leadId);
    expect(leadDetail.success).toBe(true);
    expect((leadDetail as any).data?.activeFollowUp?.scheduledAt).toBe(new Date(todayIso).toISOString());

    // Verify Leads list / Pipeline
    const leadsList = await getLeads();
    const leadInList = (leadsList as any).data?.find((l: any) => l.id === leadId);
    expect(leadInList).toBeDefined();
    expect(leadInList?.nextFollowUpDate).toBe(new Date(todayIso).toISOString());

    // Verify Global Search
    const searchRes = await globalQuickSearch(testPhone);
    expect(searchRes.success).toBe(true);
    const leadInSearch = searchRes.data?.find((l) => l.id === leadId);
    expect(leadInSearch).toBeDefined();
    expect(leadInSearch?.nextFollowUpDate).toBe(new Date(todayIso).toISOString());
  });

  it("Step 2: Reschedule for +2 Days 10:00 AM", async () => {
    const todayDate = new Date(`${todayStr}T00:00:00+05:30`);
    const plusTwoDays = new Date(todayDate.getTime() + 2 * 24 * 60 * 60 * 1000);
    const plusTwoStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(plusTwoDays);
    const plusTwoIso = `${plusTwoStr}T10:00:00+05:30`;

    const existingPending = await db.followUp.findFirst({
      where: { leadId, status: "PENDING" },
    });

    const res2 = await scheduleLeadFollowUp({
      leadId,
      scheduledAt: plusTwoIso,
      type: "Call",
      note: "Step 2: +2 Days 10:00 AM",
      mode: "reschedule",
      id: existingPending?.id,
    });
    expect(res2.success).toBe(true);

    // Verify DB: exactly 1 PENDING follow-up
    const pendingRows = await db.followUp.findMany({
      where: { leadId, status: "PENDING" },
    });
    expect(pendingRows.length).toBe(1);

    // Verify Follow-ups page: strictly in Upcoming tab, ZERO in Today or Overdue
    const followUpsPage = await getFollowUps();
    expect(followUpsPage.success).toBe(true);
    const todayMatches = followUpsPage.data!.today.filter((f) => f.leadId === leadId);
    const overdueMatches = followUpsPage.data!.overdue.filter((f) => f.leadId === leadId);
    const upcomingMatches = followUpsPage.data!.upcoming.filter((f) => f.leadId === leadId);

    expect(todayMatches.length).toBe(0);
    expect(overdueMatches.length).toBe(0);
    expect(upcomingMatches.length).toBe(1);

    // Verify Lead Detail
    const leadDetail = await getLead(leadId);
    expect(leadDetail.success).toBe(true);
    expect((leadDetail as any).data?.activeFollowUp?.scheduledAt).toBe(new Date(plusTwoIso).toISOString());

    // Verify Leads list / Pipeline
    const leadsList = await getLeads();
    const leadInList = (leadsList as any).data?.find((l: any) => l.id === leadId);
    expect(leadInList?.nextFollowUpDate).toBe(new Date(plusTwoIso).toISOString());

    // Verify Global Search
    const searchRes = await globalQuickSearch(testPhone);
    const leadInSearch = searchRes.data?.find((l) => l.id === leadId);
    expect(leadInSearch?.nextFollowUpDate).toBe(new Date(plusTwoIso).toISOString());
  });

  it("Step 3: Reschedule for Tomorrow 11:00 AM", async () => {
    const todayDate = new Date(`${todayStr}T00:00:00+05:30`);
    const tomorrowDate = new Date(todayDate.getTime() + 1 * 24 * 60 * 60 * 1000);
    const tomorrowStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(tomorrowDate);
    const tomorrowIso = `${tomorrowStr}T11:00:00+05:30`;

    const existingPending = await db.followUp.findFirst({
      where: { leadId, status: "PENDING" },
    });

    const res3 = await scheduleLeadFollowUp({
      leadId,
      scheduledAt: tomorrowIso,
      type: "Call",
      note: "Step 3: Tomorrow 11:00 AM",
      mode: "reschedule",
      id: existingPending?.id,
    });
    expect(res3.success).toBe(true);

    // Verify DB: exactly 1 PENDING follow-up
    const pendingRows = await db.followUp.findMany({
      where: { leadId, status: "PENDING" },
    });
    expect(pendingRows.length).toBe(1);

    // Verify Follow-ups page: strictly in Upcoming tab, ZERO in Today or Overdue
    const followUpsPage = await getFollowUps();
    expect(followUpsPage.success).toBe(true);
    const todayMatches = followUpsPage.data!.today.filter((f) => f.leadId === leadId);
    const overdueMatches = followUpsPage.data!.overdue.filter((f) => f.leadId === leadId);
    const upcomingMatches = followUpsPage.data!.upcoming.filter((f) => f.leadId === leadId);

    expect(todayMatches.length).toBe(0);
    expect(overdueMatches.length).toBe(0);
    expect(upcomingMatches.length).toBe(1);

    // Verify Lead Detail
    const leadDetail = await getLead(leadId);
    expect(leadDetail.success).toBe(true);
    expect((leadDetail as any).data?.activeFollowUp?.scheduledAt).toBe(new Date(tomorrowIso).toISOString());

    // Verify Leads list / Pipeline
    const leadsList = await getLeads();
    const leadInList = (leadsList as any).data?.find((l: any) => l.id === leadId);
    expect(leadInList?.nextFollowUpDate).toBe(new Date(tomorrowIso).toISOString());

    // Verify Global Search
    const searchRes = await globalQuickSearch(testPhone);
    const leadInSearch = searchRes.data?.find((l) => l.id === leadId);
    expect(leadInSearch?.nextFollowUpDate).toBe(new Date(tomorrowIso).toISOString());
  });
});
