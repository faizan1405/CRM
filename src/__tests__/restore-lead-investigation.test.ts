import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import {
  deleteLead,
  restoreLead,
  getLeads,
  getRecentlyDeletedLeads,
} from "@/app/actions/leads";
import { globalQuickSearch } from "@/app/actions/lead-search";
import { getSession } from "@/lib/auth";
import { LeadStatus, ActivityType } from "@prisma/client";

const TEST_USER_ID = "test-restore-investigation-user";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Restore Lead Isolated Verification", () => {
  let testLeadId: string;

  beforeAll(async () => {
    await db.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        name: "Restore Tester",
        email: "restoretester@example.com",
        passwordHash: "dummyhash",
        role: "ADMIN",
      },
    });

    vi.mocked(getSession).mockResolvedValue({
      id: TEST_USER_ID,
      email: "restoretester@example.com",
      role: "ADMIN",
    });
  });

  it("proves DB and query behavior: delete -> restore -> inspect DB, getLeads, search", async () => {
    try {
      // 1. Create isolated lead
    const uniquePhone = `+91 99000 ${Math.floor(10000 + Math.random() * 90000)}`;
    const created = await db.lead.create({
      data: {
        name: "Restore Target Lead",
        phone: uniquePhone,
        business: "Restore Test Business",
        status: LeadStatus.QUALIFIED,
        isWaste: false,
        quotedAmount: 45000,
        notes: "Detailed notes about this prospect",
      },
    });
    testLeadId = created.id;

    // Add activity and follow-up
    await db.leadActivity.create({
      data: {
        leadId: testLeadId,
        type: ActivityType.NOTE_ADDED,
        message: "First note activity",
        createdByUserId: TEST_USER_ID,
      },
    });

    await db.followUp.create({
      data: {
        leadId: testLeadId,
        scheduledAt: new Date(),
        type: "CALL",
        status: "PENDING",
        note: "Follow up call",
      },
    });

    // 2. Inspect DB before delete
    const dbBeforeDelete = await db.lead.findUnique({
      where: { id: testLeadId },
      include: { activities: true, followUps: true },
    });
    expect(dbBeforeDelete).not.toBeNull();
    expect(dbBeforeDelete!.deletedAt).toBeNull();
    expect(dbBeforeDelete!.status).toBe(LeadStatus.QUALIFIED);
    expect(dbBeforeDelete!.isWaste).toBe(false);

    // 3. Delete lead
    const deleteRes = await deleteLead(testLeadId);
    expect(deleteRes.success).toBe(true);

    const dbAfterDelete = await db.lead.findUnique({ where: { id: testLeadId } });
    expect(dbAfterDelete!.deletedAt).not.toBeNull();

    // Verify it is in Recently Deleted
    const recDel = await getRecentlyDeletedLeads();
    expect(recDel.success).toBe(true);
    if (recDel.success) {
      expect(recDel.data.some((l) => l.id === testLeadId)).toBe(true);
    }

    // Verify it is NOT in active leads
    const leadsWhileDeleted = await getLeads();
    expect(leadsWhileDeleted.success).toBe(true);
    if (leadsWhileDeleted.success) {
      expect(leadsWhileDeleted.data.some((l) => l.id === testLeadId)).toBe(false);
    }

    // 4. RESTORE LEAD
    const restoreRes = await restoreLead(testLeadId);
    expect(restoreRes.success).toBe(true);

    // 5. Inspect the SAME DB row immediately
    const dbAfterRestore = await db.lead.findUnique({
      where: { id: testLeadId },
      include: { activities: true, followUps: true },
    });
    expect(dbAfterRestore).not.toBeNull();
    expect(dbAfterRestore!.id).toBe(testLeadId);
    expect(dbAfterRestore!.deletedAt).toBeNull();
    expect(dbAfterRestore!.status).toBe(LeadStatus.QUALIFIED);
    expect(dbAfterRestore!.isWaste).toBe(false);
    expect(dbAfterRestore!.notes).toBe("Detailed notes about this prospect");
    expect(Number(dbAfterRestore!.quotedAmount)).toBe(45000);
    expect(dbAfterRestore!.activities.length).toBeGreaterThan(0);
    expect(dbAfterRestore!.followUps.length).toBeGreaterThan(0);

    // 6. Verify getRecentlyDeletedLeads excludes it
    const recDelAfter = await getRecentlyDeletedLeads();
    expect(recDelAfter.success).toBe(true);
    if (recDelAfter.success) {
      expect(recDelAfter.data.some((l) => l.id === testLeadId)).toBe(false);
    }

    // 7. Verify getLeads includes it with status QUALIFIED
    const activeLeadsAfter = await getLeads();
    expect(activeLeadsAfter.success).toBe(true);
    if (activeLeadsAfter.success) {
      const restoredFound = activeLeadsAfter.data.find((l) => l.id === testLeadId);
      expect(restoredFound).toBeDefined();
      expect(restoredFound?.status).toBe("Qualified");
    }

    // 8. Verify globalQuickSearch finds it
    const searchRes = await globalQuickSearch(uniquePhone);
    expect(searchRes.success).toBe(true);
    if (searchRes.success && searchRes.data) {
      expect(searchRes.data.some((l) => l.id === testLeadId)).toBe(true);
    }

    // 9. Verify NO duplicate lead was created in database
    const matchingCount = await db.lead.count({ where: { phone: uniquePhone } });
    expect(matchingCount).toBe(1);

    // 10. Repeatable cycle: delete again -> restore again on the SAME lead record
    const secondDelete = await deleteLead(testLeadId);
    expect(secondDelete.success).toBe(true);
    const dbSecondDelete = await db.lead.findUnique({ where: { id: testLeadId } });
    expect(dbSecondDelete!.deletedAt).not.toBeNull();

    const secondRestore = await restoreLead(testLeadId);
    expect(secondRestore.success).toBe(true);
    const dbSecondRestore = await db.lead.findUnique({ where: { id: testLeadId } });
    expect(dbSecondRestore!.id).toBe(testLeadId);
    expect(dbSecondRestore!.deletedAt).toBeNull();
    expect(dbSecondRestore!.status).toBe(LeadStatus.QUALIFIED);
    expect(dbSecondRestore!.notes).toBe("Detailed notes about this prospect");
    } finally {
      if (testLeadId) {
        await db.followUp.deleteMany({ where: { leadId: testLeadId } });
        await db.leadActivity.deleteMany({ where: { leadId: testLeadId } });
        await db.lead.deleteMany({ where: { id: testLeadId } });
      }
    }
  });
});
