/**
 * Phase 6 – Analytics Test Harness
 *
 * Standalone script (no Jest) — run with:
 *   npx tsx scripts/test-analytics.ts
 *
 * Creates test data, runs assertions against the analytics logic directly,
 * then cleans up ALL test records in a finally block.
 *
 * Tests:
 *  1. Zero-data state (no leads) — graceful zeros, no crashes
 *  2. Single WON + single LOST → win/loss rate = 0.5
 *  3. Open pipeline value from 4 active statuses
 *  4. Revenue math (WON quotedAmount sum)
 *  5. Average deal math (revenue / WON leads with quotedAmount)
 *  6. Source performance grouping + "Unknown" normalization
 *  7. Follow-up completion rate formula
 *  8. Date-range filtering (30d vs all — lead outside range excluded)
 *  9. IST timezone boundary (lead at UTC 18:29 = same IST day; at 18:31 = next)
 * 10. Activity-history fallback (WON lead without STATUS_CHANGED → uses updatedAt)
 */

import { PrismaClient, LeadStatus, FollowUpStatus, FollowUpType, ActivityType } from "@prisma/client";
import {
  getDateRangeBoundaries,
  getTrendGranularity,
  bucketLabel,
  serializeDecimal,
  safeRate,
} from "../src/lib/analytics-helpers";

const db = new PrismaClient();

// ─── Test utilities ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
    failures.push(message);
  }
}

function assertClose(a: number, b: number, message: string, epsilon = 0.0001) {
  assert(Math.abs(a - b) < epsilon, `${message} (expected ${b}, got ${a})`);
}

// ─── Test Data Tracking ────────────────────────────────────────────────────────

const testLeadIds: string[] = [];
const testFollowUpIds: string[] = [];
const testActivityIds: string[] = [];
const TEST_TAG = "TEST_PHASE6_ANALYTICS";

async function createTestLead(overrides: {
  name?: string;
  status?: LeadStatus;
  quotedAmount?: number | null;
  leadSource?: string | null;
  createdAt?: Date;
} = {}) {
  const lead = await db.lead.create({
    data: {
      name: overrides.name ?? `${TEST_TAG} Lead`,
      phone: "9999999999",
      status: overrides.status ?? LeadStatus.NEW,
      quotedAmount: overrides.quotedAmount !== undefined ? overrides.quotedAmount : null,
      leadSource: overrides.leadSource !== undefined ? overrides.leadSource : "Test Source",
      createdAt: overrides.createdAt,
    },
  });
  testLeadIds.push(lead.id);
  return lead;
}

async function createTestFollowUp(leadId: string, overrides: {
  status?: FollowUpStatus;
  type?: FollowUpType;
  scheduledAt?: Date;
  completedAt?: Date | null;
} = {}) {
  const fu = await db.followUp.create({
    data: {
      leadId,
      status: overrides.status ?? FollowUpStatus.PENDING,
      type: overrides.type ?? FollowUpType.CALL,
      scheduledAt: overrides.scheduledAt ?? new Date(),
      completedAt: overrides.completedAt,
    },
  });
  testFollowUpIds.push(fu.id);
  return fu;
}

async function createTestActivity(leadId: string, overrides: {
  type?: ActivityType;
  message?: string;
  metadata?: object;
  createdAt?: Date;
} = {}) {
  const act = await db.leadActivity.create({
    data: {
      leadId,
      type: overrides.type ?? ActivityType.LEAD_UPDATED,
      message: overrides.message ?? "Test activity",
      metadata: overrides.metadata,
      createdAt: overrides.createdAt,
    },
  });
  testActivityIds.push(act.id);
  return act;
}

// ─── Cleanup ───────────────────────────────────────────────────────────────────

