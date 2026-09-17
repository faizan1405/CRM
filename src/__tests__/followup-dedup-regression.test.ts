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

const TEST_USER_ID = "test-dedup-followup-user";
const allCreatedIds: string[] = [];

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

describe("follow-up deduplication (Phase 12.5)", () => {
  beforeAll(async () => {
    await db.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        name: "Dedup Test User",
        email: "dedup-test@example.com",
        passwordHash: "dummyhash",
        role: "ADMIN",
      },
    });

    vi.mocked(getSession).mockResolvedValue({
      id: TEST_USER_ID,
      email: "dedup-test@example.com",
      role: "ADMIN",
    });
  });

  afterAll(async () => {
    await db.followUp.deleteMany({ where: { leadId: { in: allCreatedIds } } });
    await db.leadActivity.deleteMany({ where: { leadId: { in: allCreatedIds } } });
    await db.leadAIInsight.deleteMany({ where: { leadId: { in: allCreatedIds } } });
    await db.lead.deleteMany({ where: { id: { in: allCreatedIds } } });
    try { await db.user.delete({ where: { id: TEST_USER_ID } }); } catch { /* safe */ }
  });

  async function createTestLead(name = "Dedup Test Lead") {
    const l = await db.lead.create({
      data: {
        name: `${name} ${Date.now()}`,
        phone: `+9199999999${Math.floor(Math.random() * 1000)}`,
        email: `dedup-${Date.now()}@test.com`,
        business: "Test",
        status: "NEW",
      },
    });
    allCreatedIds.push(l.id);
    return l.id;
  }

  function buildFormData(lid: string, submissionId?: string) {
    const fd = new FormData();
    fd.set("leadId", lid);
    fd.set("scheduledAt", "2025-12-31T10:00:00+05:30");
    fd.set("type", "Call");
    fd.set("note", "dedup-test-note");
    if (submissionId) fd.set("submissionId", submissionId);
    return fd;
  }

  it("returns the same follow-up when the same submissionId is submitted twice", async () => {
    const leadId = await createTestLead();
    const submissionId = "test-submission-abc123";

    const r1 = await createFollowUp(buildFormData(leadId, submissionId));
    expect(r1.success).toBe(true);
    const id1 = (r1 as { success: true; data: { id: string } }).data.id;

    const r2 = await createFollowUp(buildFormData(leadId, submissionId));
    expect(r2.success).toBe(true);
    const id2 = (r2 as { success: true; data: { id: string } }).data.id;

    expect(id1).toBe(id2);

    const count = await db.followUp.count({ where: { leadId } });
    expect(count).toBe(1);
  });

  it("creates separate follow-ups for different submissionIds", async () => {
    const leadId = await createTestLead();

    const r1 = await createFollowUp(buildFormData(leadId, "submission-x-001"));
    expect(r1.success).toBe(true);
    const id1 = (r1 as { success: true; data: { id: string } }).data.id;

    const r2 = await createFollowUp(buildFormData(leadId, "submission-x-002"));
    expect(r2.success).toBe(true);
    const id2 = (r2 as { success: true; data: { id: string } }).data.id;

    expect(id1).not.toBe(id2);

    const count = await db.followUp.count({ where: { leadId } });
    expect(count).toBe(2);
  });

  it("creates distinct follow-ups when no submissionId is provided", async () => {
    const leadId = await createTestLead();

    const r1 = await createFollowUp(buildFormData(leadId));
    expect(r1.success).toBe(true);
    const id1 = (r1 as { success: true; data: { id: string } }).data.id;

    const r2 = await createFollowUp(buildFormData(leadId));
    expect(r2.success).toBe(true);
    const id2 = (r2 as { success: true; data: { id: string } }).data.id;

    expect(id1).not.toBe(id2);

    const count = await db.followUp.count({ where: { leadId } });
    expect(count).toBe(2);
  });
});
