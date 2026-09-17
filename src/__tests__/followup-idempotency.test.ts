/**
 * Regression test: Follow-up creation idempotency via submissionId.
 * Confirms that submitting the same submissionId twice returns the same follow-up
 * (no duplicate), while different submissionIds create distinct follow-ups.
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

const TEST_USER_ID = "test-idempotent-followup-user";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

describe("follow-up idempotency (submissionId)", () => {
  let testLeadId: string;

  beforeAll(async () => {
    await db.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        name: "Idempotency Test User",
        email: "idempotent-test@example.com",
        passwordHash: "dummyhash",
        role: "ADMIN",
      },
    });

    vi.mocked(getSession).mockResolvedValue({
      id: TEST_USER_ID,
      email: "idempotent-test@example.com",
      role: "ADMIN",
    });

    const lead = await db.lead.create({
      data: { name: "Idempotency Test Lead", phone: "+919999999930", email: "idempotent@test.com", business: "Test", status: "NEW" },
    });
    testLeadId = lead.id;
  });

  afterAll(async () => {
    if (testLeadId) {
      try {
        await db.followUp.deleteMany({ where: { leadId: testLeadId } });
        await db.leadActivity.deleteMany({ where: { leadId: testLeadId } });
        await db.leadAIInsight.deleteMany({ where: { leadId: testLeadId } });
        await db.lead.deleteMany({ where: { id: testLeadId } });
      } catch { /* safe */ }
    }
    try { await db.user.delete({ where: { id: TEST_USER_ID } }); } catch { /* safe */ }
  });

  function buildFormData(leadId: string, submissionId?: string) {
    const fd = new FormData();
    fd.set("leadId", leadId);
    fd.set("scheduledAt", "2025-12-31T10:00:00+05:30");
    fd.set("type", "Call");
    fd.set("note", "idempotency-test-note");
    if (submissionId) {
      fd.set("submissionId", submissionId);
    }
    return fd;
  }

  it("returns the same follow-up when the same submissionId is submitted twice", async () => {
    const submissionId = "test-submission-abc123";

    const r1 = await createFollowUp(buildFormData(testLeadId, submissionId));
    expect(r1.success).toBe(true);
    const id1 = (r1 as FollowUpActionResult).data!.id;

    const r2 = await createFollowUp(buildFormData(testLeadId, submissionId));
    expect(r2.success).toBe(true);
    const id2 = (r2 as FollowUpActionResult).data!.id;

    expect(id1).toBe(id2);

    const count = await db.followUp.count({ where: { leadId: testLeadId } });
    expect(count).toBe(1);
  });

  it("creates distinct follow-ups for different submissionIds", async () => {
    const r1 = await createFollowUp(buildFormData(testLeadId, "submission-x-001"));
    expect(r1.success).toBe(true);
    const id1 = (r1 as FollowUpActionResult).data!.id;

    const r2 = await createFollowUp(buildFormData(testLeadId, "submission-x-002"));
    expect(r2.success).toBe(true);
    const id2 = (r2 as FollowUpActionResult).data!.id;

    expect(id1).not.toBe(id2);

    const count = await db.followUp.count({ where: { leadId: testLeadId } });
    expect(count).toBe(3);
  });

  it("creates distinct follow-ups when no submissionId is provided", async () => {
    const lead2 = await db.lead.create({
      data: { name: "No-dup Test Lead", phone: "+919999999931", email: "nodup@test.com", business: "Test", status: "NEW" },
    });
    const leadId2 = lead2.id;

    const r1 = await createFollowUp(buildFormData(leadId2));
    expect(r1.success).toBe(true);
    const id1 = (r1 as FollowUpActionResult).data!.id;

    const r2 = await createFollowUp(buildFormData(leadId2));
    expect(r2.success).toBe(true);
    const id2 = (r2 as FollowUpActionResult).data!.id;

    expect(id1).not.toBe(id2);

    const count = await db.followUp.count({ where: { leadId: leadId2 } });
    expect(count).toBe(2);

    // Clean up
    await db.followUp.deleteMany({ where: { leadId: leadId2 } });
    await db.leadActivity.deleteMany({ where: { leadId: leadId2 } });
    await db.leadAIInsight.deleteMany({ where: { leadId: leadId2 } });
    await db.lead.deleteMany({ where: { id: leadId2 } });
  });
});