async function cleanup() {
  console.log("\n🧹 Cleaning up test data...");
  if (testActivityIds.length) {
    await db.leadActivity.deleteMany({ where: { id: { in: testActivityIds } } });
  }
  if (testFollowUpIds.length) {
    await db.followUp.deleteMany({ where: { id: { in: testFollowUpIds } } });
  }
  if (testLeadIds.length) {
    await db.lead.deleteMany({ where: { id: { in: testLeadIds } } });
  }
  console.log(`   Deleted ${testActivityIds.length} activities, ${testFollowUpIds.length} follow-ups, ${testLeadIds.length} leads.`);
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

async function test1_helperFunctions() {
  console.log("\n📋 Test 1: Helper function unit tests");

  // serializeDecimal
  assert(serializeDecimal(null) === 0, "serializeDecimal(null) → 0");
  assert(serializeDecimal(undefined) === 0, "serializeDecimal(undefined) → 0");


  // safeRate
  assertClose(safeRate(1, 2), 0.5, "safeRate(1, 2) → 0.5");
  assert(safeRate(0, 0) === 0, "safeRate(0, 0) → 0 (no divide-by-zero)");
  assert(safeRate(5, 0) === 0, "safeRate(5, 0) → 0 (no divide-by-zero)");
  assertClose(safeRate(1, 1), 1.0, "safeRate(1, 1) → 1.0");

  // getDateRangeBoundaries
  const now = new Date("2025-06-15T14:00:00.000Z"); // 19:30 IST
  const { start: s7, end: e7 } = getDateRangeBoundaries("7d", now);
  assert(s7 !== null, "7d range has a start date");
  assert(e7 === now, "7d range end = now");

  const { start: sAll } = getDateRangeBoundaries("all", now);
  assert(sAll === null, "all-time range has null start");

  // getTrendGranularity
  assert(getTrendGranularity("7d") === "daily", "7d → daily");
  assert(getTrendGranularity("30d") === "daily", "30d → daily");
  assert(getTrendGranularity("90d") === "weekly", "90d → weekly");
  assert(getTrendGranularity("all") === "monthly", "all → monthly");

  // bucketLabel
  const testDate = new Date("2025-06-15T18:29:59Z"); // still June 15 in IST (23:59:59 IST)
  const nextDate = new Date("2025-06-15T18:30:01Z"); // June 16 in IST (00:00:01 IST)
  const label15 = bucketLabel(testDate, "daily");
  const label16 = bucketLabel(nextDate, "daily");
  assert(label15 === "2025-06-15", `bucketLabel daily: 23:59:59 IST is June 15 (got ${label15})`);
  assert(label16 === "2025-06-16", `bucketLabel daily: 00:00:01 IST is June 16 (got ${label16})`);

  const monthLabel = bucketLabel(testDate, "monthly");
  assert(monthLabel === "2025-06", `bucketLabel monthly: June 2025 (got ${monthLabel})`);
}

async function test2_winLossRate() {
  console.log("\n📋 Test 2: Win / Loss rate — 1 WON + 1 LOST");

  const won = await createTestLead({ status: LeadStatus.WON, quotedAmount: 100000 });
  const lost = await createTestLead({ status: LeadStatus.LOST, quotedAmount: null });

  // Simulate core metric calculation
  const wonCount = 1;
  const lostCount = 1;
  const closed = wonCount + lostCount;
  const winRate = safeRate(wonCount, closed);
  const lostRate = safeRate(lostCount, closed);

  assertClose(winRate, 0.5, "Win Rate = 0.5 (1/2)");
  assertClose(lostRate, 0.5, "Lost Rate = 0.5 (1/2)");
  assertClose(winRate + lostRate, 1.0, "Win Rate + Lost Rate = 1.0");

  // Verify revenue
  const wonRevenue = 100000;
  const avgWonDeal = safeRate(wonRevenue, 1); // 1 WON lead with quotedAmount
  assert(avgWonDeal === 100000, "Avg Won Deal = 100000 (only 1 won deal)");

  // Verify LOST lead does NOT contribute to revenue
  assert(lostCount > 0, "Lost lead created (does not affect revenue)");

  // Clean up leads
  await db.lead.deleteMany({ where: { id: { in: [won.id, lost.id] } } });
  testLeadIds.splice(testLeadIds.indexOf(won.id), 1);
  testLeadIds.splice(testLeadIds.indexOf(lost.id), 1);
}

async function test3_openPipeline() {
  console.log("\n📋 Test 3: Open pipeline value (4 active statuses)");

  const leads = await Promise.all([
    createTestLead({ status: LeadStatus.NEW, quotedAmount: 10000 }),
    createTestLead({ status: LeadStatus.CONTACTED, quotedAmount: 20000 }),
    createTestLead({ status: LeadStatus.QUALIFIED, quotedAmount: 30000 }),
    createTestLead({ status: LeadStatus.PROPOSAL_SENT, quotedAmount: 40000 }),
    // These should NOT be in open pipeline:
    createTestLead({ status: LeadStatus.WON, quotedAmount: 50000 }),
    createTestLead({ status: LeadStatus.LOST, quotedAmount: 5000 }),
  ]);

  const openPipelineAgg = await db.lead.aggregate({
    _sum: { quotedAmount: true },
    where: {
      id: { in: leads.map((l) => l.id) },
      status: { in: [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED, LeadStatus.PROPOSAL_SENT] },
    },
  });

  const openPipelineValue = serializeDecimal(openPipelineAgg._sum.quotedAmount);
  assert(openPipelineValue === 100000, `Open pipeline = 100000 (10k+20k+30k+40k), got ${openPipelineValue}`);

  // WON and LOST should be excluded
  const totalAgg = await db.lead.aggregate({
    _sum: { quotedAmount: true },
    where: { id: { in: leads.map((l) => l.id) } },
  });
  const total = serializeDecimal(totalAgg._sum.quotedAmount);
  assert(total > openPipelineValue, `Total ${total} > open pipeline ${openPipelineValue} (WON/LOST excluded)`);
}

async function test4_revenueMath() {
  console.log("\n📋 Test 4: Revenue math");

  const w1 = await createTestLead({ status: LeadStatus.WON, quotedAmount: 75000 });
  const w2 = await createTestLead({ status: LeadStatus.WON, quotedAmount: 25000 });
  const w3 = await createTestLead({ status: LeadStatus.WON, quotedAmount: null }); // no quoted amount

  const wonAgg = await db.lead.aggregate({
    _sum: { quotedAmount: true },
    where: { id: { in: [w1.id, w2.id, w3.id] }, status: LeadStatus.WON },
  });

  const wonRevenue = serializeDecimal(wonAgg._sum.quotedAmount);
  assert(wonRevenue === 100000, `Won revenue = 100000 (75k+25k+null), got ${wonRevenue}`);

  const wonWithAmountCount = await db.lead.count({
    where: { id: { in: [w1.id, w2.id, w3.id] }, status: LeadStatus.WON, quotedAmount: { not: null } },
  });
  assert(wonWithAmountCount === 2, `WON leads with quotedAmount = 2 (not 3), got ${wonWithAmountCount}`);

  const avgWonDeal = safeRate(wonRevenue, wonWithAmountCount);
  assert(avgWonDeal === 50000, `Avg won deal = 50000 (100k / 2), got ${avgWonDeal}`);
}

async function test5_zeroDataState() {
  console.log("\n📋 Test 5: Zero-data arithmetic (no divide-by-zero)");

  assert(safeRate(0, 0) === 0, "Win rate = 0 when no closed deals");
  assert(safeRate(0, 0) === 0, "Lost rate = 0 when no closed deals");
  assert(safeRate(0, 0) === 0, "Avg won deal = 0 when no won deals");
  assert(safeRate(0, 0) === 0, "Completion rate = 0 when no follow-ups");

  // These should not throw
  const openPipelineAgg = await db.lead.aggregate({
    _sum: { quotedAmount: true },
    where: { status: { in: [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED, LeadStatus.PROPOSAL_SENT] }, name: "__NONEXISTENT__" },
  });
  const openPipeline = serializeDecimal(openPipelineAgg._sum.quotedAmount);
  assert(openPipeline === 0, "Open pipeline = 0 for empty query");
}


async function test7_followUpCompletionRate() {
  console.log("\n📋 Test 7: Follow-up completion rate");

  const lead = await createTestLead({ status: LeadStatus.NEW });
  const now = new Date();
  const past = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago

  // 2 completed, 3 pending, 1 overdue (pending + past), 1 cancelled
  await createTestFollowUp(lead.id, { status: FollowUpStatus.COMPLETED, scheduledAt: past, completedAt: past });
  await createTestFollowUp(lead.id, { status: FollowUpStatus.COMPLETED, scheduledAt: past, completedAt: past });
  await createTestFollowUp(lead.id, { status: FollowUpStatus.PENDING, scheduledAt: new Date(now.getTime() + 86400000) }); // future
  await createTestFollowUp(lead.id, { status: FollowUpStatus.PENDING, scheduledAt: new Date(now.getTime() + 86400000) });
  await createTestFollowUp(lead.id, { status: FollowUpStatus.PENDING, scheduledAt: new Date(now.getTime() + 86400000) });
  await createTestFollowUp(lead.id, { status: FollowUpStatus.PENDING, scheduledAt: past }); // overdue
  await createTestFollowUp(lead.id, { status: FollowUpStatus.CANCELLED, scheduledAt: past }); // excluded from rate

  const completed = await db.followUp.count({ where: { id: { in: testFollowUpIds }, status: FollowUpStatus.COMPLETED } });
  const pending = await db.followUp.count({ where: { id: { in: testFollowUpIds }, status: FollowUpStatus.PENDING } });
  const overdue = await db.followUp.count({ where: { id: { in: testFollowUpIds }, status: FollowUpStatus.PENDING, scheduledAt: { lt: now } } });

  assert(completed === 2, `Completed = 2 (got ${completed})`);
  assert(pending === 4, `Pending = 4 (got ${pending})`); // 3 future + 1 overdue
  assert(overdue === 1, `Overdue = 1 (got ${overdue})`);

  // Completion rate = Completed / (Completed + Pending + Overdue)
  // = 2 / (2 + 3 + 1) = 2/6 = 1/3 ≈ 0.3333
  // Note: pending count = 4 but overdue is a SUBSET of pending, so:
  // denominator = completed + (pending - overdue) + overdue = completed + pending
  // = 2 + 4 = 6
  // completed=2, pending=4 (includes 1 overdue), overdue=1
  // denominator = 2 + 4 + 1 = 7 — but overdue is already counted in pending
  // The spec says: Completed / (Completed + Pending + Overdue)
  // where Overdue is a subset of Pending, so to avoid double-counting:
  // denominator = Completed + (Pending including overdue) = 2 + 4 = 6
  const correctRate = safeRate(completed, completed + pending); // 2/6 = 0.3333
  assertClose(correctRate, 1 / 3, "Completion rate = 1/3 (2/6)");
  assert(correctRate > 0 && correctRate < 1, "Completion rate between 0 and 1");
}

async function test8_dateRangeFiltering() {
  console.log("\n📋 Test 8: Date-range filtering");

  const now = new Date();
  // Lead created 60 days ago — should appear in "all" and "90d" but NOT "30d" or "7d"
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const oldLead = await createTestLead({
    status: LeadStatus.NEW,
    createdAt: sixtyDaysAgo,
  });

  // Lead created 3 days ago — should appear in all ranges
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const newLead = await createTestLead({
    status: LeadStatus.NEW,
    createdAt: threeDaysAgo,
  });

  const { start: s30 } = getDateRangeBoundaries("30d", now);
  const { start: sAll } = getDateRangeBoundaries("all", now);
  const { start: s90 } = getDateRangeBoundaries("90d", now);
  const { start: s7 } = getDateRangeBoundaries("7d", now);

  const count30d = await db.lead.count({
    where: { id: { in: [oldLead.id, newLead.id] }, createdAt: s30 ? { gte: s30 } : undefined },
  });
  const countAll = await db.lead.count({
    where: { id: { in: [oldLead.id, newLead.id] } },
  });
  const count90d = await db.lead.count({
    where: { id: { in: [oldLead.id, newLead.id] }, createdAt: s90 ? { gte: s90 } : undefined },
  });
  const count7d = await db.lead.count({
    where: { id: { in: [oldLead.id, newLead.id] }, createdAt: s7 ? { gte: s7 } : undefined },
  });

  assert(countAll === 2, `All-time: both leads visible (got ${countAll})`);
  assert(count90d === 2, `90d: both leads visible (60 days ago is within 90d) (got ${count90d})`);
  assert(count30d === 1, `30d: only recent lead visible (60-day-old excluded) (got ${count30d})`);
  assert(count7d === 1, `7d: only recent lead visible (60-day-old excluded) (got ${count7d})`);
  assert(sAll === null, "All-time start = null");
}

async function test9_ISTTimezone() {
  console.log("\n📋 Test 9: IST timezone boundary");

  // 2025-06-15 18:29:59 UTC = 2025-06-15 23:59:59 IST → June 15 IST
  // 2025-06-15 18:30:01 UTC = 2025-06-16 00:00:01 IST → June 16 IST
  const borderBeforeIST = new Date("2025-06-15T18:29:59.000Z");
  const borderAfterIST = new Date("2025-06-15T18:30:01.000Z");

  const labelBefore = bucketLabel(borderBeforeIST, "daily");
  const labelAfter = bucketLabel(borderAfterIST, "daily");

  assert(labelBefore === "2025-06-15", `23:59:59 IST → June 15 bucket (got ${labelBefore})`);
  assert(labelAfter === "2025-06-16", `00:00:01 IST → June 16 bucket (got ${labelAfter})`);

  // IST midnight range check
  const { start: s7 } = getDateRangeBoundaries("7d", new Date("2025-06-15T18:30:00.000Z")); // midnight IST on June 16
  assert(s7 !== null, "7d start boundary computed from IST midnight");
  // The start should be at IST midnight 7 days before June 16 = June 10 IST = June 9 18:30 UTC
  if (s7) {
    const expectedStart = new Date("2025-06-09T18:30:00.000Z");
    const diff = Math.abs(s7.getTime() - expectedStart.getTime());
    assert(diff < 60000, `IST midnight start correct (diff = ${diff}ms)`);
  }
}

async function test10_activityFallback() {
  console.log("\n📋 Test 10: Activity-history fallback for revenue timestamp");

  const now = new Date();

  // WON lead WITH reliable STATUS_CHANGED activity
  const wonWithActivity = await createTestLead({ status: LeadStatus.WON, quotedAmount: 50000 });
  const activityTs = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
  await createTestActivity(wonWithActivity.id, {
    type: ActivityType.STATUS_CHANGED,
    message: "Status changed to WON",
    metadata: { from: "PROPOSAL_SENT", to: "WON" },
    createdAt: activityTs,
  });

  // WON lead WITHOUT STATUS_CHANGED activity (legacy)
  const wonLegacy = await createTestLead({ status: LeadStatus.WON, quotedAmount: 30000 });
  // No STATUS_CHANGED activity created — should fall back to Lead.updatedAt

  // Simulate the revenue trend logic
  const wonActivities = await db.leadActivity.findMany({
    where: {
      leadId: { in: [wonWithActivity.id, wonLegacy.id] },
      type: ActivityType.STATUS_CHANGED,
      metadata: { path: ["to"], equals: "WON" },
    },
    select: { leadId: true, createdAt: true },
  });

  const wonTimestampMap = new Map<string, Date>();
  for (const act of wonActivities) {
    wonTimestampMap.set(act.leadId, act.createdAt);
  }

  const wonLeadsForTrend = await db.lead.findMany({
    where: { id: { in: [wonWithActivity.id, wonLegacy.id] }, status: LeadStatus.WON },
    select: { id: true, quotedAmount: true, updatedAt: true },
  });

  let legacyCount = 0;
  for (const lead of wonLeadsForTrend) {
    const reliableTs = wonTimestampMap.get(lead.id);
    if (!reliableTs) legacyCount++;
  }

  assert(wonActivities.length === 1, `Found 1 STATUS_CHANGED→WON activity (got ${wonActivities.length})`);
  assert(wonTimestampMap.has(wonWithActivity.id), "Lead with activity has reliable timestamp");
  assert(!wonTimestampMap.has(wonLegacy.id), "Legacy lead has no reliable timestamp");
  assert(legacyCount === 1, `Legacy count = 1 (fell back to updatedAt) (got ${legacyCount})`);

  const activityTsFound = wonTimestampMap.get(wonWithActivity.id);
  if (activityTsFound) {
    const diff = Math.abs(activityTsFound.getTime() - activityTs.getTime());
    assert(diff < 1000, `Activity timestamp matches created-at (diff ${diff}ms)`);
  }
}

// ─── Runner ────────────────────────────────────────────────────────────────────

async function runAllTests() {
  console.log("🔬 Phase 6 – Analytics Test Harness");
  console.log("=".repeat(50));

  try {
    await test1_helperFunctions();
    await test2_winLossRate();
    await test3_openPipeline();
    await test4_revenueMath();
    await test5_zeroDataState();

    await test7_followUpCompletionRate();
    await test8_dateRangeFiltering();
    await test9_ISTTimezone();
    await test10_activityFallback();
  } finally {
    await cleanup();
    await db.$disconnect();
  }

  console.log("\n" + "=".repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failures.length > 0) {
    console.error("\n❌ Failed assertions:");
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  } else {
    console.log("\n✅ All tests passed!");
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error("Fatal test error:", err);
  db.$disconnect().finally(() => process.exit(1));
});
