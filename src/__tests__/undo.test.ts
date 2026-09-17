import { describe, it, expect, beforeEach, afterAll, beforeAll, vi } from "vitest";
import { db } from "@/lib/db";
import { createLead, markLeadWaste, restoreWasteLead, undoWasteToggle } from "@/app/actions/leads";
import { createFollowUp, updateFollowUp, undoCreateFollowUp, undoRescheduleFollowUp } from "@/app/actions/follow-ups";
import { ActivityType } from "@prisma/client";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn().mockResolvedValue({ id: "mock-user-id" }),
}));

describe("Phase 12.4 Undo Functionality", () => {
  let testLeadId: string;
  let testUserId: string;

  beforeEach(async () => {
    // Clear test data
    await db.leadLossEvent.deleteMany({});
    await db.salesNotification.deleteMany({});
    await db.followUp.deleteMany({});
    await db.leadActivity.deleteMany({});
    await db.leadAIInsight.deleteMany({});
    await db.lead.deleteMany({});
    await db.user.deleteMany({});

    // Setup user
    const user = await db.user.create({
      data: {
        id: "mock-user-id",
        email: "undo_test@example.com",
        name: "Undo Tester",
        passwordHash: "dummy",
      },
    });
    testUserId = user.id;

    // Create a dummy lead manually to avoid relying on full auth context in Server Actions if it errors out
    const lead = await db.lead.create({
      data: {
        name: "Test Undo Lead",
        phone: "555-UNDO-111",
      },
    });
    testLeadId = lead.id;

  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe("Waste Undo", () => {
    it("should accurately undo mark as waste", async () => {
      // 1. Mark as waste
      await markLeadWaste(testLeadId);
      let lead = await db.lead.findUnique({ where: { id: testLeadId } });
      expect(lead?.isWaste).toBe(true);

      // 2. Undo waste toggle (previousIsWaste = false)
      await undoWasteToggle(testLeadId, false);
      lead = await db.lead.findUnique({ where: { id: testLeadId } });
      expect(lead?.isWaste).toBe(false);

      // 3. Verify activity
      const activities = await db.leadActivity.findMany({ where: { leadId: testLeadId }, orderBy: { createdAt: "desc" } });
      expect(activities[0].message).toBe("Undid marking as Waste, lead restored");
    });

    it("should accurately undo restore from waste", async () => {
      // 1. Setup as waste
      await db.lead.update({ where: { id: testLeadId }, data: { isWaste: true } });

      // 2. Restore from waste
      await restoreWasteLead(testLeadId);
      let lead = await db.lead.findUnique({ where: { id: testLeadId } });
      expect(lead?.isWaste).toBe(false);

      // 3. Undo restore from waste (previousIsWaste = true)
      await undoWasteToggle(testLeadId, true);
      lead = await db.lead.findUnique({ where: { id: testLeadId } });
      expect(lead?.isWaste).toBe(true);

      // 4. Verify activity
      const activities = await db.leadActivity.findMany({ where: { leadId: testLeadId }, orderBy: { createdAt: "desc" } });
      expect(activities[0].message).toBe("Undid restoration, lead returned to Waste");
    });
  });

  describe("Follow-up Undo", () => {
    it("should accurately undo follow-up creation", async () => {
      const form = new FormData();
      form.append("leadId", testLeadId);
      form.append("scheduledAt", new Date(Date.now() + 86400000).toISOString());
      form.append("type", "Call");

      const res = await createFollowUp(form);
      expect(res.success).toBe(true);
      if (!res.success) return;

      const fuId = res.data.id;
      let fu = await db.followUp.findUnique({ where: { id: fuId } });
      expect(fu).not.toBeNull();

      // Undo creation
      await undoCreateFollowUp(fuId);

      // Verify deletion
      fu = await db.followUp.findUnique({ where: { id: fuId } });
      expect(fu).toBeNull();

      // Verify activity
      const activities = await db.leadActivity.findMany({ where: { leadId: testLeadId }, orderBy: { createdAt: "desc" } });
      expect(activities[0].type).toBe(ActivityType.FOLLOWUP_CANCELLED);
      expect(activities[0].message).toContain("Undid creation");
    });

    it("should accurately undo follow-up reschedule", async () => {
      // Setup original follow up
      const initialDate = new Date(Date.now() + 86400000);
      const fu = await db.followUp.create({
        data: {
          leadId: testLeadId,
          scheduledAt: initialDate,
          type: "CALL",
          status: "PENDING",
        }
      });

      // Update follow up (reschedule)
      const form = new FormData();
      form.append("id", fu.id);
      form.append("scheduledAt", new Date(Date.now() + 172800000).toISOString());
      form.append("type", "WHATSAPP");

      await updateFollowUp(form);

      // Undo reschedule
      await undoRescheduleFollowUp(fu.id, initialDate, "CALL");

      // Verify restoration
      const restored = await db.followUp.findUnique({ where: { id: fu.id } });
      expect(restored?.scheduledAt.getTime()).toBe(initialDate.getTime());
      expect(restored?.type).toBe("CALL");

      // Verify activity
      const activities = await db.leadActivity.findMany({ where: { leadId: testLeadId }, orderBy: { createdAt: "desc" } });
      expect(activities[0].type).toBe(ActivityType.FOLLOWUP_RESCHEDULED);
      expect(activities[0].message).toContain("Undid reschedule");
    });
  });
});
