import fs from "node:fs";
import path from "node:path";

// Ensure environment variables from .env.local and .env are loaded for Prisma
for (const envFile of [".env.local", ".env"]) {
  const p = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(p)) {
    const lines = fs.readFileSync(p, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const rawVal = trimmed.slice(eqIdx + 1).trim();
        const val = rawVal.replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { parseBulkUnstructuredLeadText } from "@/features/leads/ai-parser/bulk-lead-parser";
import { analyzeBulkLeadDuplicates } from "@/features/leads/ai-parser/duplicate-detector";
import {
  structureBulkLeadAction,
  createBulkLeadsAction,
  structureLeadAction,
} from "@/app/actions/ai-lead-entry";
import { getDashboardData } from "@/app/actions/dashboard";
import { getLeads } from "@/app/actions/leads";
import { db } from "@/lib/db";
import type { BulkCreateLeadItem, StructuredLeadDraft } from "@/features/leads/ai-parser/types";
import * as groqClient from "@/lib/ai/groq-client";

// Mock Auth Session for authenticated server actions
const mockUser = {
  id: "test-agent-a-bulk-user-id",
  name: "Agent A Tester",
  email: "agent-a-bulk@test.com",
  role: "ADMIN",
};

vi.mock("@/lib/auth", () => ({
  getSession: async () => mockUser,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Phase 11: Bulk Lead Entry + Backend Performance Hardening", () => {
  const createdLeadIds: string[] = [];

  beforeAll(async () => {
    // Ensure test user exists in DB for activity references
    const existingUser = await db.user.findUnique({ where: { email: mockUser.email } });
    if (!existingUser) {
      await db.user.create({
        data: {
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          passwordHash: "test_hash_phase11",
          role: "ADMIN",
        },
      });
    }

    // Set up mock for requestGroqJson when actual key is absent or testing specific fallback outputs
    if (!process.env.GROQ_API_KEY) {
      vi.spyOn(groqClient, "requestGroqJson").mockImplementation(async ({ userPrompt }) => {
        // Multi-lead mock
        if (userPrompt.includes("Faiz") && userPrompt.includes("Ali")) {
          return {
            rawJson: JSON.stringify({
              leads: [
                {
                  name: "Faiz",
                  phone: "+91 99999 99999",
                  email: null,
                  business: null,
                  industryOrRequirement: null,
                  budget: null,
                  status: "New",
                  notes: "Faiz - 9999999999",
                  suggestedFollowUpDate: null,
                  suggestedFollowUpTime: null,
                  confidence: { name: "high", phone: "high" },
                },
                {
                  name: "Ali",
                  phone: "+91 88888 88888",
                  email: null,
                  business: null,
                  industryOrRequirement: null,
                  budget: null,
                  status: "New",
                  notes: "Ali - 8888888888",
                  suggestedFollowUpDate: null,
                  suggestedFollowUpTime: null,
                  confidence: { name: "high", phone: "high" },
                },
              ],
            }),
          };
        }

        // Single lead fallback mock
        return {
          rawJson: JSON.stringify({
            leads: [
              {
                name: "Test Lead",
                phone: "+91 98765 43210",
                email: null,
                business: null,
                industryOrRequirement: null,
                budget: null,
                status: "New",
                notes: "Test lead notes",
                suggestedFollowUpDate: null,
                suggestedFollowUpTime: null,
                confidence: { phone: "high" },
              },
            ],
          }),
        };
      });
    }
  });

  afterAll(async () => {
    // Cleanup any leads created during test runs
    if (createdLeadIds.length > 0) {
      await db.lead.deleteMany({
        where: { id: { in: createdLeadIds } },
      });
    }
    // Cleanup test user
    await db.user.deleteMany({
      where: { email: mockUser.email },
    });
  });

  // =========================================================================
  // 1. BULK PARSER TESTS
  // =========================================================================
  describe("1. Bulk Lead Parser & Deterministic Separation", () => {
    it("1 lead: parses single lead into an array with 1 draft", async () => {
      const input = "Faiz - 9876543210";
      const drafts = await parseBulkUnstructuredLeadText(input);

      expect(drafts).toHaveLength(1);
      expect(drafts[0].name).toBe("Faiz");
      expect(drafts[0].phone).toBe("+91 98765 43210");
      expect(drafts[0].status).toBe("New");
    });

    it("2 leads: parses 2 leads into exactly 2 drafts (Faiz & Ali)", async () => {
      const input = `Faiz - 9999999999\nAli - 8888888888`;
      const drafts = await parseBulkUnstructuredLeadText(input);

      expect(drafts).toHaveLength(2);
      expect(drafts[0].name).toBe("Faiz");
      expect(drafts[0].phone).toBe("+91 99999 99999");
      expect(drafts[1].name).toBe("Ali");
      expect(drafts[1].phone).toBe("+91 88888 88888");
    });

    it("10 leads: parses 10 distinct leads into exactly 10 drafts without combining", async () => {
      const names = ["Faiz", "Ali", "Rahul", "Sara", "Zaid", "Pooja", "Vikram", "Neha", "Arjun", "Kavita"];
      const lines = names.map((name, idx) => `${name} - 98765432${idx.toString().padStart(2, "0")}`);
      const input = lines.join("\n");

      const drafts = await parseBulkUnstructuredLeadText(input);

      expect(drafts).toHaveLength(10);
      for (let i = 0; i < 10; i++) {
        expect(drafts[i].name).toBe(names[i]);
        expect(drafts[i].phone).toContain("98765 432");
      }
    });

    it("phone-only list: parses 5 numbers into 5 drafts with null name and preserved phone", async () => {
      const input = `9876543210\n9876543211\n9876543212\n9876543213\n9876543214`;
      const drafts = await parseBulkUnstructuredLeadText(input);

      expect(drafts).toHaveLength(5);
      for (let i = 0; i < 5; i++) {
        expect(drafts[i].name).toBeNull();
        expect(drafts[i].phone).toBe(`+91 98765 4321${i}`);
      }
    });

    it("name + phone list: handles space-separated and hyphen-separated entries", async () => {
      const input = `Faiz 9999999999\nAli 8888888888\nRahul 7777777777`;
      const drafts = await parseBulkUnstructuredLeadText(input);

      expect(drafts).toHaveLength(3);
      expect(drafts[0].name).toBe("Faiz");
      expect(drafts[0].phone).toBe("+91 99999 99999");
      expect(drafts[1].name).toBe("Ali");
      expect(drafts[1].phone).toBe("+91 88888 88888");
      expect(drafts[2].name).toBe("Rahul");
      expect(drafts[2].phone).toBe("+91 77777 77777");
    });

    it("name + phone + budget: correctly parses budget notation across leads", async () => {
      const input = `Faiz - 9999999999 - 50k\nAli - 8888888888 - 1.5L\nRahul, 7777777777, Tech Startup, 30000`;
      const drafts = await parseBulkUnstructuredLeadText(input);

      expect(drafts).toHaveLength(3);
      expect(drafts[0].name).toBe("Faiz");
      expect(drafts[0].budget).toBe(50000);
      expect(drafts[1].name).toBe("Ali");
      expect(drafts[1].budget).toBe(150000);
      expect(drafts[2].name).toBe("Rahul");
      expect(drafts[2].budget).toBe(30000);
      expect(drafts[2].business).toBe("Tech Startup");
    });

    it("mixed WhatsApp text: splits chat log messages into distinct drafts", async () => {
      const input = `[12/09/2026, 10:15:30] Faiz: Hi I need website 9999999999\n[12/09/2026, 10:30:15] Ali: Contact me on 8888888888`;
      const drafts = await parseBulkUnstructuredLeadText(input);

      expect(drafts).toHaveLength(2);
      expect(drafts[0].phone).toBe("+91 99999 99999");
      expect(drafts[1].phone).toBe("+91 88888 88888");
    });

    it("international phone numbers: preserves international formatting without corrupting", async () => {
      const input = `John Smith - +1 415 555 2671\nTariq - +971 50 123 4567`;
      const drafts = await parseBulkUnstructuredLeadText(input);

      expect(drafts).toHaveLength(2);
      expect(drafts[0].name).toBe("John Smith");
      expect(drafts[0].phone).toBe("+14155552671");
      expect(drafts[1].name).toBe("Tariq");
      expect(drafts[1].phone).toBe("+971501234567");
    });

    it("numbered lists: parses 1. ... 2. ... accurately", async () => {
      const input = `1. Amit Kumar - 9876543210\n2. Priya Sharma - 9876543211\n3. Sunita - 9876543212`;
      const drafts = await parseBulkUnstructuredLeadText(input);

      expect(drafts).toHaveLength(3);
      expect(drafts[0].name).toBe("Amit Kumar");
      expect(drafts[0].phone).toBe("+91 98765 43210");
      expect(drafts[1].name).toBe("Priya Sharma");
      expect(drafts[2].name).toBe("Sunita");
    });
  });

  // =========================================================================
  // 2. SAFE LIMITS (50 MAX)
  // =========================================================================
  describe("2. Safe Batch Limits", () => {
    it("50 leads: allows parsing exactly 50 leads", async () => {
      const lines = Array.from({ length: 50 }, (_, i) => `Lead ${i + 1} - 98000000${i.toString().padStart(2, "0")}`);
      const input = lines.join("\n");

      const drafts = await parseBulkUnstructuredLeadText(input);
      expect(drafts).toHaveLength(50);
    });

    it("51 leads rejected cleanly: throws controlled validation message without silent truncation", async () => {
      const lines = Array.from({ length: 51 }, (_, i) => `Lead ${i + 1} - 98000000${i.toString().padStart(2, "0")}`);
      const input = lines.join("\n");

      await expect(parseBulkUnstructuredLeadText(input)).rejects.toThrow(
        /Maximum 50 leads allowed per paste/
      );
    });
  });

  // =========================================================================
  // 3. BULK DUPLICATE DETECTION
  // =========================================================================
  describe("3. Bulk Duplicate Detection", () => {
    const existingLeadPhone = "9988776655";
    const existingLeadEmail = "existing.duplicate@example.com";
    let existingDbLeadId: string;

    beforeAll(async () => {
      const lead = await db.lead.create({
        data: {
          name: "Existing DB Lead",
          phone: "+91 99887 76655",
          email: existingLeadEmail,
          business: "Existing Corp",
          status: "QUALIFIED",
        },
      });
      existingDbLeadId = lead.id;
      createdLeadIds.push(lead.id);
    });

    it("duplicate phone inside paste (in-batch duplicate): flags second item as DUPLICATE_PHONE", async () => {
      const drafts: StructuredLeadDraft[] = [
        { name: "First Person", phone: "+91 91234 56789" },
        { name: "Second Person (Same Phone)", phone: "+91 91234 56789" },
      ];

      const review = await analyzeBulkLeadDuplicates(drafts);

      expect(review.totalCount).toBe(2);
      expect(review.drafts[0].itemStatus).toBe("READY");
      expect(review.drafts[1].itemStatus).toBe("DUPLICATE_PHONE");
      expect(review.drafts[1].possibleDuplicate?.reason).toContain("Duplicate phone number inside this paste");
    });

    it("duplicate against DB: detects existing phone in Postgres database", async () => {
      const drafts: StructuredLeadDraft[] = [
        { name: "New Prospect", phone: existingLeadPhone },
      ];

      const review = await analyzeBulkLeadDuplicates(drafts);

      expect(review.drafts[0].itemStatus).toBe("DUPLICATE_PHONE");
      expect(review.drafts[0].possibleDuplicate?.id).toBe(existingDbLeadId);
      expect(review.drafts[0].possibleDuplicate?.name).toBe("Existing DB Lead");
    });

    it("duplicate against DB by email: detects existing email", async () => {
      const drafts: StructuredLeadDraft[] = [
        { name: "Unique Name", phone: "+91 91111 22222", email: existingLeadEmail },
      ];

      const review = await analyzeBulkLeadDuplicates(drafts);

      expect(review.drafts[0].itemStatus).toBe("DUPLICATE_EMAIL");
      expect(review.drafts[0].possibleDuplicate?.id).toBe(existingDbLeadId);
    });

    it("invalid lead data: flags item without name and phone as INVALID", async () => {
      const drafts: StructuredLeadDraft[] = [
        { name: null, phone: null, notes: "Just a random comment" },
        { name: "Valid Person", phone: "+91 98888 77777" },
      ];

      const review = await analyzeBulkLeadDuplicates(drafts);

      expect(review.drafts[0].itemStatus).toBe("INVALID");
      expect(review.invalidCount).toBe(1);
      expect(review.validCount).toBe(1);
    });
  });

  // =========================================================================
  // 4. BULK CREATE ACTION & PARTIAL FAILURE HANDLING
  // =========================================================================
  describe("4. Bulk Create Action & Partial Failure Resilience", () => {
    it("creates multiple genuine leads with individual LEAD_CREATED activities and AI refresh flags", async () => {
      const phoneA = "+91 91000 00001";
      const phoneB = "+91 91000 00002";

      const items: BulkCreateLeadItem[] = [
        {
          draft: {
            name: "Bulk Created Lead 1",
            phone: phoneA,
            business: "Agency A",
            budget: 50000,
            notes: "Specific note for Lead 1",
          },
          action: "CREATE",
        },
        {
          draft: {
            name: "Bulk Created Lead 2",
            phone: phoneB,
            business: "Agency B",
            notes: "Specific note for Lead 2",
          },
          action: "CREATE",
        },
      ];

      const res = await createBulkLeadsAction(items);

      expect(res.success).toBe(true);
      expect(res.summary.created).toBe(2);
      expect(res.summary.failed).toBe(0);

      // Verify records in DB
      for (const r of res.results) {
        expect(r.outcome).toBe("created");
        expect(r.leadId).toBeDefined();
        createdLeadIds.push(r.leadId!);

        const leadRecord = await db.lead.findUnique({
          where: { id: r.leadId },
          include: { activities: true, aiInsight: true },
        });
        expect(leadRecord).not.toBeNull();
        expect(leadRecord?.activities.some((a) => a.type === "LEAD_CREATED")).toBe(true);
        expect(leadRecord?.aiInsight?.needsRefresh).toBe(true);
      }
    });

    it("partial failure handling: one invalid item does not destroy valid items in batch", async () => {
      const validPhone = "+91 92000 00001";
      const items: BulkCreateLeadItem[] = [
        {
          draft: {
            name: "Valid Lead In Mixed Batch",
            phone: validPhone,
          },
          action: "CREATE",
        },
        {
          draft: {
            name: null,
            phone: null, // Invalid item
          },
          action: "CREATE",
        },
        {
          draft: {
            name: "Skipped Lead",
            phone: "+91 92000 00002",
          },
          action: "SKIP",
        },
      ];

      const res = await createBulkLeadsAction(items);

      expect(res.success).toBe(true);
      expect(res.summary.total).toBe(3);
      expect(res.summary.created).toBe(1);
      expect(res.summary.failed).toBe(1);
      expect(res.summary.skipped).toBe(1);

      const createdItem = res.results.find((r) => r.outcome === "created");
      expect(createdItem).toBeDefined();
      if (createdItem?.leadId) createdLeadIds.push(createdItem.leadId);

      const failedItem = res.results.find((r) => r.outcome === "failed");
      expect(failedItem?.error).toContain("must contain at least a name or a phone");
    });
  });

  // =========================================================================
  // 5. SERVER ACTIONS & E2E STRUCTURE ACTION
  // =========================================================================
  describe("5. End-to-End Server Action `structureBulkLeadAction`", () => {
    it("structureBulkLeadAction returns BulkLeadReviewDTO with counts and drafts", async () => {
      const input = `Faiz - 9999999999\nAli - 8888888888`;
      const res = await structureBulkLeadAction(input);

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.totalCount).toBe(2);
        expect(res.data.drafts).toHaveLength(2);
        expect(res.data.validCount).toBeGreaterThanOrEqual(1);
      }
    });

    it("handles empty input with friendly error message", async () => {
      const res = await structureBulkLeadAction("   ");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain("Please enter or paste lead details");
      }
    });
  });

  // =========================================================================
  // 6. BACKEND PERFORMANCE & ZERO GROQ ON PAGE LOAD
  // =========================================================================
  describe("6. Backend Performance & Zero Groq on Page Load", () => {
    it("getDashboardData loads quickly and does NOT invoke Groq LLM", async () => {
      const groqSpy = vi.spyOn(groqClient, "requestGroqJson");
      groqSpy.mockClear();

      const dashboardRes = await getDashboardData();

      expect(dashboardRes.success).toBe(true);
      expect(dashboardRes.data).toBeDefined();
      expect(dashboardRes.data?.kpis).toBeDefined();

      // Ensure no Groq requests were triggered during dashboard data fetch
      expect(groqSpy).not.toHaveBeenCalled();
    });

    it("getLeads loads quickly without triggering per-lead AI analysis", async () => {
      const groqSpy = vi.spyOn(groqClient, "requestGroqJson");
      const initialCallCount = groqSpy.mock.calls.length;

      const leadsRes = await getLeads();

      expect(leadsRes.success).toBe(true);
      if (leadsRes.success) {
        expect(Array.isArray(leadsRes.data)).toBe(true);
      }

      // Verify no Groq calls
      expect(groqSpy.mock.calls.length).toBe(initialCallCount);
    });
  });

  // =========================================================================
  // 7. REGRESSION: SINGLE AI LEAD ENTRY
  // =========================================================================
  describe("7. Regression: Single AI Lead Entry Backward Compatibility", () => {
    it("structureLeadAction still works for single lead entry", async () => {
      const res = await structureLeadAction("9876543210");
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.draft.phone).toBe("+91 98765 43210");
      }
    });
  });
});
