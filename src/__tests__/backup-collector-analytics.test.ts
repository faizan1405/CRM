import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BackupDataset } from "@/lib/backup/types";
import { collectBackupDataset } from "@/lib/backup/collector";
import { buildBackupAnalytics } from "@/lib/backup/analytics";
import { buildCompleteExportJson, buildRawDataFiles } from "@/lib/backup/raw-data";
import { capRows } from "@/lib/backup/pdf/reports/shared";
import type { BackupAnalytics } from "@/lib/backup/analytics";

/* -------------------------------------------------------------------------- */
/*  Prisma mock (pagination-aware, records every query for assertions)         */
/* -------------------------------------------------------------------------- */

const state = vi.hoisted(() => ({
  tables: {} as Record<string, Array<Record<string, unknown>>>,
  queries: [] as Array<{ model: string; args: Record<string, unknown> }>,
  transactionOptions: [] as Array<Record<string, unknown>>,
  transactionFails: false,
  accessedModels: [] as string[],
}));

vi.mock("@/lib/db", () => {
  const paginate = (rows: Array<Record<string, unknown>>, args: Record<string, unknown>) => {
    let list = [...rows].sort((left, right) => String(left.id).localeCompare(String(right.id)));
    const cursor = args.cursor as { id?: string } | undefined;
    if (cursor?.id) {
      const index = list.findIndex((row) => row.id === cursor.id);
      if (index >= 0) list = list.slice(index + (Number(args.skip) || 0));
    }
    const take = Number(args.take);
    return Number.isFinite(take) && take > 0 ? list.slice(0, take) : list;
  };

  const makeDelegate = (model: string) => ({
    findMany: async (args: Record<string, unknown> = {}) => {
      state.queries.push({ model, args });
      state.accessedModels.push(model);
      return paginate(state.tables[model] ?? [], args);
    },
    count: async () => {
      state.accessedModels.push(model);
      return (state.tables[model] ?? []).length;
    },
    findUnique: async () => {
      state.accessedModels.push(model);
      return (state.tables[model] ?? [])[0] ?? null;
    },
  });

  const models = [
    "user",
    "lead",
    "deal",
    "payment",
    "followUp",
    "leadActivity",
    "leadAIInsight",
    "leadLossEvent",
    "personalNote",
    "websitePackage",
    "websiteSample",
    "whatsAppTemplate",
    "salesNotification",
    "dailySalesBriefing",
    "undoAction",
    "dispatchedMobileAlert",
    "crmSyncState",
    // Present only so an accidental read can be detected by the test suite.
    "mobilePushSubscription",
  ];

  const transactionClient = Object.fromEntries(models.map((model) => [model, makeDelegate(model)]));

  return {
    db: {
      ...transactionClient,
      $transaction: async (callback: (tx: unknown) => Promise<unknown>, options: Record<string, unknown>) => {
        state.transactionOptions.push(options);
        if (state.transactionFails) throw new Error("interactive transactions unavailable");
        return callback(transactionClient);
      },
    },
  };
});

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

const LEAD_ID = "11111111-1111-4111-8111-111111111111";

