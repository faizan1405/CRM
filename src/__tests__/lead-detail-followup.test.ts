import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { getFollowUps, scheduleLeadFollowUp } from "@/app/actions/follow-ups";
import { getLead } from "@/app/actions/leads";
import { getSession } from "@/lib/auth";
import { ActivityType } from "@prisma/client";

const TEST_USER_ID = "test-lead-detail-followup-user";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

describe("Lead Detail Follow-up System Integration (7 Required Tests)", () => {
  const createdLeadIds: string[] = [];

  beforeAll(async () => {
    await db.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        name: "Lead Detail Tester",
        email: "lead-detail-tester@example.com",
        passwordHash: "dummyhash",
        role: "ADMIN",
      },
    });

    vi.mocked(getSession).mockResolvedValue({
      id: TEST_USER_ID,
      email: "lead-detail-tester@example.com",
      role: "ADMIN",
    });
  });

  afterAll(async () => {
    if (createdLeadIds.length > 0) {
      await db.followUp.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.leadActivity.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.leadAIInsight.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
    }
    await db.user.delete({ where: { id: TEST_USER_ID } }).catch(() => {});
  });

  async function createTestLead(nameSuffix: string) {
    const lead = await db.lead.create({
      data: {
        name: `Lead Detail Test ${nameSuffix}`,
        phone: `+91 98765 ${Math.floor(10000 + Math.random() * 90000)}`,
        business: "Test Business Ltd",
        status: "NEW",
      },
    });
    createdLeadIds.push(lead.id);
    return lead;
  }

  it("1. Lead Detail → Follow-up → actual FollowUp row created", async () => {
    const lead = await createTestLead("Point 1 - Actual Row Created");
    const countBefore = await db.followUp.count({ where: { leadId: lead.id } });
    expect(countBefore).toBe(0);

    const scheduledIso = "2026-10-25T11:00:00+05:30";
    const formData = new FormData();
    formData.append("leadId", lead.id);
    formData.append("scheduledAt", scheduledIso);
    formData.append("type", "Call");

    const result = await scheduleLeadFollowUp(formData);
    expect(result.success).toBe(true);

    // Verify row created in FollowUp table
    const followUps = await db.followUp.findMany({ where: { leadId: lead.id } });
    expect(followUps.length).toBe(1);
    expect(followUps[0].status).toBe("PENDING");
    expect(followUps[0].type).toBe("CALL");
    expect(new Date(followUps[0].scheduledAt).toISOString()).toBe(new Date(scheduledIso).toISOString());

    // Verify FOLLOWUP_CREATED activity was recorded
    const activities = await db.leadActivity.findMany({
      where: { leadId: lead.id, type: ActivityType.FOLLOWUP_CREATED },
    });
    expect(activities.length).toBe(1);
  });

  it("2. Existing follow-up → Lead Detail reschedule → date changes", async () => {
    const lead = await createTestLead("Point 2 - Existing Follow-up Reschedule");

    // Create an initial follow-up for 2026-10-20
    const initialIso = "2026-10-20T10:00:00+05:30";
    const initialForm = new FormData();
    initialForm.append("leadId", lead.id);
    initialForm.append("scheduledAt", initialIso);
    initialForm.append("type", "Call");
    const initialRes = await scheduleLeadFollowUp(initialForm);
    expect(initialRes.success).toBe(true);

    const followUpId = (initialRes as any).data.id;

    // Reschedule from Lead Detail to 2026-10-28
    const newScheduledIso = "2026-10-28T14:30:00+05:30";
    const rescheduleForm = new FormData();
    rescheduleForm.append("id", followUpId);
    rescheduleForm.append("leadId", lead.id);
    rescheduleForm.append("scheduledAt", newScheduledIso);
    rescheduleForm.append("type", "Call");

    const rescheduleRes = await scheduleLeadFollowUp(rescheduleForm);
    expect(rescheduleRes.success).toBe(true);

    // Verify date changed on existing follow-up
    const updatedFollowUp = await db.followUp.findUnique({ where: { id: followUpId } });
    expect(new Date(updatedFollowUp!.scheduledAt).toISOString()).toBe(new Date(newScheduledIso).toISOString());

    // Verify FOLLOWUP_RESCHEDULED activity recorded
    const rescheduleActivities = await db.leadActivity.findMany({
      where: { leadId: lead.id, type: ActivityType.FOLLOWUP_RESCHEDULED },
    });
    expect(rescheduleActivities.length).toBe(1);
  });

  it("3. Lead.nextFollowUpDate updates", async () => {
    const lead = await createTestLead("Point 3 - nextFollowUpDate Updates");
    expect(lead.nextFollowUpDate).toBeNull();

    // Schedule initial follow-up
    const date1 = "2026-11-01T10:00:00+05:30";
    const form1 = new FormData();
    form1.append("leadId", lead.id);
    form1.append("scheduledAt", date1);
    form1.append("type", "WhatsApp");
    await scheduleLeadFollowUp(form1);

    let dbLead = await db.lead.findUnique({ where: { id: lead.id } });
    expect(dbLead?.nextFollowUpDate).not.toBeNull();
    const formattedDate1 = new Date(date1).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    expect(dbLead?.nextFollowUpDate?.toISOString().slice(0, 10)).toBe(formattedDate1);

    // Reschedule to later date (2026-11-15)
    const date2 = "2026-11-15T16:00:00+05:30";
    const form2 = new FormData();
    form2.append("leadId", lead.id);
    form2.append("scheduledAt", date2);
    form2.append("type", "WhatsApp");
    await scheduleLeadFollowUp(form2);

    dbLead = await db.lead.findUnique({ where: { id: lead.id } });
    const formattedDate2 = new Date(date2).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    expect(dbLead?.nextFollowUpDate?.toISOString().slice(0, 10)).toBe(formattedDate2);
  });

  it("4. Follow-ups page shows new date", async () => {
    const lead = await createTestLead("Point 4 - Follow-ups Page Sync");

    // Schedule for 2026-12-01
    const date1 = "2026-12-01T09:00:00+05:30";
    const form1 = new FormData();
    form1.append("leadId", lead.id);
    form1.append("scheduledAt", date1);
    form1.append("type", "Call");
    const res1 = await scheduleLeadFollowUp(form1);
    expect(res1.success).toBe(true);

    let followUpsPageData = await getFollowUps();
    expect(followUpsPageData.success).toBe(true);
    let allPending = [
      ...followUpsPageData.data!.today,
      ...followUpsPageData.data!.upcoming,
      ...followUpsPageData.data!.overdue,
    ];
    let found = allPending.find((f) => f.leadId === lead.id);
    expect(found).toBeDefined();
    expect(new Date(found!.scheduledAt).toISOString()).toBe(new Date(date1).toISOString());

    // Now reschedule from Lead Detail to 2026-12-10
    const date2 = "2026-12-10T15:00:00+05:30";
    const form2 = new FormData();
    form2.append("leadId", lead.id);
    form2.append("scheduledAt", date2);
    form2.append("type", "Call");
    const res2 = await scheduleLeadFollowUp(form2);
    expect(res2.success).toBe(true);

    followUpsPageData = await getFollowUps();
    allPending = [
      ...followUpsPageData.data!.today,
      ...followUpsPageData.data!.upcoming,
      ...followUpsPageData.data!.overdue,
    ];
    found = allPending.find((f) => f.leadId === lead.id);
    expect(found).toBeDefined();
    expect(new Date(found!.scheduledAt).toISOString()).toBe(new Date(date2).toISOString());
  });

  it("5. Note is optional and does not replace scheduling", async () => {
    const lead = await createTestLead("Point 5 - Note Optional");

    // Case A: Schedule WITHOUT note
    const formWithoutNote = new FormData();
    formWithoutNote.append("leadId", lead.id);
    formWithoutNote.append("scheduledAt", "2026-10-30T10:00:00+05:30");
    formWithoutNote.append("type", "Call");

    const resA = await scheduleLeadFollowUp(formWithoutNote);
    expect(resA.success).toBe(true);

    // Follow-up was created even though no note was given
    const countA = await db.followUp.count({ where: { leadId: lead.id } });
    expect(countA).toBe(1);

    // No NOTE_ADDED activity recorded
    const noteActivitiesA = await db.leadActivity.findMany({
      where: { leadId: lead.id, type: ActivityType.NOTE_ADDED },
    });
    expect(noteActivitiesA.length).toBe(0);

    // Case B: Reschedule WITH note
    const formWithNote = new FormData();
    formWithNote.append("leadId", lead.id);
    formWithNote.append("scheduledAt", "2026-11-05T11:00:00+05:30");
    formWithNote.append("type", "Call");
    formWithNote.append("note", "Client asked to call back next week after budgeting meeting");

    const resB = await scheduleLeadFollowUp(formWithNote);
    expect(resB.success).toBe(true);

    // Follow-up was updated
    const updatedFollowUp = await db.followUp.findFirst({ where: { leadId: lead.id } });
    expect(new Date(updatedFollowUp!.scheduledAt).toISOString()).toBe(new Date("2026-11-05T11:00:00+05:30").toISOString());
    expect(updatedFollowUp!.note).toBe("Client asked to call back next week after budgeting meeting");

    // Note WAS saved to lead.notes AND leadActivity
    const updatedLead = await db.lead.findUnique({ where: { id: lead.id } });
    expect(updatedLead?.notes).toBe("Client asked to call back next week after budgeting meeting");

    const noteActivitiesB = await db.leadActivity.findMany({
      where: { leadId: lead.id, type: ActivityType.NOTE_ADDED },
    });
    expect(noteActivitiesB.length).toBe(1);
    expect(noteActivitiesB[0].message).toBe("Client asked to call back next week after budgeting meeting");
  });

  it("6. No duplicate FollowUp", async () => {
    const lead = await createTestLead("Point 6 - No Duplicate");

    // 1st schedule from Lead Detail
    const form1 = new FormData();
    form1.append("leadId", lead.id);
    form1.append("scheduledAt", "2026-10-10T10:00:00+05:30");
    form1.append("type", "Call");
    await scheduleLeadFollowUp(form1);

    expect(await db.followUp.count({ where: { leadId: lead.id } })).toBe(1);

    // 2nd schedule from Lead Detail (reschedule without passing ID, just leadId and new date)
    const form2 = new FormData();
    form2.append("leadId", lead.id);
    form2.append("scheduledAt", "2026-10-15T14:00:00+05:30");
    form2.append("type", "Call");
    await scheduleLeadFollowUp(form2);

    // Must NOT create duplicate row
    const countAfterReschedule = await db.followUp.count({ where: { leadId: lead.id } });
    expect(countAfterReschedule).toBe(1);

    // 3rd schedule from Lead Detail
    const form3 = new FormData();
    form3.append("leadId", lead.id);
    form3.append("scheduledAt", "2026-10-20T16:00:00+05:30");
    form3.append("type", "WhatsApp");
    await scheduleLeadFollowUp(form3);

    expect(await db.followUp.count({ where: { leadId: lead.id } })).toBe(1);
  });

  it("7. Exact IST date/time preserved", async () => {
    const lead = await createTestLead("Point 7 - Exact IST Preserved");

    // Choose 3:45 PM IST on 2026-10-25
    const scheduledIso = "2026-10-25T15:45:00+05:30";
    const form = new FormData();
    form.append("leadId", lead.id);
    form.append("scheduledAt", scheduledIso);
    form.append("type", "Call");

    const res = await scheduleLeadFollowUp(form);
    expect(res.success).toBe(true);

    const followUp = await db.followUp.findFirst({ where: { leadId: lead.id } });
    expect(followUp).toBeDefined();

    // Verify exact date & time when formatted in IST
    const scheduledDate = new Date(followUp!.scheduledAt);
    const istDate = scheduledDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const istTime = scheduledDate.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });

    expect(istDate).toBe("2026-10-25");
    expect(istTime).toBe("15:45");

    // Also verify getLead returns the serialized activeFollowUp with exact time
    const leadResult = await getLead(lead.id);
    expect(leadResult.success).toBe(true);
    expect((leadResult as any).data.activeFollowUp).toBeDefined();
    const activeFollowUp = (leadResult as any).data.activeFollowUp;
    const activeDate = new Date(activeFollowUp.scheduledAt);
    expect(activeDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })).toBe("2026-10-25");
    expect(activeDate.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })).toBe("15:45");
  });
});
