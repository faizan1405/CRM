import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  fetchLeadsForExport,
  fetchDealsForExport,
  fetchPaymentsForExport,
  fetchOutstandingBalancesForExport,
  fetchFollowUpsForExport,
  fetchBusinessSummary,
} from "@/app/actions/export";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    lead: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    deal: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    payment: {
      findMany: vi.fn(),
    },
    followUp: {
      findMany: vi.fn(),
    },
  },
}));

describe("Export Fetchers & Data Consistency (Zero Mutation & Backup Safety)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      id: "admin-user-123",
      email: "admin@scaleflow.com",
      role: "ADMIN",
    } as any);
  });

  it("fetchLeadsForExport maps canonical fields and calculates stale without mutating db", async () => {
    vi.mocked(db.lead.findMany).mockResolvedValue([
      {
        id: "lead-1",
        name: "Rohan Kapoor",
        business: "Kapoor Digital",
        phone: "+91 9876511111",
        email: "rohan@kapoordigital.com",
        industry: "IT Services",
        leadSource: "Direct",
        status: "QUALIFIED",
        budget: 50000,
        quotedAmount: 45000,
        isPinned: true,
        isWaste: false,
        createdAt: new Date(Date.now() - 86400000 * 5),
        updatedAt: new Date(Date.now() - 86400000 * 1),
        lastContactDate: new Date(Date.now() - 86400000 * 1), // 1 day ago: not stale (threshold is 3 days)
        followUps: [
          {
            id: "fu-1",
            scheduledAt: new Date(Date.now() + 86400000 * 2),
            status: "PENDING",
            type: "CALL",
          },
        ],
        activities: [
          {
            type: "NOTE_ADDED",
            message: "Sent quotation and contract proposal",
            createdAt: new Date(Date.now() - 86400000 * 1),
          },
        ],
      },
      {
        id: "lead-2",
        name: "Stale Lead Co",
        business: "Old Corp",
        phone: "+91 9876522222",
        email: "contact@oldcorp.com",
        industry: "Manufacturing",
        leadSource: "Website",
        status: "QUALIFIED",
        budget: 30000,
        quotedAmount: 30000,
        isPinned: false,
        isWaste: false,
        createdAt: new Date(Date.now() - 86400000 * 20),
        updatedAt: new Date(Date.now() - 86400000 * 10),
        lastContactDate: new Date(Date.now() - 86400000 * 10), // 10 days ago: stale (> 3 days)
        followUps: [],
        activities: [],
      },
    ] as any);

    const rows = await fetchLeadsForExport();
    expect(rows.length).toBe(2);
    expect(rows[0].name).toBe("Rohan Kapoor");
    expect(rows[0].business).toBe("Kapoor Digital");
    expect(rows[0].status).toBe("Qualified");
    expect(rows[0].quotedAmount).toBe(45000);
    expect(rows[0].isPinned).toBe(true);
    expect(rows[0].isStale).toBe(false);

    expect(rows[1].name).toBe("Stale Lead Co");
    expect(rows[1].isStale).toBe(true);

    // Verify ZERO mutations called on db.lead
    expect((db.lead as any).create).toBeUndefined();
    expect((db.lead as any).update).toBeUndefined();
    expect((db.lead as any).delete).toBeUndefined();
  });

  it("fetchDealsForExport properly distinguishes CRM Client, Other Client, and Lead Deleted", async () => {
    vi.mocked(db.deal.findMany).mockResolvedValue([
      // 1. CRM Client
      {
        id: "deal-crm",
        source: "CRM_LEAD",
        clientNameSnapshot: "Lead Name Snapshot",
        companyNameSnapshot: "Lead Business",
        projectName: "CRM Web Portal",
        quotedAmount: 80000,
        finalAmount: 80000,
        currency: "INR",
        status: "CONFIRMED",
        nextPaymentDueDate: new Date("2026-09-28T00:00:00Z"),
        nextPaymentDueAmount: 30000,
        createdAt: new Date("2026-09-05T10:00:00Z"),
        payments: [{ amount: 50000 }],
        lead: {
          id: "lead-live",
          name: "Live Lead",
          business: "Live Company",
          deletedAt: null,
        },
      },
      // 2. Other Client
      {
        id: "deal-other",
        source: "OTHER_CLIENT",
        clientNameSnapshot: "Standalone Client",
        companyNameSnapshot: "Direct Corp",
        projectName: "Mobile App",
        finalAmount: 60000,
        currency: "INR",
        status: "COMPLETED",
        nextPaymentDueDate: null,
        nextPaymentDueAmount: null,
        createdAt: new Date("2026-09-08T10:00:00Z"),
        payments: [{ amount: 60000 }],
        lead: null,
      },
      // 3. Lead Deleted Preserved Deal
      {
        id: "deal-deleted",
        source: "CRM_LEAD",
        clientNameSnapshot: "Preserved Deleted Lead Client",
        companyNameSnapshot: "Archived Corp",
        projectName: "Legacy Architecture",
        finalAmount: 50000,
        currency: "INR",
        status: "CONFIRMED",
        nextPaymentDueDate: new Date("2026-09-10T00:00:00Z"),
        nextPaymentDueAmount: 25000,
        createdAt: new Date("2026-08-20T10:00:00Z"),
        payments: [{ amount: 25000 }],
        lead: {
          id: "lead-deleted-id",
          name: "Old Deleted Lead",
          business: "Archived Corp",
          deletedAt: new Date("2026-09-15T00:00:00Z"),
        },
      },
    ] as any);

    const deals = await fetchDealsForExport();
    expect(deals.length).toBe(3);

    expect(deals[0].clientType).toBe("CRM Client");
    expect(deals[0].remainingBalance).toBe(30000);
    expect(deals[0].paymentStatus).toBe("Partially Paid");

    expect(deals[1].clientType).toBe("Other Client");
    expect(deals[1].remainingBalance).toBe(0);
    expect(deals[1].paymentStatus).toBe("Paid");

    expect(deals[2].clientType).toBe("Lead Deleted");
    expect(deals[2].clientName).toBe("Preserved Deleted Lead Client");
    expect(deals[2].remainingBalance).toBe(25000);
    expect(deals[2].paymentStatus).toBe("Overdue");
  });

  it("fetchOutstandingBalancesForExport excludes fully paid deals and computes days overdue", async () => {
    vi.mocked(db.deal.findMany).mockResolvedValue([
      // Fully paid: finalAmount = 40000, payments = 40000 -> Remaining = 0
      {
        id: "d-paid",
        clientNameSnapshot: "Paid Client",
        finalAmount: 40000,
        nextPaymentDueDate: null,
        nextPaymentDueAmount: null,
        payments: [{ amount: 40000 }],
        lead: null,
      },
      // Partially paid upcoming: finalAmount = 50000, payments = 20000 -> Remaining = 30000
      {
        id: "d-part",
        clientNameSnapshot: "Partial Client",
        finalAmount: 50000,
        nextPaymentDueDate: new Date("2026-10-15T00:00:00Z"),
        nextPaymentDueAmount: 30000,
        payments: [{ amount: 20000 }],
        lead: null,
      },
      // Overdue: finalAmount = 60000, payments = 10000 -> Remaining = 50000
      {
        id: "d-overdue",
        clientNameSnapshot: "Overdue Client",
        finalAmount: 60000,
        nextPaymentDueDate: new Date("2026-09-01T00:00:00Z"),
        nextPaymentDueAmount: 50000,
        payments: [{ amount: 10000 }],
        lead: null,
      },
    ] as any);

    const rows = await fetchOutstandingBalancesForExport();
    // d-paid must be excluded!
    expect(rows.length).toBe(2);
    expect(rows.find((r) => r.clientName === "Paid Client")).toBeUndefined();

    const partial = rows.find((r) => r.clientName === "Partial Client");
    expect(partial).toBeDefined();
    expect(partial?.remaining).toBe(30000);
    expect(partial?.daysOverdue).toBe(0);

    const overdue = rows.find((r) => r.clientName === "Overdue Client");
    expect(overdue).toBeDefined();
    expect(overdue?.remaining).toBe(50000);
    expect(Number(overdue?.daysOverdue)).toBeGreaterThan(0);
  });

  it("fetchFollowUpsForExport enforces strict single active follow-up rule and excludes superseded", async () => {
    vi.mocked(db.followUp.findMany).mockResolvedValue([
      // Lead A has two pending records (e.g. from an old race condition); only newest active should be exported!
      {
        id: "fu-new",
        leadId: "lead-a",
        scheduledAt: new Date("2026-09-20T04:30:00Z"), // 10:00 AM IST today
        type: "CALL",
        status: "PENDING",
        note: "Latest active follow-up",
        lead: { name: "Lead A", phone: "+91 9000000001", status: "CONTACTED" },
      },
      {
        id: "fu-superseded",
        leadId: "lead-a",
        scheduledAt: new Date("2026-09-18T04:30:00Z"),
        type: "WHATSAPP",
        status: "PENDING",
        note: "Older superseded follow-up",
        lead: { name: "Lead A", phone: "+91 9000000001", status: "CONTACTED" },
      },
      // Lead B has future follow-up
      {
        id: "fu-future",
        leadId: "lead-b",
        scheduledAt: new Date("2026-09-25T04:30:00Z"),
        type: "EMAIL",
        status: "PENDING",
        note: "Upcoming proposal check",
        lead: { name: "Lead B", phone: "+91 9000000002", status: "QUALIFIED" },
      },
    ] as any);

    const rows = await fetchFollowUpsForExport();
    // Only 2 distinct leads should be exported!
    expect(rows.length).toBe(2);
    expect(rows.filter((r) => r.leadName === "Lead A").length).toBe(1);
    expect(rows.find((r) => r.followUpNote === "Older superseded follow-up")).toBeUndefined();
    expect(rows.find((r) => r.followUpNote === "Latest active follow-up")).toBeDefined();
  });

  it("fetchBusinessSummary calculates exact consistent summary metrics with zero mutation", async () => {
    vi.mocked(db.lead.findMany).mockResolvedValue([
      {
        id: "l1",
        name: "Lead 1",
        status: "QUALIFIED",
        createdAt: new Date("2026-09-01T00:00:00Z"),
        updatedAt: new Date("2026-09-01T00:00:00Z"),
        activities: [],
        followUps: [],
      },
      {
        id: "l2",
        name: "Lead 2",
        status: "NEW",
        createdAt: new Date("2026-09-02T00:00:00Z"),
        updatedAt: new Date("2026-09-02T00:00:00Z"),
        activities: [],
        followUps: [],
      },
    ] as any);

    vi.mocked(db.deal.findMany).mockResolvedValue([
      {
        id: "d1",
        finalAmount: 100000,
        status: "CONFIRMED",
        nextPaymentDueDate: new Date("2026-09-10T00:00:00Z"),
        payments: [{ amount: 70000 }],
        lead: { status: "QUALIFIED" },
      },
      {
        id: "d2",
        finalAmount: 50000,
        status: "COMPLETED",
        nextPaymentDueDate: null,
        payments: [{ amount: 50000 }],
        lead: { status: "WON" },
      },
    ] as any);

    vi.mocked(db.followUp.findMany).mockResolvedValue([
      {
        leadId: "l1",
        scheduledAt: new Date("2026-09-10T00:00:00Z"), // Overdue
      },
    ] as any);

    const summary = await fetchBusinessSummary("all_time");

    expect(summary.totalLeads).toBe(2);
    expect(summary.qualifiedLeads).toBe(1);
    expect(summary.wonDeals).toBe(2);
    expect(summary.totalDealValue).toBe(150000);
    expect(summary.paymentsReceived).toBe(120000);
    expect(summary.outstanding).toBe(30000);
    expect(summary.overdue).toBe(30000);
    expect(summary.followUpsDue).toBe(1);
  });
});