function makeLead(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Lead ${id}`,
    phone: "9876543210",
    email: null,
    business: null,
    industry: null,
    leadSource: "MANUAL",
    budget: null,
    status: "QUALIFIED",
    quickStatus: "NONE",
    isWaste: false,
    isPinned: false,
    quotedAmount: null,
    lastContactDate: null,
    nextFollowUpDate: null,
    notes: null,
    deletedAt: null,
    mergedIntoLeadId: null,
    mergedAt: null,
    createdAt: new Date("2026-01-05T04:15:00Z"),
    updatedAt: new Date("2026-02-05T04:15:00Z"),
    ...overrides,
  };
}

function seedTables() {
  const leads = [
    makeLead(LEAD_ID),
    makeLead("22222222-2222-4222-8222-222222222222", {
      name: "Multi Project Client",
      business: "Udyog Engineers",
      status: "WON",
      quotedAmount: "150000",
      notes: "Prefers ₹ pricing.\nSecond line of note with ग्राहक text.",
    }),
    makeLead("33333333-3333-4333-8333-333333333333", { isWaste: true, name: "Waste Lead" }),
    makeLead("44444444-4444-4444-8444-444444444444", {
      deletedAt: new Date("2026-03-01T00:00:00Z"),
      name: "Archived Lead",
    }),
    makeLead("55555555-5555-4555-8555-555555555555", {
      mergedIntoLeadId: LEAD_ID,
      mergedAt: new Date("2026-03-02T00:00:00Z"),
      name: "Merged Away Lead",
    }),
    // Bulk rows to exercise pagination.
    ...Array.from({ length: 200 }, (_unused, index) =>
      makeLead(`9${String(index).padStart(7, "0")}-0000-4000-8000-000000000000`, { name: `Bulk Lead ${index}` })
    ),
  ];

  const deals = [
    { id: "aaaaaaaa-0000-4000-8000-000000000001", source: "CRM_LEAD", leadId: LEAD_ID, finalAmount: "100000", status: "CONFIRMED", projectName: "Website", currency: "INR", nextPaymentDueDate: new Date("2026-02-01T00:00:00Z"), nextPaymentDueAmount: "60000", createdAt: new Date("2026-01-10T00:00:00Z"), updatedAt: new Date("2026-01-10T00:00:00Z"), quotedAmount: null, notes: null, clientNameSnapshot: null, companyNameSnapshot: null, clientPhone: null, clientEmail: null, submissionId: null },
    { id: "aaaaaaaa-0000-4000-8000-000000000002", source: "CRM_LEAD", leadId: LEAD_ID, finalAmount: "50000", status: "NEGOTIATING", projectName: "Marketing", currency: "INR", nextPaymentDueDate: null, nextPaymentDueAmount: null, createdAt: new Date("2026-01-12T00:00:00Z"), updatedAt: new Date("2026-01-12T00:00:00Z"), quotedAmount: null, notes: null, clientNameSnapshot: null, companyNameSnapshot: null, clientPhone: null, clientEmail: null, submissionId: null },
    { id: "aaaaaaaa-0000-4000-8000-000000000003", source: "OTHER_CLIENT", leadId: null, finalAmount: "25000", status: "COMPLETED", projectName: "Standalone Branding", currency: "INR", clientNameSnapshot: "Global Corp", companyNameSnapshot: "Global Corp Pvt Ltd", clientPhone: "9000000000", clientEmail: null, nextPaymentDueDate: null, nextPaymentDueAmount: null, createdAt: new Date("2026-01-14T00:00:00Z"), updatedAt: new Date("2026-01-14T00:00:00Z"), quotedAmount: null, notes: "Referral project", submissionId: null },
  ];

  const payments = [
    { id: "bbbbbbbb-0000-4000-8000-000000000001", dealId: "aaaaaaaa-0000-4000-8000-000000000001", amount: "40000", paymentDate: new Date("2026-01-20T00:00:00Z"), type: "ADVANCE", customType: null, method: "UPI", reference: "UTR-1", note: "Advance", createdAt: new Date("2026-01-20T00:00:00Z"), updatedAt: new Date("2026-01-20T00:00:00Z") },
    { id: "bbbbbbbb-0000-4000-8000-000000000002", dealId: "aaaaaaaa-0000-4000-8000-000000000001", amount: "10000", paymentDate: new Date("2026-01-25T00:00:00Z"), type: "PARTIAL", customType: "Milestone", method: "BANK_TRANSFER", reference: null, note: null, createdAt: new Date("2026-01-25T00:00:00Z"), updatedAt: new Date("2026-01-25T00:00:00Z") },
    { id: "bbbbbbbb-0000-4000-8000-000000000003", dealId: "aaaaaaaa-0000-4000-8000-000000000003", amount: "25000", paymentDate: new Date("2026-01-28T00:00:00Z"), type: "FINAL", customType: null, method: "CASH", reference: null, note: null, createdAt: new Date("2026-01-28T00:00:00Z"), updatedAt: new Date("2026-01-28T00:00:00Z") },
  ];

  state.tables = {
    user: [
      { id: "user-1", name: "Faizan Admin", email: "admin@scale.flow", role: "ADMIN", createdAt: new Date("2025-01-01T00:00:00Z"), updatedAt: new Date("2025-01-01T00:00:00Z") },
    ],
    lead: leads,
    deal: deals,
    payment: payments,
    followUp: [
      { id: "cccccccc-0000-4000-8000-000000000001", leadId: LEAD_ID, scheduledAt: new Date("2026-02-10T04:30:00Z"), type: "CALL", status: "PENDING", note: "Call back", completedAt: null, submissionId: null, createdAt: new Date("2026-02-01T00:00:00Z"), updatedAt: new Date("2026-02-01T00:00:00Z") },
      { id: "cccccccc-0000-4000-8000-000000000002", leadId: LEAD_ID, scheduledAt: new Date("2026-01-11T04:30:00Z"), type: "WHATSAPP", status: "COMPLETED", note: null, completedAt: new Date("2026-01-11T06:00:00Z"), submissionId: "sub-1", createdAt: new Date("2026-01-10T00:00:00Z"), updatedAt: new Date("2026-01-11T06:00:00Z") },
    ],
    leadActivity: [
      { id: "dddddddd-0000-4000-8000-000000000001", leadId: LEAD_ID, type: "LEAD_CREATED", message: "Lead created", metadata: { source: "MANUAL" }, createdByUserId: "user-1", createdAt: new Date("2026-01-05T04:15:00Z") },
      { id: "dddddddd-0000-4000-8000-000000000002", leadId: LEAD_ID, type: "NOTE_ADDED", message: "Discussed scope", metadata: null, createdByUserId: null, createdAt: new Date("2026-01-06T04:15:00Z") },
    ],
    leadAIInsight: [],
    leadLossEvent: [],
    personalNote: [
      { id: "eeeeeeee-0000-4000-8000-000000000001", userId: "user-1", title: "Vendor list", content: "Follow up with vendors", isPinned: true, createdAt: new Date("2026-01-02T00:00:00Z"), updatedAt: new Date("2026-01-02T00:00:00Z") },
    ],
    websitePackage: [
      { id: "ffffffff-0000-4000-8000-000000000001", name: "Starter", price: "19999", isStartingPrice: true, inclusions: "5 pages", hosting: "1 year", domain: "1 year", isActive: true, sortOrder: 1, createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z") },
    ],
    websiteSample: [],
    whatsAppTemplate: [],
    salesNotification: [],
    dailySalesBriefing: [],
    undoAction: [],
    dispatchedMobileAlert: [],
    mobilePushSubscription: [
      { id: "secret-1", userId: "user-1", endpoint: "https://push.example/abc", p256dh: "SECRET_P256DH", auth: "SECRET_AUTH", platform: "web", userAgent: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ],
    crmSyncState: [{ id: "global", version: 42, updatedAt: new Date("2026-02-01T00:00:00Z") }],
  };
}

async function collectWithTables() {
  seedTables();
  return collectBackupDataset({ batchSize: 50 });
}

/* -------------------------------------------------------------------------- */
/*  Collector                                                                  */
/* -------------------------------------------------------------------------- */

describe("Complete backup collector", () => {
  beforeEach(() => {
    state.queries = [];
    state.transactionOptions = [];
    state.transactionFails = false;
    state.accessedModels = [];
    seedTables();
  });

  it("reads every table inside one repeatable-read snapshot with no row limit", async () => {
    const { dataset } = await collectWithTables();

    expect(state.transactionOptions[0]).toMatchObject({ isolationLevel: "RepeatableRead" });
    expect(dataset.meta.snapshotMode).toBe("transaction-repeatable-read");

    // 205 leads seeded, page size 50 => cursor pagination must reach every row.
    expect(dataset.leads).toHaveLength(205);
    expect(dataset.meta.fetchedCounts.leads).toBe(205);
    expect(dataset.meta.databaseCounts.leads).toBe(205);
    expect(dataset.meta.batchCount).toBeGreaterThanOrEqual(4);

    // Every category is present, including the ones that are legitimately empty.
    expect(Object.keys(dataset.meta.fetchedCounts)).toEqual([
      "users",
      "leads",
      "deals",
      "payments",
      "followUps",
      "activities",
      "aiInsights",
      "lossEvents",
      "personalNotes",
      "packages",
      "samples",
      "templates",
      "notifications",
      "briefings",
      "undoActions",
      "mobileAlerts",
    ]);
    expect(dataset.aiInsights).toEqual([]);
    expect(dataset.lossEvents).toEqual([]);
  });

  it("includes historical leads (waste, archived and merged) and keeps their markers", async () => {
    const { dataset } = await collectWithTables();
    const waste = dataset.leads.find((lead) => lead.isWaste);
    const archived = dataset.leads.find((lead) => lead.deletedAt !== null);
    const merged = dataset.leads.find((lead) => lead.mergedIntoLeadId !== null);

    expect(waste?.name).toBe("Waste Lead");
    expect(archived?.name).toBe("Archived Lead");
    expect(merged?.mergedIntoLeadId).toBe(LEAD_ID);
  });

  it("keeps multiple projects of one client separate and maps every payment to its deal", async () => {
    const { dataset } = await collectWithTables();
    const clientDeals = dataset.deals.filter((deal) => deal.leadId === LEAD_ID);
    const projectIds = new Set(dataset.deals.map((deal) => deal.id));

    expect(clientDeals).toHaveLength(2);
    expect(clientDeals.map((deal) => deal.projectName).sort()).toEqual(["Marketing", "Website"]);

    const paymentsForWebsite = dataset.payments.filter(
      (payment) => payment.dealId === "aaaaaaaa-0000-4000-8000-000000000001"
    );
    expect(paymentsForWebsite).toHaveLength(2);
    expect(dataset.payments.every((payment) => projectIds.has(payment.dealId))).toBe(true);
  });

  it("falls back to sequential batched reads when a long snapshot transaction is unavailable", async () => {
    state.transactionFails = true;
    const { dataset } = await collectWithTables();

    expect(dataset.meta.snapshotMode).toBe("sequential-batched");
    expect(dataset.meta.warnings.join(" ")).toMatch(/snapshot transaction was unavailable/i);
    expect(dataset.leads).toHaveLength(205);
  });

  it("never reads credential or push-subscription material", async () => {
    await collectWithTables();

    const userQuery = state.queries.find((query) => query.model === "user");
    expect(userQuery).toBeDefined();
    const select = (userQuery?.args as { select?: Record<string, boolean> }).select ?? {};
    expect(Object.keys(select).sort()).toEqual(["createdAt", "email", "id", "name", "role", "updatedAt"]);
    expect(select).not.toHaveProperty("passwordHash");

    expect(state.accessedModels).not.toContain("mobilePushSubscription");
    expect(JSON.stringify(state.queries)).not.toContain("passwordHash");
    expect(JSON.stringify(state.queries)).not.toContain("p256dh");
  });
});

/* -------------------------------------------------------------------------- */
/*  Analytics & serialisation                                                  */
/* -------------------------------------------------------------------------- */

describe("Backup analytics, raw files and JSON export", () => {
  async function buildDataset(): Promise<BackupDataset> {
    const { dataset } = await collectWithTables();
    return dataset;
  }

  it("reconciles money received and outstanding without double counting multi-project clients", async () => {
    const dataset = await buildDataset();
    const analytics: BackupAnalytics = buildBackupAnalytics(dataset);

    // 100000 + 50000 (one CRM client, two projects) + 25000 (other client)
    expect(analytics.reconciliation.contractedDealValue).toBe(175000);
    expect(analytics.reconciliation.moneyReceived).toBe(75000);
    expect(analytics.reconciliation.outstanding).toBe(100000);
    expect(analytics.reconciliation.collectionRate).toBeCloseTo(42.86, 2);

    expect(analytics.reconciliation.moneyReceived).toBe(analytics.reconciliation.dealLevelReceivedSum);
    expect(analytics.reconciliation.moneyReceived).toBe(analytics.reconciliation.paymentLevelReceivedSum);
    expect(analytics.reconciliation.outstanding).toBe(analytics.reconciliation.dealLevelOutstandingSum);

    const clientGroup = analytics.clientGroups.find((group) => group.key === `lead:${LEAD_ID}`);
    expect(clientGroup?.dealCount).toBe(2);
    expect(clientGroup?.contracted).toBe(150000);
    expect(clientGroup?.received).toBe(50000);
    expect(analytics.clientsWithMultipleDeals).toHaveLength(1);

    // Payment → deal mapping is preserved per project.
    expect(analytics.dealsById.get("aaaaaaaa-0000-4000-8000-000000000001")?.received).toBe(50000);
    expect(analytics.dealsById.get("aaaaaaaa-0000-4000-8000-000000000002")?.received).toBe(0);
    expect(analytics.dealsById.get("aaaaaaaa-0000-4000-8000-000000000003")?.paymentStatus).toBe("Paid");
  });

  it("exports every category to CSV/JSON with stable ids and no credential fields", async () => {
    const dataset = await buildDataset();
    const analytics = buildBackupAnalytics(dataset);
    const files = buildRawDataFiles(dataset);
    const json = buildCompleteExportJson({
      dataset,
      analytics,
      generatedAt: new Date("2026-10-13T04:15:00Z").toISOString(),
      generatedBy: { id: "user-1", name: "Faizan Admin", email: "admin@scale.flow", role: "ADMIN" },
    });

    const paths = files.map((file) => file.path);
    expect(paths).toEqual([
      "Raw Data/leads.csv",
      "Raw Data/deals.csv",
      "Raw Data/payments.csv",
      "Raw Data/followups.csv",
      "Raw Data/activities.csv",
      "Raw Data/notes.csv",
      "Raw Data/ai_insights.csv",
      "Raw Data/loss_events.csv",
      "Raw Data/sales_assets.csv",
      "Raw Data/notifications.csv",
      "Raw Data/daily_briefings.csv",
      "Raw Data/users.csv",
      "Raw Data/undo_actions.csv",
      "Raw Data/mobile_alert_log.csv",
    ]);

    const leadsCsv = files.find((file) => file.path.endsWith("leads.csv"))?.buffer.toString("utf8") ?? "";
    expect(leadsCsv.startsWith("\uFEFF")).toBe(true);
    expect(leadsCsv.split("\r\n")[0]).toContain("merged_into_lead_id");
    expect(leadsCsv).toContain(LEAD_ID);
    expect(leadsCsv.split("\r\n").length - 1).toBe(205);

    const notesCsv = files.find((file) => file.path.endsWith("notes.csv"))?.buffer.toString("utf8") ?? "";
    expect(notesCsv).toContain("PERSONAL_NOTE");
    expect(notesCsv).toContain("LEAD_NOTE");

    const usersCsv = files.find((file) => file.path.endsWith("users.csv"))?.buffer.toString("utf8") ?? "";
    expect(usersCsv.split("\r\n")[0]).toBe("id,name,email,role,created_at,updated_at");

    // No credential or push-subscription material anywhere in the raw export.
    const everything = files.map((file) => file.buffer.toString("utf8")).join("\n") + json;
    for (const forbidden of ["passwordHash", "SECRET_P256DH", "SECRET_AUTH", "p256dh", "$2a$", "$2b$"]) {
      expect(everything).not.toContain(forbidden);
    }

    // Relationship keys are preserved for a future restore.
    const parsed = JSON.parse(json) as {
      tables: { deals: Array<{ id: string; leadId: string | null }>; payments: Array<{ dealId: string }> };
      financials: { moneyReceived: number };
    };
    expect(parsed.tables.deals.some((deal) => deal.leadId === LEAD_ID)).toBe(true);
    expect(parsed.tables.payments.every((payment) => typeof payment.dealId === "string")).toBe(true);
    expect(parsed.financials.moneyReceived).toBe(75000);
    expect(json).toContain("Deal.leadId");
  });

  it("caps report tables explicitly instead of dropping rows silently", () => {
    const rows = Array.from({ length: 4000 }, (_unused, index) => [String(index)]);
    const capped = capRows(rows);
    expect(capped.shown).toBe(2500);
    expect(capped.total).toBe(4000);
    expect(capped.omitted).toBe(1500);

    const small = capRows([[ "1" ]]);
    expect(small.omitted).toBe(0);
  });
});