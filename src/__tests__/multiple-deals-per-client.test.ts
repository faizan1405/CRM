import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  createCrmClientDeal,
  createOtherClientDeal,
  getLeadDeals,
  getDealById,
  upsertLeadDeal,
  deleteDeal,
  addDealPayment,
  updateDealPayment,
  deleteDealPayment,
  getAllDeals,
} from "@/app/actions/deals";
import {
  calculateWonDealValue,
  calculateOpenPipelineValue,
  calculateTotalContractedDealValue,
  calculateMoneyReceived,
  calculateTotalOutstanding,
  calculateCollectionRate,
  decimalToNumber,
} from "@/lib/financial/calculations";
import { calculateDealMetrics } from "@/features/deals/calculations";
import { touchCrmSync } from "@/lib/crm-sync";
import { executeUndo } from "@/features/undo/services/undo-engine";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/deals",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn().mockResolvedValue({
    id: "test-multideal-user",
    email: "multideal@test.com",
    role: "ADMIN",
  }),
}));

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasTestDb)("Multiple Deals Per CRM Client — Comprehensive Suite", () => {
  const createdLeadIds: string[] = [];
  const createdDealIds: string[] = [];

  beforeAll(async () => {
    // Ensure test user exists
    await db.user.upsert({
      where: { id: "test-multideal-user" },
      update: {},
      create: {
        id: "test-multideal-user",
        email: "multideal@test.com",
        name: "Multi Deal Tester",
        passwordHash: "dummyhash",
      },
    });
  });

  afterAll(async () => {
    for (const dealId of createdDealIds) {
      await db.undoAction.deleteMany({ where: { entityId: dealId } }).catch(() => {});
      await db.payment.deleteMany({ where: { dealId } }).catch(() => {});
      await db.deal.deleteMany({ where: { id: dealId } }).catch(() => {});
    }
    for (const leadId of createdLeadIds) {
      await db.undoAction.deleteMany({ where: { leadId } }).catch(() => {});
      await db.payment.deleteMany({ where: { deal: { leadId } } }).catch(() => {});
      await db.deal.deleteMany({ where: { leadId } }).catch(() => {});
      await db.lead.deleteMany({ where: { id: leadId } }).catch(() => {});
    }
  });

  // 1-5: Multiple Deals for One Lead
  describe("1-5: One Client -> Multiple Deals & Single Lead Preservation", () => {
    let clientLeadId: string;
    let deal1Id: string;
    let deal2Id: string;
    let deal3Id: string;

    it("Requirement 1: One Lead with zero Deals creates its first Deal", async () => {
      const lead = await db.lead.create({
        data: {
          name: "Jitendra Chauhan",
          phone: "9820011223",
          business: "Udyog Engineers",
          status: "WON",
          leadSource: "MANUAL",
        },
      });
      clientLeadId = lead.id;
      createdLeadIds.push(clientLeadId);

      // Verify zero deals initially
      const initialDeals = await db.deal.findMany({ where: { leadId: clientLeadId } });
      expect(initialDeals).toHaveLength(0);

      // Create first deal: Udyog Engineers Website (₹30,000)
      const res = await createCrmClientDeal(clientLeadId, {
        projectName: "Udyog Engineers Website",
        finalAmount: 30000,
        status: "CONFIRMED",
      });

      expect(res.success).toBe(true);
      if (!res.success) return;

      deal1Id = res.data.id;
      createdDealIds.push(deal1Id);

      expect(res.data.leadId).toBe(clientLeadId);
      expect(res.data.projectName).toBe("Udyog Engineers Website");
      expect(res.data.finalAmount).toBe(30000);
      expect(res.data.status).toBe("CONFIRMED");
    });

    it("Requirement 2: The same Lead successfully creates a second Deal", async () => {
      // Create second deal: Forestry Tools India Website (₹45,000)
      const res = await createCrmClientDeal(clientLeadId, {
        projectName: "Forestry Tools India Website",
        finalAmount: 45000,
        status: "CONFIRMED",
      });

      expect(res.success).toBe(true);
      if (!res.success) return;

      deal2Id = res.data.id;
      createdDealIds.push(deal2Id);

      expect(res.data.leadId).toBe(clientLeadId);
      expect(res.data.projectName).toBe("Forestry Tools India Website");
      expect(res.data.finalAmount).toBe(45000);
      expect(deal2Id).not.toBe(deal1Id);
    });

    it("Requirement 3: The same Lead successfully creates a third Deal", async () => {
      // Create third deal: Catalogue Design (₹20,000)
      const res = await createCrmClientDeal(clientLeadId, {
        projectName: "Catalogue Design",
        finalAmount: 20000,
        status: "NEGOTIATING",
      });

      expect(res.success).toBe(true);
      if (!res.success) return;

      deal3Id = res.data.id;
      createdDealIds.push(deal3Id);

      expect(res.data.leadId).toBe(clientLeadId);
      expect(res.data.projectName).toBe("Catalogue Design");
      expect(res.data.finalAmount).toBe(20000);
      expect(deal3Id).not.toBe(deal1Id);
      expect(deal3Id).not.toBe(deal2Id);
    });

    it("Requirement 4: All Deals retain separate IDs, project names, and amounts", async () => {
      const dealsRes = await getLeadDeals(clientLeadId);
      expect(dealsRes.success).toBe(true);
      if (!dealsRes.success) return;

      const clientDeals = dealsRes.data;
      expect(clientDeals).toHaveLength(3);

      const d1 = clientDeals.find(d => d.id === deal1Id);
      const d2 = clientDeals.find(d => d.id === deal2Id);
      const d3 = clientDeals.find(d => d.id === deal3Id);

      expect(d1).toBeDefined();
      expect(d2).toBeDefined();
      expect(d3).toBeDefined();

      expect(d1?.projectName).toBe("Udyog Engineers Website");
      expect(d1?.finalAmount).toBe(30000);

      expect(d2?.projectName).toBe("Forestry Tools India Website");
      expect(d2?.finalAmount).toBe(45000);

      expect(d3?.projectName).toBe("Catalogue Design");
      expect(d3?.finalAmount).toBe(20000);
    });

    it("Requirement 5: No duplicate Lead is created", async () => {
      // Across all three creations, exactly one lead exists with this ID
      const leads = await db.lead.findMany({
        where: { phone: "9820011223" },
      });
      expect(leads).toHaveLength(1);
      expect(leads[0].id).toBe(clientLeadId);
      expect(leads[0].name).toBe("Jitendra Chauhan");
    });
  });

  // 6-7: Concurrency & Duplicate Submission Guard
  describe("6-7: Concurrency & Duplicate Prevention", () => {
    let testLeadId: string;

    beforeAll(async () => {
      const lead = await db.lead.create({
        data: { name: "Concurrent Test Client", phone: "9820099887", leadSource: "MANUAL", status: "NEW" },
      });
      testLeadId = lead.id;
      createdLeadIds.push(testLeadId);
    });

    it("Requirement 6: Concurrent creation of genuinely different projects succeeds", async () => {
      // Create two distinct projects concurrently
      const [resAlpha, resBeta] = await Promise.all([
        createCrmClientDeal(testLeadId, {
          projectName: "Project Alpha Concurrency",
          finalAmount: 15000,
          submissionId: `sub_alpha_${Date.now()}`,
        }),
        createCrmClientDeal(testLeadId, {
          projectName: "Project Beta Concurrency",
          finalAmount: 25000,
          submissionId: `sub_beta_${Date.now()}`,
        }),
      ]);

      expect(resAlpha.success).toBe(true);
      expect(resBeta.success).toBe(true);

      if (resAlpha.success && resBeta.success) {
        createdDealIds.push(resAlpha.data.id, resBeta.data.id);
        expect(resAlpha.data.id).not.toBe(resBeta.data.id);
        expect(resAlpha.data.projectName).toBe("Project Alpha Concurrency");
        expect(resBeta.data.projectName).toBe("Project Beta Concurrency");
      }
    });

    it("Requirement 7: Duplicate submission of the same request does not create duplicate Deals", async () => {
      const fixedSubmissionId = `idempotent_test_${Date.now()}`;
      
      const first = await createCrmClientDeal(testLeadId, {
        projectName: "Duplicate Guard Project",
        finalAmount: 50000,
        submissionId: fixedSubmissionId,
      });

      expect(first.success).toBe(true);
      if (!first.success) return;
      createdDealIds.push(first.data.id);

      // Resubmit exact same request with same submissionId
      const second = await createCrmClientDeal(testLeadId, {
        projectName: "Duplicate Guard Project",
        finalAmount: 50000,
        submissionId: fixedSubmissionId,
      });

      expect(second.success).toBe(true);
      if (!second.success) return;
      // Must return existing deal and alreadyExists flag
      expect(second.alreadyExists).toBe(true);
      expect(second.data.id).toBe(first.data.id);

      // Rapid resubmission guard (same lead, project, and amount within 5s without submissionId)
      const rapidResubmit = await createCrmClientDeal(testLeadId, {
        projectName: "Duplicate Guard Project",
        finalAmount: 50000,
      });
      expect(rapidResubmit.success).toBe(true);
      if (rapidResubmit.success) {
        expect(rapidResubmit.alreadyExists).toBe(true);
        expect(rapidResubmit.data.id).toBe(first.data.id);
      }
    });
  });

  // 8-10: Independent Financial Records & Safe Deletion
  describe("8-10: Financial Independence & Safe Deletion", () => {
    let clientLeadId: string;
    let dealAId: string;
    let dealBId: string;
    let dealCId: string;
    let paymentAId: string;
    let paymentBId: string;

    beforeAll(async () => {
      const lead = await db.lead.create({
        data: { name: "Financial Isolation Client", phone: "9820055443", leadSource: "MANUAL", status: "WON" },
      });
      clientLeadId = lead.id;
      createdLeadIds.push(clientLeadId);

      const dA = await createCrmClientDeal(clientLeadId, {
        projectName: "Deal A — Udyog",
        finalAmount: 30000,
        status: "CONFIRMED",
      });
      const dB = await createCrmClientDeal(clientLeadId, {
        projectName: "Deal B — Forestry",
        finalAmount: 45000,
        status: "CONFIRMED",
      });
      const dC = await createCrmClientDeal(clientLeadId, {
        projectName: "Deal C — Extra",
        finalAmount: 10000,
        status: "CONFIRMED",
      });

      if (dA.success) {
        dealAId = dA.data.id;
        createdDealIds.push(dealAId);
      }
      if (dB.success) {
        dealBId = dB.data.id;
        createdDealIds.push(dealBId);
      }
      if (dC.success) {
        dealCId = dC.data.id;
        createdDealIds.push(dealCId);
      }
    });

    it("Requirement 8: Payments remain attached to their exact Deal", async () => {
      // Add ₹10,000 to Deal A
      const payA = await addDealPayment({
        dealId: dealAId,
        amount: 10000,
        paymentDate: "2026-10-09",
        type: "PARTIAL",
        method: "UPI",
      });
      expect(payA.success).toBe(true);
      if (payA.success) paymentAId = payA.data.id;

      // Add ₹15,000 to Deal B
      const payB = await addDealPayment({
        dealId: dealBId,
        amount: 15000,
        paymentDate: "2026-10-09",
        type: "PARTIAL",
        method: "BANK_TRANSFER",
      });
      expect(payB.success).toBe(true);
      if (payB.success) paymentBId = payB.data.id;

      // Check Deal A
      const dealAFetched = await getDealById(dealAId);
      expect(dealAFetched.success).toBe(true);
      if (dealAFetched.success && dealAFetched.data) {
        expect(dealAFetched.data.finalAmount).toBe(30000);
        expect(dealAFetched.data.totalReceived).toBe(10000);
        expect(dealAFetched.data.remainingBalance).toBe(20000);
        expect(dealAFetched.data.payments).toHaveLength(1);
        expect(dealAFetched.data.payments[0].id).toBe(paymentAId);
      }

      // Check Deal B
      const dealBFetched = await getDealById(dealBId);
      expect(dealBFetched.success).toBe(true);
      if (dealBFetched.success && dealBFetched.data) {
        expect(dealBFetched.data.finalAmount).toBe(45000);
        expect(dealBFetched.data.totalReceived).toBe(15000);
        expect(dealBFetched.data.remainingBalance).toBe(30000);
        expect(dealBFetched.data.payments).toHaveLength(1);
        expect(dealBFetched.data.payments[0].id).toBe(paymentBId);
      }
    });

    it("Requirement 9: Editing one Deal does not modify another", async () => {
      // Update Deal A to ₹35,000 and status COMPLETED
      const editA = await upsertLeadDeal({
        dealId: dealAId,
        finalAmount: 35000,
        status: "COMPLETED",
      });
      expect(editA.success).toBe(true);

      // Verify Deal B remains completely untouched
      const dealBFetched = await getDealById(dealBId);
      expect(dealBFetched.success).toBe(true);
      if (dealBFetched.success && dealBFetched.data) {
        expect(dealBFetched.data.finalAmount).toBe(45000);
        expect(dealBFetched.data.status).toBe("CONFIRMED");
        expect(dealBFetched.data.totalReceived).toBe(15000);
      }
    });

    it("Requirement 10: Deleting one eligible Deal does not delete another Deal or its payments", async () => {
      // Delete Deal C
      const delC = await deleteDeal(dealCId);
      expect(delC.success).toBe(true);

      // Verify Deal C is deleted
      const checkC = await getDealById(dealCId);
      expect(checkC.success).toBe(true);
      expect(checkC.data).toBeNull();

      // Verify Deal A and Deal B still exist with their payments
      const checkA = await getDealById(dealAId);
      const checkB = await getDealById(dealBId);
      expect(checkA.success).toBe(true);
      expect(checkA.data).not.toBeNull();
      expect(checkA.data?.payments).toHaveLength(1);

      expect(checkB.success).toBe(true);
      expect(checkB.data).not.toBeNull();
      expect(checkB.data?.payments).toHaveLength(1);

      // Verify lead still exists
      const lead = await db.lead.findUnique({ where: { id: clientLeadId } });
      expect(lead).not.toBeNull();
    });
  });

  // 11: Undo Scoping
  describe("11: Undo Scoping", () => {
    it("Requirement 11: Undo remains properly scoped to specific deal", async () => {
      const lead = await db.lead.create({
        data: { name: "Undo Scope Client", phone: "9820077889", leadSource: "MANUAL", status: "NEW" },
      });
      createdLeadIds.push(lead.id);

      const d1 = await createCrmClientDeal(lead.id, { projectName: "Permanent Project", finalAmount: 20000 });
      expect(d1.success).toBe(true);
      if (!d1.success) return;
      createdDealIds.push(d1.data.id);

      // Create a second deal that we will undo
      const d2 = await createCrmClientDeal(lead.id, { projectName: "Temporary Project", finalAmount: 10000 });
      expect(d2.success).toBe(true);
      if (!d2.success || !d2.undoId) return;

      // Undo Deal 2 creation
      const undoRes = await executeUndo(d2.undoId, "test-multideal-user");
      expect(undoRes.success).toBe(true);

      // Deal 2 should be gone
      const checkD2 = await db.deal.findUnique({ where: { id: d2.data.id } });
      expect(checkD2).toBeNull();

      // Deal 1 must still exist
      const checkD1 = await db.deal.findUnique({ where: { id: d1.data.id } });
      expect(checkD1).not.toBeNull();
      expect(checkD1?.projectName).toBe("Permanent Project");
    });
  });

  // 12-13: Analytics, Dashboard & Baseline Calculations
  describe("12-13: Dashboard and Analytics Non-Duplication & Financial Baseline", () => {
    it("Requirement 12: Dashboard and Analytics do not double-count multiple deals per client", () => {
      // Simulate client record with multiple deals
      const mockLead = {
        id: "lead-multi-agg",
        status: "WON",
        isWaste: false,
        deals: [
          {
            id: "deal-1",
            quotedAmount: 30000,
            finalAmount: 30000,
            status: "CONFIRMED",
            currency: "INR",
          },
          {
            id: "deal-2",
            quotedAmount: 45000,
            finalAmount: 45000,
            status: "CONFIRMED",
            currency: "INR",
          },
          {
            id: "deal-3",
            quotedAmount: 20000,
            finalAmount: 20000,
            status: "NEGOTIATING", // in negotiation: should NOT count as Won
            currency: "INR",
          },
        ],
      };

      // Won deal value must sum only confirmed/completed deals: 30,000 + 45,000 = 75,000
      const wonValue = calculateWonDealValue([mockLead]);
      expect(decimalToNumber(wonValue)).toBe(75000);

      // Contracted deal metrics
      const dealsList = [
        { finalAmount: 30000, totalReceived: 10000, remainingBalance: 20000, paymentStatus: "Partially Paid" as const },
        { finalAmount: 45000, totalReceived: 15000, remainingBalance: 30000, paymentStatus: "Partially Paid" as const },
      ];
      const metrics = calculateDealMetrics(dealsList);
      expect(metrics.totalDealValue).toBe(75000);
      expect(metrics.totalReceived).toBe(25000);
      expect(metrics.totalOutstanding).toBe(50000);
      expect(metrics.collectionRate).toBe(33.33);
    });

    it("Requirement 13: Existing financial baseline semantics remain unchanged", () => {
      // Production baseline figures check:
      // Contracted: ₹20,300 (Deal 1: 12000, Deal 2: 8300)
      // Received: ₹4,910
      // Outstanding: ₹15,390
      // Collection rate: 24.19%
      const baselineDeals = [
        {
          id: "deal-base-1",
          finalAmount: new Prisma.Decimal(12000),
          payments: [{ amount: new Prisma.Decimal(4910) }],
        },
        {
          id: "deal-base-2",
          finalAmount: new Prisma.Decimal(8300),
          payments: [],
        },
      ];

      const totalVal = calculateTotalContractedDealValue(baselineDeals);
      const outstanding = calculateTotalOutstanding(baselineDeals);
      const totalPayments = baselineDeals.flatMap(d => d.payments);
      const received = calculateMoneyReceived(totalPayments);
      const rate = decimalToNumber(calculateCollectionRate(received, totalVal));

      expect(decimalToNumber(totalVal)).toBe(20300);
      expect(decimalToNumber(received)).toBe(4910);
      expect(decimalToNumber(outstanding)).toBe(15390);
      expect(rate).toBe(24.19);
    });
  });

  // 14: Other Client Deal Flow
  describe("14: Other Client Flow Preserved", () => {
    it("Requirement 14: Other Client Deal creation still works alongside CRM Client deals", async () => {
      const ocRes = await createOtherClientDeal({
        clientName: "Other Client Global Corp",
        finalAmount: 60000,
        projectName: "Standalone Branding",
        clientPhone: "9123456780",
        notes: "Standalone project",
      });

      expect(ocRes.success).toBe(true);
      if (!ocRes.success) return;
      createdDealIds.push(ocRes.data.id);

      expect(ocRes.data.source).toBe("OTHER_CLIENT");
      expect(ocRes.data.leadId).toBeNull();
      expect(ocRes.data.clientNameSnapshot).toBe("Other Client Global Corp");
      expect(ocRes.data.finalAmount).toBe(60000);

      // Verify tabs query correctly separates them
      const allDeals = await getAllDeals({ filter: "other_clients" });
      expect(allDeals.success).toBe(true);
      if (allDeals.success) {
        const found = allDeals.data.deals.find(d => d.id === ocRes.data.id);
        expect(found).toBeDefined();
        expect(found?.source).toBe("OTHER_CLIENT");
      }
    });
  });

  // 15: CRM Sync
  describe("15: Durable CRM Sync Versioning", () => {
    it("Requirement 15: CRM Sync version increments monotonically on deal activity", async () => {
      const v1 = await touchCrmSync();
      expect(v1.version).toBeGreaterThan(0);

      const v2 = await touchCrmSync();
      expect(v2.version).toBe(v1.version + 1);
    });
  });

  // 16: UI Serialization & Contract Safety
  describe("16: Mobile UI Contract Safety", () => {
    it("Requirement 16: SerializedDeal provides all required fields for mobile Projects & Deals UI", async () => {
      const lead = await db.lead.create({
        data: { name: "Mobile UI Client", phone: "9820033221", leadSource: "MANUAL", status: "WON" },
      });
      createdLeadIds.push(lead.id);

      const res = await createCrmClientDeal(lead.id, {
        projectName: "Mobile Responsive Portal",
        finalAmount: 42000,
        status: "CONFIRMED",
        nextPaymentDueDate: "2026-11-01",
        nextPaymentDueAmount: 10000,
      });

      expect(res.success).toBe(true);
      if (!res.success) return;
      createdDealIds.push(res.data.id);

      const deal = res.data;
      // Check every field rendered by the UI component
      expect(deal.projectName).toBe("Mobile Responsive Portal");
      expect(deal.finalAmount).toBe(42000);
      expect(deal.totalReceived).toBe(0);
      expect(deal.remainingBalance).toBe(42000);
      expect(deal.paymentStatus).toBe("Unpaid");
      expect(deal.status).toBe("CONFIRMED");
      expect(deal.nextPaymentDueDate).toBe("2026-11-01");
      expect(deal.nextPaymentDueAmount).toBe(10000);
      expect(deal.createdAt).toBeDefined();
      expect(Array.isArray(deal.payments)).toBe(true);
    });
  });
});
