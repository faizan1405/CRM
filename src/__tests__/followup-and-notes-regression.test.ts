import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { createFollowUp } from "@/app/actions/follow-ups";
import { addLeadNote, getLeadActivities } from "@/app/actions/activities";
import { updateQuickStatus } from "@/app/actions/leads";
import { getSession } from "@/lib/auth";

const TEST_USER_ID = "test-phase12-regression-user";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

describe("Phase 12: Follow-up & Notes Regression and Quick Status Tests", () => {
  const createdLeadIds: string[] = [];

  beforeAll(async () => {
    // Ensure test user exists in database
    await db.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        name: "Phase 12 Tester",
        email: "phase12tester@example.com",
        passwordHash: "dummyhash",
        role: "ADMIN",
      },
    });

    // Default authenticated mock
    vi.mocked(getSession).mockResolvedValue({
      id: TEST_USER_ID,
      email: "phase12tester@example.com",
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
  });

  async function createTestLead(nameSuffix: string) {
    const lead = await db.lead.create({
      data: {
        name: `Phase 12 Test Lead ${nameSuffix}`,
        phone: `+91 98765 ${Math.floor(10000 + Math.random() * 90000)}`,
        business: "Test Business Ltd",
        status: "NEW",
      },
    });
    createdLeadIds.push(lead.id);
    return lead;
  }

  describe("Follow-up Creation & Synchronization", () => {
    it("should successfully create a follow-up with exact date and time", async () => {
      const lead = await createTestLead("FollowUp Exact Date");
      const scheduledIso = "2026-09-25T14:30:00.000Z";

      const formData = new FormData();
      formData.append("leadId", lead.id);
      formData.append("type", "Call");
      formData.append("scheduledAt", scheduledIso);
      formData.append("note", "Discuss enterprise pricing package");

      const result = await createFollowUp(formData);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.leadId).toBe(lead.id);
      expect(result.data.type).toBe("Call");
      expect(result.data.note).toBe("Discuss enterprise pricing package");
      expect(new Date(result.data.scheduledAt).toISOString()).toBe(scheduledIso);

      // Verify row persisted in DB
      const persisted = await db.followUp.findUnique({ where: { id: result.data.id } });
      expect(persisted).not.toBeNull();
      expect(persisted?.status).toBe("PENDING");
      expect(persisted?.type).toBe("CALL");
    });

    it("should handle uppercase follow-up type strings like CALL or WHATSAPP", async () => {
      const lead = await createTestLead("FollowUp Uppercase");
      const formData = new FormData();
      formData.append("leadId", lead.id);
      formData.append("type", "WHATSAPP");
      formData.append("scheduledAt", "2026-09-26T10:00:00.000Z");
      formData.append("note", "Send product demo video");

      const result = await createFollowUp(formData);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.type).toBe("WhatsApp");
    });

    it("should synchronize Lead.nextFollowUpDate with the earliest pending follow-up", async () => {
      const lead = await createTestLead("NextFollowUp Sync");

      // Schedule later follow-up first
      const form1 = new FormData();
      form1.append("leadId", lead.id);
      form1.append("type", "Call");
      form1.append("scheduledAt", "2026-10-15T10:00:00.000Z");
      await createFollowUp(form1);

      let updatedLead = await db.lead.findUnique({ where: { id: lead.id } });
      expect(updatedLead?.nextFollowUpDate?.toISOString().slice(0, 10)).toBe("2026-10-15");

      // Schedule earlier follow-up
      const form2 = new FormData();
      form2.append("leadId", lead.id);
      form2.append("type", "WhatsApp");
      form2.append("scheduledAt", "2026-09-20T10:00:00.000Z");
      await createFollowUp(form2);

      updatedLead = await db.lead.findUnique({ where: { id: lead.id } });
      expect(updatedLead?.nextFollowUpDate?.toISOString().slice(0, 10)).toBe("2026-09-20");
    });

    it("should record a FOLLOWUP_CREATED activity with valid user ID", async () => {
      const lead = await createTestLead("FollowUp Activity");
      const formData = new FormData();
      formData.append("leadId", lead.id);
      formData.append("type", "Call");
      formData.append("scheduledAt", "2026-09-28T09:00:00.000Z");
      formData.append("note", "Introductory call");

      const result = await createFollowUp(formData);
      expect(result.success).toBe(true);

      const activities = await db.leadActivity.findMany({
        where: { leadId: lead.id, type: "FOLLOWUP_CREATED" },
      });
      expect(activities.length).toBeGreaterThanOrEqual(1);
      expect(activities[0].createdByUserId).toBe(TEST_USER_ID);
      expect(activities[0].message).toContain("Scheduled a CALL follow-up");
    });

    it("should reject invalid date format with descriptive error", async () => {
      const lead = await createTestLead("Invalid Date");
      const formData = new FormData();
      formData.append("leadId", lead.id);
      formData.append("type", "Call");
      formData.append("scheduledAt", "invalid-not-a-date");

      const result = await createFollowUp(formData);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain("Invalid schedule date.");
    });

    it("should reject invalid leadId with descriptive error", async () => {
      const formData = new FormData();
      formData.append("leadId", "00000000-0000-0000-0000-000000000000");
      formData.append("type", "Call");
      formData.append("scheduledAt", "2026-09-25T10:00:00.000Z");

      const result = await createFollowUp(formData);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain("Lead not found.");
    });

    it("should reject follow-up creation when unauthenticated", async () => {
      vi.mocked(getSession).mockResolvedValueOnce(null);
      const lead = await createTestLead("Unauth Followup");
      const formData = new FormData();
      formData.append("leadId", lead.id);
      formData.append("type", "Call");
      formData.append("scheduledAt", "2026-09-25T10:00:00.000Z");

      const result = await createFollowUp(formData);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain("You must be signed in");
    });
  });

  describe("Manual Note Creation & Persistence", () => {
    it("should successfully add a manual note and record NOTE_ADDED activity", async () => {
      const lead = await createTestLead("Note Test");
      const noteMessage = "Client requested e-commerce proposal with payment gateway integration.";

      const result = await addLeadNote(lead.id, noteMessage);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.leadId).toBe(lead.id);
      expect(result.data.message).toBe(noteMessage);
      expect(result.data.type).toBe("NOTE_ADDED");

      // Verify activity in DB
      const activities = await db.leadActivity.findMany({
        where: { leadId: lead.id, type: "NOTE_ADDED" },
      });
      expect(activities.length).toBe(1);
      expect(activities[0].message).toBe(noteMessage);
      expect(activities[0].createdByUserId).toBe(TEST_USER_ID);
    });

    it("should retrieve notes via getLeadActivities", async () => {
      const lead = await createTestLead("Note Query");
      await addLeadNote(lead.id, "First interaction note");
      await addLeadNote(lead.id, "Second interaction note");

      const activitiesResult = await getLeadActivities(lead.id);
      expect(activitiesResult.success).toBe(true);
      if (!activitiesResult.success) return;

      const noteActivities = activitiesResult.data.filter((a) => a.type === "NOTE_ADDED");
      expect(noteActivities.length).toBe(2);
      expect(noteActivities[0].message).toBe("Second interaction note");
    });

    it("should reject empty note submission", async () => {
      const lead = await createTestLead("Empty Note");
      const result = await addLeadNote(lead.id, "   ");
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain("Note cannot be empty.");
    });

    it("should reject note addition when unauthenticated", async () => {
      vi.mocked(getSession).mockResolvedValueOnce(null);
      const lead = await createTestLead("Unauth Note");
      const result = await addLeadNote(lead.id, "Valid note text");
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain("You must be signed in");
    });
  });

  describe("Quick Status System & Canonical Sync", () => {
    it("should update quickStatus to CONTACTED and transition NEW lead to CONTACTED", async () => {
      const lead = await createTestLead("Quick Contacted");
      expect(lead.status).toBe("NEW");

      const result = await updateQuickStatus(lead.id, "CONTACTED");
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.quickStatus).toBe("CONTACTED");
      expect(result.data.status).toBe("Contacted");

      const dbLead = await db.lead.findUnique({ where: { id: lead.id } });
      expect(dbLead?.quickStatus).toBe("CONTACTED");
      expect(dbLead?.status).toBe("CONTACTED");
    });

    it("should update quickStatus to INTERESTED and transition lead to QUALIFIED", async () => {
      const lead = await createTestLead("Quick Interested");

      const result = await updateQuickStatus(lead.id, "INTERESTED");
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.quickStatus).toBe("INTERESTED");
      expect(result.data.status).toBe("Qualified");

      const dbLead = await db.lead.findUnique({ where: { id: lead.id } });
      expect(dbLead?.quickStatus).toBe("INTERESTED");
      expect(dbLead?.status).toBe("QUALIFIED");
    });

    it("should update quickStatus to CALL_NOT_PICK without disrupting existing pipeline status", async () => {
      const lead = await db.lead.create({
        data: {
          name: "Phase 12 Call Not Pick",
          phone: "+91 99999 11111",
          status: "QUALIFIED",
        },
      });
      createdLeadIds.push(lead.id);

      const result = await updateQuickStatus(lead.id, "CALL_NOT_PICK");
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.quickStatus).toBe("CALL_NOT_PICK");
      expect(result.data.status).toBe("Qualified");
    });

    it("should update quickStatus to CALL_AGAIN without disrupting pipeline status", async () => {
      const lead = await createTestLead("Quick Call Again");
      const result = await updateQuickStatus(lead.id, "CALL_AGAIN");
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.quickStatus).toBe("CALL_AGAIN");
    });
  });
});
