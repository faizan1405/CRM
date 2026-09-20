/**
 * Regression test: verify follow-up creation correctness and idempotency
 * (sequential calls each produce a distinct follow-up; single call produces exactly one).
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import { db } from "@/lib/db";
import { createFollowUp } from "@/app/actions/follow-ups";
import { getSession } from "@/lib/auth";
import type { FollowUpActionResult } from "@/features/followups/types";
import { ActivityType } from "@prisma/client";

const TEST_USER_ID = "test-dup-followup-user";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

describe("follow-up concurrency / duplication", () => {
  let testLeadId1: string;
  let testLeadId2: string;

  beforeAll(async () => {
    await db.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        name: "Dup Test User",
        email: "dup-test@example.com",
        passwordHash: "dummyhash",
        role: "ADMIN",
      },
    });

    vi.mocked(getSession).mockResolvedValue({
      id: TEST_USER_ID,
      email: "dup-test@example.com",
      role: "ADMIN",
    });

    const l1 = await db.lead.create({
      data: { name: "FollowUp Test Lead 1", phone: "+919999999901", email: "dup1@test.com", business: "Test", status: "NEW" },
    });
    testLeadId1 = l1.id;

    const l2 = await db.lead.create({
      data: { name: "FollowUp Test Lead 2", phone: "+919999999902", email: "dup2@test.com", business: "Test", status: "NEW" },
    });
    testLeadId2 = l2.id;
  });

  afterAll(async () => {
    for (const lid of [testLeadId1, testLeadId2].filter(Boolean)) {
      try {
        await db.followUp.deleteMany({ where: { leadId: lid } });
        await db.leadActivity.deleteMany({ where: { leadId: lid } });
        await db.leadAIInsight.deleteMany({ where: { leadId: lid } });
        await db.lead.deleteMany({ where: { id: lid } });
      } catch { /* safe */ }
    }
    try { await db.user.delete({ where: { id: TEST_USER_ID } }); } catch { /* safe */ }
  });

  function buildFormData(leadId: string) {
    const fd = new FormData();
    fd.set("leadId", leadId);
    fd.set("scheduledAt", "2025-12-31T10:00:00+05:30");
    fd.set("type", "Call");
    fd.set("note", "duplicate-test-note");
    return fd;
  }

  it("creates exactly one follow-up on a single submission", async () => {
    const r = await createFollowUp(buildFormData(testLeadId1));
    expect(r.success).toBe(true);

    const count = await db.followUp.count({ where: { leadId: testLeadId1 } });
    expect(count).toBe(1);

    // Verify activity was created
    const activities = await db.leadActivity.count({
      where: { leadId: testLeadId1, type: ActivityType.FOLLOWUP_CREATED },
    });
    expect(activities).toBe(1);

    // Verify note was synced
    const lead = await db.lead.findUnique({ where: { id: testLeadId1 } });
    expect(lead?.notes).toBe("duplicate-test-note");
  });

  it("creates separate follow-ups on sequential submissions", async () => {
    const r1 = await createFollowUp(buildFormData(testLeadId2));
    expect(r1.success).toBe(true);
    const id1 = (r1 as FollowUpActionResult).data!.id;

    const r2 = await createFollowUp(buildFormData(testLeadId2));
    expect(r2.success).toBe(true);
    const id2 = (r2 as FollowUpActionResult).data!.id;

    expect(id1).not.toBe(id2);

    const count = await db.followUp.count({ where: { leadId: testLeadId2 } });
    expect(count).toBe(2);

    // Primary product rule: exactly ONE active PENDING follow-up per lead, previous is CANCELLED
    const pendingCount = await db.followUp.count({ where: { leadId: testLeadId2, status: "PENDING" } });
    expect(pendingCount).toBe(1);

    const cancelledCount = await db.followUp.count({ where: { leadId: testLeadId2, status: "CANCELLED" } });
    expect(cancelledCount).toBe(1);

    const oldRow = await db.followUp.findUnique({ where: { id: id1 } });
    expect(oldRow?.status).toBe("CANCELLED");

    const newRow = await db.followUp.findUnique({ where: { id: id2 } });
    expect(newRow?.status).toBe("PENDING");
  });
});
