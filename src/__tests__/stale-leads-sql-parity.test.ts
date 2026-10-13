import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { LeadStatus, ActivityType } from "@prisma/client";
import {
  getStaleLeadsCount,
  calculateLeadStaleness,
  LeadInputForStaleness,
} from "@/lib/stale-leads";

describe("Stale Leads: SQL Count vs Canonical calculateLeadStaleness Parity Test", () => {
  const testNow = new Date("2026-10-14T12:00:00.000Z");
  const testUser = {
    id: "stale-parity-test-user",
    email: "stale-parity@scale-flow.test",
    name: "Stale Parity Tester",
    role: "ADMIN" as const,
  };

  const createdLeadIds: string[] = [];

  beforeAll(async () => {
    // Ensure test user exists
    await db.user.upsert({
      where: { id: testUser.id },
      create: { ...testUser, passwordHash: "dummy" },
      update: {},
    });

    // Helper to create leads
    const mkLead = async (data: any) => {
      const lead = await db.lead.create({ data });
      createdLeadIds.push(lead.id);
      return lead;
    };

    // 1. Primary lead for merging target
    const targetLead = await mkLead({
      name: "Parity Target Lead",
      phone: "+919999000001",
      status: LeadStatus.NEW,
      createdAt: new Date(testNow.getTime() - 10 * 86400000),
    });

    // 2. Exactly three days of inactivity (72.0 hours ago) -> STALE
    await mkLead({
      name: "Parity Lead: Exactly 3 Days Inactive",
      phone: "+919999000002",
      status: LeadStatus.NEW,
      createdAt: new Date(testNow.getTime() - 72 * 3600000), // Exactly 72h
    });

    // 3. Two days and 23 hours of inactivity (71.0 hours ago) -> NOT STALE
    await mkLead({
      name: "Parity Lead: 2 Days 23 Hours Inactive",
      phone: "+919999000003",
      status: LeadStatus.NEW,
      createdAt: new Date(testNow.getTime() - 71 * 3600000), // 71h (2d 23h)
    });

    // 4. Fresh activities (created 5 days ago, but activity 2 hours ago) -> NOT STALE
    const freshActLead = await mkLead({
      name: "Parity Lead: Fresh Activity",
      phone: "+919999000004",
      status: LeadStatus.CONTACTED,
      createdAt: new Date(testNow.getTime() - 5 * 86400000),
    });
    await db.leadActivity.create({
      data: {
        leadId: freshActLead.id,
        type: ActivityType.LEAD_UPDATED,
        message: "Spoke on phone",
        createdAt: new Date(testNow.getTime() - 2 * 3600000), // 2h ago
        createdByUserId: testUser.id,
      },
    });

    // 5. Stale activity (created 6 days ago, last activity 4 days ago) -> STALE
    const staleActLead = await mkLead({
      name: "Parity Lead: Stale Activity",
      phone: "+919999000005",
      status: LeadStatus.QUALIFIED,
      createdAt: new Date(testNow.getTime() - 6 * 86400000),
    });
    await db.leadActivity.create({
      data: {
        leadId: staleActLead.id,
        type: ActivityType.LEAD_UPDATED,
        message: "Old update",
        createdAt: new Date(testNow.getTime() - 4 * 86400000), // 4d ago
        createdByUserId: testUser.id,
      },
    });

    // 6. Contact dates: fresh contact (created 5d ago, lastContactDate 1d ago) -> NOT STALE
    await mkLead({
      name: "Parity Lead: Fresh Contact Date",
      phone: "+919999000006",
      status: LeadStatus.PROPOSAL_SENT,
      createdAt: new Date(testNow.getTime() - 5 * 86400000),
      lastContactDate: new Date(testNow.getTime() - 1 * 86400000),
    });

    // 7. Contact dates: stale contact (created 5d ago, lastContactDate 4d ago) -> STALE
    await mkLead({
      name: "Parity Lead: Stale Contact Date",
      phone: "+919999000007",
      status: LeadStatus.PROPOSAL_SENT,
      createdAt: new Date(testNow.getTime() - 5 * 86400000),
      lastContactDate: new Date(testNow.getTime() - 4 * 86400000),
    });

    // 8. Indian timezone boundary (IST midnight boundary 4 days ago) -> STALE
    const istMidnight4DaysAgo = new Date("2026-10-10T00:00:00.000+05:30");
    await mkLead({
      name: "Parity Lead: IST Midnight Boundary Stale",
      phone: "+919999000008",
      status: LeadStatus.NEW,
      createdAt: istMidnight4DaysAgo,
    });

    // 9. Lost Leads (30 days inactive, status LOST) -> NOT STALE
    await mkLead({
      name: "Parity Lead: Lost Status Terminal",
      phone: "+919999000009",
      status: LeadStatus.LOST,
      createdAt: new Date(testNow.getTime() - 30 * 86400000),
    });

    // 10. Won Leads (30 days inactive, status WON) -> NOT STALE
    await mkLead({
      name: "Parity Lead: Won Status Terminal",
      phone: "+919999000010",
      status: LeadStatus.WON,
      createdAt: new Date(testNow.getTime() - 30 * 86400000),
    });

    // 11. Deleted Leads (30 days inactive, deletedAt set) -> NOT STALE
    await mkLead({
      name: "Parity Lead: Deleted Soft",
      phone: "+919999000011",
      status: LeadStatus.NEW,
      createdAt: new Date(testNow.getTime() - 30 * 86400000),
      deletedAt: new Date(testNow.getTime() - 1 * 86400000),
    });

    // 12. Waste Leads (30 days inactive, isWaste = true) -> NOT STALE
    await mkLead({
      name: "Parity Lead: Waste Lead",
      phone: "+919999000012",
      status: LeadStatus.NEW,
      isWaste: true,
      createdAt: new Date(testNow.getTime() - 30 * 86400000),
    });

    // 13. Merged Leads (30 days inactive, mergedIntoLeadId set) -> NOT STALE
    await mkLead({
      name: "Parity Lead: Merged Into Other",
      phone: "+919999000013",
      status: LeadStatus.NEW,
      createdAt: new Date(testNow.getTime() - 30 * 86400000),
      mergedIntoLeadId: targetLead.id,
    });
  });

  afterAll(async () => {
    // Clean up created fixtures safely
    if (createdLeadIds.length > 0) {
      await db.leadActivity.deleteMany({
        where: { leadId: { in: createdLeadIds } },
      });
      await db.lead.deleteMany({
        where: { id: { in: createdLeadIds } },
      });
    }
    await db.user.deleteMany({
      where: { id: testUser.id },
    });
  });

  it("verifies individual lead staleness parity between SQL query filter and calculateLeadStaleness()", async () => {
    // Fetch all test fixtures with their activities
    const testLeads = await db.lead.findMany({
      where: { id: { in: createdLeadIds } },
      include: {
        activities: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    // For each fixture, evaluate canonical calculateLeadStaleness
    const canonicalResults = new Map<string, boolean>();
    for (const lead of testLeads) {
      const info = calculateLeadStaleness(lead as LeadInputForStaleness, testNow);
      canonicalResults.set(lead.name, info.isStale);
    }

    // Specific business rule verifications:
    expect(canonicalResults.get("Parity Lead: Exactly 3 Days Inactive")).toBe(true);
    expect(canonicalResults.get("Parity Lead: 2 Days 23 Hours Inactive")).toBe(false);
    expect(canonicalResults.get("Parity Lead: Fresh Activity")).toBe(false);
    expect(canonicalResults.get("Parity Lead: Stale Activity")).toBe(true);
    expect(canonicalResults.get("Parity Lead: Fresh Contact Date")).toBe(false);
    expect(canonicalResults.get("Parity Lead: Stale Contact Date")).toBe(true);
    expect(canonicalResults.get("Parity Lead: IST Midnight Boundary Stale")).toBe(true);
    expect(canonicalResults.get("Parity Lead: Lost Status Terminal")).toBe(false);
    expect(canonicalResults.get("Parity Lead: Won Status Terminal")).toBe(false);
    expect(canonicalResults.get("Parity Lead: Deleted Soft")).toBe(false);
    expect(canonicalResults.get("Parity Lead: Waste Lead")).toBe(false);
    expect(canonicalResults.get("Parity Lead: Merged Into Other")).toBe(false);

    // Now query the SQL matching for these specific test leads:
    const cutoff = new Date(testNow.getTime() - 3 * 86400000);
    const sqlStaleRows = await db.$queryRaw<Array<{ id: string; name: string }>>`
      SELECT l.id, l.name FROM "Lead" l
      WHERE l.id = ANY(${createdLeadIds})
        AND l."isWaste" = false 
        AND l."deletedAt" IS NULL 
        AND l."mergedIntoLeadId" IS NULL
        AND l.status IN ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT')
        AND (l."lastContactDate" IS NULL OR l."lastContactDate" <= ${cutoff})
        AND l."createdAt" <= ${cutoff}
        AND NOT EXISTS (
          SELECT 1 FROM "LeadActivity" a 
          WHERE a."leadId" = l.id 
            AND a."createdAt" > ${cutoff}
        )
    `;

    const sqlStaleNames = new Set(sqlStaleRows.map((r) => r.name));

    // Every fixture that canonical evaluates as stale MUST be in SQL, and vice-versa!
    for (const [name, isStale] of canonicalResults.entries()) {
      const inSql = sqlStaleNames.has(name);
      expect(inSql).toBe(isStale);
    }
  });

  it("verifies global getStaleLeadsCount(testNow) equals in-memory calculateLeadStaleness count", async () => {
    // 1. Compute via SQL getStaleLeadsCount
    const sqlCount = await getStaleLeadsCount(testNow);

    // 2. Compute via full database fetch + canonical calculateLeadStaleness
    const allActive = await db.lead.findMany({
      where: {
        isWaste: false,
        deletedAt: null,
        mergedIntoLeadId: null,
        status: {
          in: [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED, LeadStatus.PROPOSAL_SENT],
        },
      },
      include: {
        activities: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    const canonicalCount = allActive.filter(
      (l) => calculateLeadStaleness(l as LeadInputForStaleness, testNow).isStale
    ).length;

    // Both MUST be exactly equal!
    expect(sqlCount).toBe(canonicalCount);
  });
});
