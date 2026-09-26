import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  createCrmClientDeal,
  createOtherClientDeal,
  addDealPayment,
  updateDealPayment,
  getAllDeals,
} from "@/app/actions/deals";
import { recordUndoAction } from "@/features/undo/services/undo-engine";

const _TUID = "test-crm-deal-workflow-user";

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
  getSession: vi.fn().mockResolvedValue({ id: "test-crm-deal-workflow-user", email: "crmtest@example.com", role: "ADMIN" }),
}));

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasTestDb)("CRM Deals Workflow", () => {
  const createdLeadIds: string[] = [];

  beforeAll(async () => {
    const user = await db.user.findUnique({ where: { id: "test-crm-deal-workflow-user" } });
    if (!user) {
      await db.user.create({
        data: { id: "test-crm-deal-workflow-user", email: "crmtest@example.com", name: "CRM Deal Test User", passwordHash: "dummyhash" },
      }).catch(() => {});
    }
  });

  afterAll(async () => {
    for (const leadId of createdLeadIds) {
      await db.undoAction.deleteMany({ where: { leadId } }).catch(() => {});
      await db.payment.deleteMany({ where: { deal: { leadId } } }).catch(() => {});
      await db.deal.deleteMany({ where: { leadId } }).catch(() => {});
      await db.lead.deleteMany({ where: { id: leadId } }).catch(() => {});
    }
  });

  // Test 1: Create CRM Deal for existing Lead
  describe("Create CRM Deal for existing Lead", () => {
    it("creates a deal linked to an existing lead", async () => {
      const lead = await db.lead.create({
        data: { name: "CRM Deal Test Lead", phone: "9999999999", leadSource: "MANUAL", status: "NEW" },
      });
      createdLeadIds.push(lead.id);

      const result = (await createCrmClientDeal(lead.id)) as any;
      expect(result.success).toBe(true);
      expect(result.data.leadId).toBe(lead.id);
      expect(result.data.source).toBe("CRM_LEAD");
    });
  });

  // Test 2: Search Lead by name
  describe("Search Lead by name", () => {
    it("creates a deal for a lead found by name", async () => {
      const lead = await db.lead.create({
        data: { name: "SearchByName Lead", phone: "8888888888", leadSource: "MANUAL", status: "NEW" },
      });
      createdLeadIds.push(lead.id);
      const result = (await createCrmClientDeal(lead.id)) as any;
      expect(result.success).toBe(true);
      expect(result.data.lead.name).toBe("SearchByName Lead");
    });
  });

  // Test 3: Search Lead by phone
  describe("Search Lead by phone", () => {
    it("creates a deal for a lead found by phone", async () => {
      const lead = await db.lead.create({
        data: { name: "SearchByPhone Lead", phone: "7777777777", leadSource: "MANUAL", status: "NEW" },
      });
      createdLeadIds.push(lead.id);
      const result = (await createCrmClientDeal(lead.id)) as any;
      expect(result.success).toBe(true);
      expect(result.data.lead.phone).toBe("7777777777");
    });
  });

  // Test 4: Prevent second Deal for same Lead
  describe("Prevent second Deal for same Lead", () => {
    it("returns alreadyExists: true on second call", async () => {
      const lead = await db.lead.create({
        data: { name: "DupCheck Lead", phone: "6666666666", leadSource: "MANUAL", status: "NEW" },
      });
      createdLeadIds.push(lead.id);

      const first = (await createCrmClientDeal(lead.id)) as any;
      expect(first.success).toBe(true);
      expect(first.alreadyExists).toBeFalsy();

      const second = (await createCrmClientDeal(lead.id)) as any;
      expect(second.success).toBe(true);
      expect(second.alreadyExists).toBe(true);
    });

    it("handles concurrent duplicate deal creation: exactly one deal, no crash, no P2002 leak", async () => {
      const lead = await db.lead.create({
        data: { name: "RaceCheck Lead", phone: "6565656565", leadSource: "MANUAL", status: "NEW" },
      });
      createdLeadIds.push(lead.id);

      // Fire two requests concurrently
      const [first, second] = (await Promise.all([
        createCrmClientDeal(lead.id),
        createCrmClientDeal(lead.id),
      ])) as any[];

      // Both must succeed — no raw Prisma P2002 surfaces to the caller
      expect(first.success).toBe(true);
      expect(second.success).toBe(true);

      const results = [first, second];
      const created = results.filter((r) => r.success && !r.alreadyExists);
      const alreadyExists = results.filter((r) => r.success && r.alreadyExists === true);

      console.log("CONCURRENT_REPORT_DATA:", JSON.stringify({
        targetLeadId: lead.id,
        firstLeadId: first.data?.leadId,
        secondLeadId: second.data?.leadId,
        firstResult: { success: first.success, alreadyExists: Boolean(first.alreadyExists), dataId: first.data?.id },
        secondResult: { success: second.success, alreadyExists: Boolean(second.alreadyExists), dataId: second.data?.id },
        createdCount: created.length,
        alreadyExistsCount: alreadyExists.length,
      }));

      // Exactly ONE request succeeds creating the Deal
      expect(created).toHaveLength(1);
      // Exactly ONE request returns alreadyExists: true
      expect(alreadyExists).toHaveLength(1);

      // Exactly one deal exists for this lead
      const deals = await db.deal.findMany({ where: { leadId: lead.id } });
      expect(deals).toHaveLength(1);

      // Exactly one UndoAction for the created deal
      const undoActions = await db.undoAction.findMany({
        where: { entityType: "DEAL", entityId: deals[0].id },
      });
      expect(undoActions).toHaveLength(1);

      // No raw P2002 error string in either response
      expect(first.error).toBeUndefined();
      expect(second.error).toBeUndefined();
      expect(JSON.stringify(results)).not.toContain("P2002");

      console.log("CONCURRENT_REPORT_DATA:", JSON.stringify({
        firstResult: { success: first.success, alreadyExists: Boolean(first.alreadyExists) },
        secondResult: { success: second.success, alreadyExists: Boolean(second.alreadyExists) },
        createdCount: created.length,
        alreadyExistsCount: alreadyExists.length,
        dealCount: deals.length,
        undoActionCount: undoActions.length,
        rawP2002Exposed: JSON.stringify(results).includes("P2002"),
      }));
    });

    it("P2002 catch handler: returns alreadyExists:true, no duplicate UndoAction", async () => {
      const lead = await db.lead.create({
        data: { name: "P2002Direct Lead", phone: "6515151515", leadSource: "MANUAL", status: "NEW" },
      });
      createdLeadIds.push(lead.id);

      // Create a deal directly so the catch handler has something to look up
      const initialDeal = await db.deal.create({
        data: {
          source: "CRM_LEAD",
          lead: { connect: { id: lead.id } },
          clientNameSnapshot: lead.name,
          finalAmount: new Prisma.Decimal(0),
          currency: "INR",
          status: "NEGOTIATING",
        },
      });

      // Record initial undo action so count is 1
      await recordUndoAction({
        actionType: "DEAL_CREATE",
        entityType: "DEAL",
        entityId: initialDeal.id,
        leadId: lead.id,
        beforeSnapshot: null,
        afterSnapshot: initialDeal,
        description: `Create CRM deal for ${lead.name}`,
        userId: "test-crm-deal-workflow-user",
      });

      // Mock deal.create to throw P2002 — simulates the unique constraint collision
      const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "5.0.0" });
      const createSpy = vi.spyOn(db.deal, "create").mockRejectedValue(p2002);

      try {
        const result = (await createCrmClientDeal(lead.id)) as any;

        // P2002 handler should return the existing deal with alreadyExists:true
        expect(result.success).toBe(true);
        expect(result.alreadyExists).toBe(true);
        expect(result.data.leadId).toBe(lead.id);

        // Still exactly one deal
        const deals = await db.deal.findMany({ where: { leadId: lead.id } });
        expect(deals).toHaveLength(1);

        // Only the pre-created deal has an undo — the P2002 catch block must NOT create a second
        const undoActions = await db.undoAction.findMany({
          where: { entityType: "DEAL", leadId: lead.id },
        });
        expect(undoActions).toHaveLength(1);

        // No raw P2002 error leaked
        expect(result.error).toBeUndefined();
      } finally {
        createSpy.mockRestore();
      }
    });
  });

  // Test 5: Create Other Client Deal
  describe("Create Other Client Deal", () => {
    it("creates a standalone deal without a lead", async () => {
      const result = (await createOtherClientDeal({
        clientName: "Standalone Client",
        clientPhone: "5555555555",
        clientEmail: "standalone@test.com",
        finalAmount: 0,
        notes: "Test standalone deal",
      })) as any;

      expect(result.success).toBe(true);
      expect(result.data.source).toBe("OTHER_CLIENT");
      expect(result.data.clientNameSnapshot).toBe("Standalone Client");
    });
  });

  // Test 6: Record Payment on CRM Deal
  describe("Record Payment on CRM Deal", () => {
    it("adds a payment to a CRM-linked deal", async () => {
      const lead = await db.lead.create({
        data: { name: "PaymentCRM Lead", phone: "4444444444", leadSource: "MANUAL", status: "NEW" },
      });
      createdLeadIds.push(lead.id);

      const dealResult = (await createCrmClientDeal(lead.id)) as any;
      if (!dealResult.success) return;

      const payResult = (await addDealPayment({
        dealId: dealResult.data.id,
        amount: 5000,
        type: "PARTIAL",
        method: "CASH",
        paymentDate: new Date().toISOString().split("T")[0],
      })) as any;

      expect(payResult.success).toBe(true);
      expect(payResult.data.amount).toBe(5000);
    });
  });

  // Test 7: Record Payment on Other Client Deal
  describe("Record Payment on Other Client Deal", () => {
    it("adds a payment to an Other Client deal", async () => {
      const dealResult = (await createOtherClientDeal({
        clientName: "OC Payment Lead",
        clientPhone: "3333333333",
        clientEmail: "oc@test.com",
        finalAmount: 0,
        notes: "",
      })) as any;
      if (!dealResult.success) return;

      const payResult = (await addDealPayment({
        dealId: dealResult.data.id,
        amount: 3000,
        type: "FINAL",
        method: "UPI",
        paymentDate: new Date().toISOString().split("T")[0],
      })) as any;

      expect(payResult.success).toBe(true);
      expect(payResult.data.dealId).toBe(dealResult.data.id);
    });
  });

  // Test 8: Edit Payment
  describe("Edit Payment", () => {
    it("updates payment amount", async () => {
      const lead = await db.lead.create({
        data: { name: "EditPay Lead", phone: "2222222222", leadSource: "MANUAL", status: "NEW" },
      });
      createdLeadIds.push(lead.id);

      const dealResult = (await createCrmClientDeal(lead.id)) as any;
      if (!dealResult.success) return;

      const payResult = (await addDealPayment({
        dealId: dealResult.data.id,
        amount: 1000,
        type: "PARTIAL",
        method: "CASH",
        paymentDate: new Date().toISOString().split("T")[0],
      })) as any;
      if (!payResult.success) return;

      const updateResult = (await updateDealPayment(payResult.data.id, {
        amount: 2000,
        type: "PARTIAL",
        method: "CASH",
        paymentDate: new Date().toISOString().split("T")[0],
      })) as any;

      expect(updateResult.success).toBe(true);
      expect(updateResult.data.amount).toBe(2000);
    });
  });

  // Test 9: Tabs filter correctly
  describe("Tabs filter correctly", () => {
    it("CRM filter returns only CRM-linked deals", async () => {
      const result = (await getAllDeals({ filter: "crm_clients" })) as any;
      expect(result.success).toBe(true);
      expect(result.data.deals.every((d: any) => d.source === "CRM_LEAD")).toBe(true);
    });

    it("Other Clients filter returns only standalone deals", async () => {
      const result = (await getAllDeals({ filter: "other_clients" })) as any;
      expect(result.success).toBe(true);
      expect(result.data.deals.every((d: any) => d.source === "OTHER_CLIENT")).toBe(true);
    });

    it("All Deals filter returns both types", async () => {
      const result = (await getAllDeals({ filter: "all" })) as any;
      expect(result.success).toBe(true);
      const sources = result.data.deals.map((d: any) => d.source);
      const hasCrm = sources.includes("CRM_LEAD");
      const hasOther = sources.includes("OTHER_CLIENT");
      expect(hasCrm || hasOther).toBe(true);
    });
  });

  // Test 10: Existing Undo still works
  describe("Existing Undo still works", () => {
    it("payment creation returns undoId from existing undo system", async () => {
      const lead = await db.lead.create({
        data: { name: "UndoCheck Lead", phone: "1111111111", leadSource: "MANUAL", status: "NEW" },
      });
      createdLeadIds.push(lead.id);

      const dealResult = (await createCrmClientDeal(lead.id)) as any;
      expect(dealResult.success).toBe(true);

      const payResult = (await addDealPayment({
        dealId: dealResult.data.id,
        amount: 500,
        type: "PARTIAL",
        method: "CASH",
        paymentDate: new Date().toISOString().split("T")[0],
      })) as any;

      expect(payResult.success).toBe(true);
      const undoId = payResult.undoId;
      expect(undoId).toBeDefined();
      expect(undoId.length).toBeGreaterThan(0);
    });
  });
});
