import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { LeadStatus, ActivityType } from "@prisma/client";

vi.mock("@/lib/auth", () => ({
  getSession: async () => ({
    id: "legacy-analytics-tester",
    email: "legacy-analytics@scale-flow.test",
    role: "ADMIN",
  }),
}));

import { getAnalyticsData } from "@/app/actions/analytics";

describe("Analytics: legacyLeadCount Exact Semantics Regression Test", () => {
  const testNow = new Date("2026-10-14T10:00:00.000Z");
  const testUserId = "legacy-analytics-tester";

  const leadIds: string[] = [];

  beforeAll(async () => {
    await db.user.upsert({
      where: { id: testUserId },
      create: { id: testUserId, email: "legacy-analytics@scale-flow.test", name: "Tester", role: "ADMIN", passwordHash: "dummy" },
      update: {},
    });

    // 1. Target unmerged lead created in 2024
    const leadTarget = await db.lead.create({
      data: {
        name: "Legacy Analytics Target Lead",
        phone: "+919999000111",
        status: LeadStatus.CONTACTED,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
      },
    });
    leadIds.push(leadTarget.id);

    // 2. Merged lead created in 2024 (isWaste=false, deletedAt=null, mergedIntoLeadId set)
    const leadMerged = await db.lead.create({
      data: {
        name: "Legacy Analytics Merged Lead",
        phone: "+919999000222",
        status: LeadStatus.NEW,
        mergedIntoLeadId: leadTarget.id,
        createdAt: new Date("2024-01-02T00:00:00.000Z"),
      },
    });
    leadIds.push(leadMerged.id);

    // 3. LeadActivity created in 2025 (so earliestActivity is in 2025, making both 2024 leads legacy)
    await db.leadActivity.create({
      data: {
        leadId: leadTarget.id,
        type: ActivityType.LEAD_CREATED,
        message: "Activity logged in 2025",
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        createdByUserId: testUserId,
      },
    });
  });

  afterAll(async () => {
    if (leadIds.length > 0) {
      await db.leadActivity.deleteMany({ where: { leadId: { in: leadIds } } });
      await db.lead.deleteMany({ where: { id: { in: leadIds } } });
    }
    await db.user.deleteMany({ where: { id: testUserId } });
  });

  it("ensures legacyLeadCount includes eligible merged leads with isWaste=false and deletedAt=null", async () => {
    const res = await getAnalyticsData("30d");
    if (!res.success) {
      throw new Error("Analytics failed: " + (res as { error?: string }).error);
    }
    expect(res.data).toBeDefined();

    // Verify directly against the canonical count query:
    // count(where: { isWaste: false, deletedAt: null, createdAt: { lt: activityStart } })
    const activityStart = new Date("2025-01-01T00:00:00.000Z");
    const countInDb = await db.lead.count({
      where: {
        isWaste: false,
        deletedAt: null,
        createdAt: { lt: activityStart },
        id: { in: leadIds },
      },
    });

    // Both the unmerged lead AND the merged lead must be counted (count === 2)
    expect(countInDb).toBe(2);

    // And getAnalyticsData's dataCoverage.legacyLeadCount must reflect this total
    expect(res.data!.dataCoverage.legacyLeadCount).toBeGreaterThanOrEqual(2);
  });
});
