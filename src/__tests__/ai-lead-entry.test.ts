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
import { normalizePhone, extractPotentialPhone } from "@/features/leads/ai-parser/phone-utils";
import { parseBudget, extractPotentialBudget } from "@/features/leads/ai-parser/budget-utils";
import {
  isValidDateStr,
  isValidTimeStr,
  parseKolkataDateTime,
  getReferenceDateTimeContext,
} from "@/features/leads/ai-parser/date-utils";
import { findPossibleDuplicateLead } from "@/features/leads/ai-parser/duplicate-detector";
import { parseUnstructuredLeadText } from "@/features/leads/ai-parser/lead-parser";
import { structureLeadAction, updateExistingLeadWithDraftAction } from "@/app/actions/ai-lead-entry";
import { createLead } from "@/app/actions/leads";
import { db } from "@/lib/db";
import type { StructuredLeadDraft } from "@/features/leads/ai-entry-types";
import * as groqClient from "@/lib/ai/groq-client";

// Mock Auth Session for authenticated server actions
const mockUser = {
  id: "test-agent-a-user-id",
  email: "agent-a@test.com",
  role: "ADMIN",
};

vi.mock("@/lib/auth", () => ({
  getSession: async () => mockUser,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Phase 7: AI Lead Entry Backend", () => {
  const createdLeadIds: string[] = [];

  beforeAll(async () => {
    if (!process.env.GROQ_API_KEY) {
      vi.spyOn(groqClient, "requestGroqJson").mockImplementation(async ({ userPrompt }) => {
        if (userPrompt.includes("9876543210") && !userPrompt.includes("Rahul")) {
          return {
            rawJson: JSON.stringify({
              name: null,
              phone: "9876543210",
              email: null,
              business: null,
              industryOrRequirement: null,
              budget: null,
              status: "New",
              notes: "9876543210",
              suggestedFollowUpDate: null,
              suggestedFollowUpTime: null,
              confidence: {
                phone: "high",
              },
            }),
          };
        }
        if (userPrompt.includes("Rahul 9876543210")) {
          return {
            rawJson: JSON.stringify({
              name: "Rahul",
              phone: "9876543210",
              email: null,
              business: null,
              industryOrRequirement: null,
              budget: null,
              status: "New",
              notes: "Rahul 9876543210",
              suggestedFollowUpDate: null,
              suggestedFollowUpTime: null,
              confidence: {
                name: "high",
                phone: "high",
              },
            }),
          };
        }
        if (userPrompt.includes("Rahul ecommerce website 25k call tomorrow")) {
          return {
            rawJson: JSON.stringify({
              name: "Rahul",
              phone: null,
              email: null,
              business: null,
              industryOrRequirement: "ecommerce website",
              budget: 25000,
              status: "New",
              notes: "Rahul ecommerce website 25k call tomorrow",
              suggestedFollowUpDate: "2026-09-16",
              suggestedFollowUpTime: null,
              confidence: {
                name: "high",
                industryOrRequirement: "high",
                budget: "high",
                suggestedFollowUpDate: "high",
              },
            }),
          };
        }
        if (userPrompt.includes("Sameer wants ecommerce site around 30k")) {
          return {
            rawJson: JSON.stringify({
              name: "Sameer",
              phone: null,
              email: null,
              business: null,
              industryOrRequirement: "ecommerce site",
              budget: 30000,
              status: "New",
              notes: "discuss with partner",
              suggestedFollowUpDate: "2026-09-18",
              suggestedFollowUpTime: "16:00",
              confidence: {
                name: "high",
                industryOrRequirement: "high",
                budget: "high",
                suggestedFollowUpDate: "high",
                suggestedFollowUpTime: "high",
              },
            }),
          };
        }
        return {
          rawJson: JSON.stringify({
            name: null,
            phone: null,
            email: null,
            business: null,
            industryOrRequirement: null,
            budget: null,
            status: "New",
            notes: "xyz random messy notes from a call with no details",
            suggestedFollowUpDate: null,
            suggestedFollowUpTime: null,
            confidence: {},
          }),
        };
      });
    }

    let user = await db.user.findFirst();
    if (!user) {
      user = await db.user.create({
        data: {
          name: "Test Admin",
          email: `test-admin-${Date.now()}@example.com`,
          passwordHash: "dummyhash",
          role: "ADMIN",
        },
      });
    }
    mockUser.id = user.id;
    mockUser.email = user.email;
  });

  afterAll(async () => {
    // Clean up temporary test records
    for (const id of createdLeadIds) {
      try {
        await db.lead.delete({ where: { id } });
      } catch {
        // ignore if already deleted
      }
    }
  });

  // =========================================================================
  // 1. Phone Normalization
  // =========================================================================
  describe("Phone Handling & Normalization", () => {
    it("normalizes plain 10-digit Indian numbers", () => {
      const res = normalizePhone("9876543210");
      expect(res).not.toBeNull();
      expect(res?.display).toBe("+91 98765 43210");
      expect(res?.comparisonDigits).toBe("9876543210");
      expect(res?.whatsappDigits).toBe("919876543210");
      expect(res?.isIndian).toBe(true);
      expect(res?.isValid).toBe(true);
    });

    it("normalizes +91 prefixed Indian numbers", () => {
      const res = normalizePhone("+919876543210");
      expect(res?.display).toBe("+91 98765 43210");
      expect(res?.comparisonDigits).toBe("9876543210");
      expect(res?.whatsappDigits).toBe("919876543210");
    });

    it("normalizes spaced and dashed Indian numbers (91 98765 43210)", () => {
      const res = normalizePhone("91 98765 43210");
      expect(res?.display).toBe("+91 98765 43210");
      expect(res?.comparisonDigits).toBe("9876543210");
      expect(res?.whatsappDigits).toBe("919876543210");
    });

    it("normalizes 11-digit Indian numbers with leading 0 (09876543210)", () => {
      const res = normalizePhone("09876543210");
      expect(res?.display).toBe("+91 98765 43210");
      expect(res?.comparisonDigits).toBe("9876543210");
      expect(res?.whatsappDigits).toBe("919876543210");
    });

    it("does not corrupt international numbers", () => {
      const res = normalizePhone("+1 555 123 4567");
      expect(res?.isIndian).toBe(false);
      expect(res?.isValid).toBe(true);
      expect(res?.display).toBe("+15551234567");
      expect(res?.whatsappDigits).toBe("15551234567");
    });

    it("extracts potential phone numbers from messy sentences", () => {
      expect(extractPotentialPhone("Call Rahul at 9876543210 tomorrow")).toBe("9876543210");
      expect(extractPotentialPhone("whatsapp me +91 98765 43210 please")).toBe("+91 98765 43210");
      expect(extractPotentialPhone("Dial 09876543210 regarding invoice")).toBe("09876543210");
    });
  });

  // =========================================================================
  // 2. Budget Extraction
  // =========================================================================
  describe("Budget Extraction", () => {
    it("handles 25k, 25 K, 25K notation", () => {
      expect(parseBudget("25k")).toBe(25000);
      expect(parseBudget("25 K")).toBe(25000);
      expect(parseBudget("25K")).toBe(25000);
    });

    it("handles currency symbols and commas (₹25,000)", () => {
      expect(parseBudget("₹25,000")).toBe(25000);
      expect(parseBudget("Rs. 25,000")).toBe(25000);
      expect(parseBudget("25000")).toBe(25000);
    });

    it("handles written thousand notation (30 thousand)", () => {
      expect(parseBudget("30 thousand")).toBe(30000);
    });

    it("handles qualifiers (around 20k, approx 20k)", () => {
      expect(parseBudget("around 20k")).toBe(20000);
      expect(parseBudget("approx 50k")).toBe(50000);
    });

    it("handles Lakhs notation (1.5L, 2 lakh)", () => {
      expect(parseBudget("1.5L")).toBe(150000);
      expect(parseBudget("2 lakh")).toBe(200000);
    });

    it("extracts budget from sentences", () => {
      expect(extractPotentialBudget("wants ecommerce site budget around 30k")).toBe(30000);
      expect(extractPotentialBudget("Rahul ecommerce website 25k call tomorrow")).toBe(25000);
    });

    it("returns null for non-budget or missing inputs without false precision", () => {
      expect(parseBudget(null)).toBeNull();
      expect(parseBudget("")).toBeNull();
      expect(parseBudget("interested in website design")).toBeNull();
    });
  });

  // =========================================================================
  // 3. Date & Time Understanding (Asia/Kolkata)
  // =========================================================================
  describe("Date and Time Understanding", () => {
    it("validates YYYY-MM-DD date format", () => {
      expect(isValidDateStr("2026-09-15")).toBe(true);
      expect(isValidDateStr("invalid-date")).toBe(false);
      expect(isValidDateStr("2026-13-40")).toBe(false);
    });

    it("validates 24-hour HH:MM format", () => {
      expect(isValidTimeStr("16:00")).toBe(true);
      expect(isValidTimeStr("09:30")).toBe(true);
      expect(isValidTimeStr("25:00")).toBe(false);
      expect(isValidTimeStr("4pm")).toBe(false);
    });

    it("combines date and time in Asia/Kolkata (+05:30 offset)", () => {
      const dt = parseKolkataDateTime("2026-09-16", "16:00");
      expect(dt).not.toBeNull();
      // 16:00 IST is 10:30 UTC
      expect(dt?.toISOString()).toBe("2026-09-16T10:30:00.000Z");
    });

    it("generates reference datetime context in Asia/Kolkata", () => {
      const ctx = getReferenceDateTimeContext();
      expect(ctx.formattedKolkata).toContain("Asia/Kolkata");
      expect(ctx.todayDateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // =========================================================================
  // 4. Duplicate Detection (PostgreSQL)
  // =========================================================================
  describe("Duplicate Detection", () => {
    let existingLeadId: string;
    const uniqueSuffix = Date.now().toString().slice(-6);
    const testPhone = `98765${uniqueSuffix}`;
    const testEmail = `lead_${uniqueSuffix}@example.com`;

    beforeAll(async () => {
      const lead = await db.lead.create({
        data: {
          name: "Original Lead",
          phone: `+91 ${testPhone.slice(0, 5)} ${testPhone.slice(5)}`,
          email: testEmail,
          business: "Acme Corp",
          status: "NEW",
        },
      });
      existingLeadId = lead.id;
      createdLeadIds.push(lead.id);
    });

    it("detects duplicate by normalized phone number (Input F)", async () => {
      const candidate = await findPossibleDuplicateLead({
        name: "Different Name",
        phone: testPhone, // plain 10 digits
        email: null,
        business: null,
        industryOrRequirement: null,
        budget: null,
        status: "New",
        notes: null,
        suggestedFollowUpDate: null,
        suggestedFollowUpTime: null,
        confidence: {},
      });

      expect(candidate).not.toBeNull();
      expect(candidate?.id).toBe(existingLeadId);
      expect(candidate?.name).toBe("Original Lead");
      expect(candidate?.reason).toContain("Phone number");
      expect(candidate?.confidence).toBe("high");
    });

    it("detects duplicate by email address", async () => {
      const candidate = await findPossibleDuplicateLead({
        name: "New Person",
        phone: "9111222333",
        email: testEmail.toUpperCase(),
        business: null,
        industryOrRequirement: null,
        budget: null,
        status: "New",
        notes: null,
        suggestedFollowUpDate: null,
        suggestedFollowUpTime: null,
        confidence: {},
      });

      expect(candidate).not.toBeNull();
      expect(candidate?.id).toBe(existingLeadId);
      expect(candidate?.reason).toContain("Email");
    });

    it("returns null when no duplicate exists", async () => {
      const candidate = await findPossibleDuplicateLead({
        name: "Completely Unique Person",
        phone: "9823999999",
        email: "completely.unique@example.com",
        business: "Unique Biz",
        industryOrRequirement: null,
        budget: null,
        status: "New",
        notes: null,
        suggestedFollowUpDate: null,
        suggestedFollowUpTime: null,
        confidence: {},
      });

      expect(candidate).toBeNull();
    });
  });

  // =========================================================================
  // 5. Update Existing Duplicate & Create Anyway
  // =========================================================================
  describe("Update Existing Duplicate & Create Anyway", () => {
    it("updates only useful new fields without overwriting non-empty fields with null", async () => {
      const orig = await db.lead.create({
        data: {
          name: "Sameer Kumar",
          phone: "+91 98765 99999",
          email: "sameer@example.com",
          business: "Existing Business",
          budget: 20000,
          notes: "Initial note",
          status: "NEW",
        },
      });
      createdLeadIds.push(orig.id);

      // AI draft provides new budget (30k) and requirement, but name is null and email is null
      const draft: StructuredLeadDraft = {
        name: null, // should NOT overwrite "Sameer Kumar"
        phone: null, // should NOT overwrite phone
        email: null, // should NOT overwrite email
        business: null, // should NOT overwrite business
        industryOrRequirement: "E-commerce Website",
        budget: 30000,
        status: "Qualified",
        notes: "Discussed with partner, wants payment gateway",
        suggestedFollowUpDate: "2026-09-18",
        suggestedFollowUpTime: "16:00",
        confidence: {},
      };

      const res = await updateExistingLeadWithDraftAction(orig.id, draft);
      expect(res.success).toBe(true);
      if (!res.success) return;

      const updated = res.data;
      expect(updated.name).toBe("Sameer Kumar"); // Preserved
      expect(updated.email).toBe("sameer@example.com"); // Preserved
      expect(updated.business).toBe("Existing Business"); // Preserved
      expect(updated.budget).toBe(30000); // Updated
      expect(updated.industry).toBe("E-commerce Website"); // Updated
      expect(updated.notes).toContain("Initial note"); // History preserved
      expect(updated.notes).toContain("Discussed with partner");

      // Verify LEAD_UPDATED and FOLLOWUP_CREATED activities were logged
      const activities = await db.leadActivity.findMany({
        where: { leadId: orig.id },
        orderBy: { createdAt: "desc" },
      });
      expect(activities.some((a) => a.type === "LEAD_UPDATED")).toBe(true);
      expect(activities.some((a) => a.type === "FOLLOWUP_CREATED")).toBe(true);
    });

    it("allows Create Anyway even if duplicate phone exists", async () => {
      const duplicatePhone = "+91 98765 88888";
      const lead1 = await db.lead.create({
        data: {
          name: "First Lead",
          phone: duplicatePhone,
          status: "NEW",
        },
      });
      createdLeadIds.push(lead1.id);

      // User submits form with "Create Anyway"
      const formData = new FormData();
      formData.set("name", "Second Lead With Same Phone");
      formData.set("phone", duplicatePhone);
      formData.set("status", "New");

      const res = await createLead(formData);
      if (!res.success) {
        console.error("CREATE_LEAD_DEBUG_ERROR:", res.error);
      }
      expect(res.success).toBe(true);
      if (!res.success) return;

      createdLeadIds.push(res.data.id);
      expect(res.data.id).not.toBe(lead1.id);
      expect(res.data.name).toBe("Second Lead With Same Phone");
    });
  });

  // =========================================================================
  // 6. Lead Creation with Follow-Up Acceptance
  // =========================================================================
  describe("Lead Creation with Accepted Follow-Up", () => {
    it("creates Lead and schedules FollowUp record when nextFollowUpDate is submitted", async () => {
      const formData = new FormData();
      formData.set("name", "FollowUp Lead");
      formData.set("phone", "9876544444");
      formData.set("status", "New");
      formData.set("nextFollowUpDate", "2026-09-17");
      formData.set("suggestedFollowUpTime", "11:30");

      const res = await createLead(formData);
      expect(res.success).toBe(true);
      if (!res.success) return;

      createdLeadIds.push(res.data.id);
      expect(res.data.nextFollowUpDate).toBe("2026-09-17");

      // Verify FollowUp entity was created in DB
      const followUps = await db.followUp.findMany({
        where: { leadId: res.data.id },
      });
      expect(followUps.length).toBe(1);
      expect(followUps[0].status).toBe("PENDING");
      expect(followUps[0].type).toBe("CALL");

      // Verify activities
      const activities = await db.leadActivity.findMany({
        where: { leadId: res.data.id },
      });
      expect(activities.some((a) => a.type === "LEAD_CREATED")).toBe(true);
      expect(activities.some((a) => a.type === "FOLLOWUP_CREATED")).toBe(true);
    });
  });

  // =========================================================================
  // 7. Controlled Error Handling & Manual Entry Fallback
  // =========================================================================
  describe("Controlled Configuration & Error Handling", () => {
    it("returns friendly controlled error when structuring empty text", async () => {
      const res = await structureLeadAction("");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain("Please enter or paste");
      }
    });

    it("keeps Manual Lead Entry fully operational even without AI", async () => {
      const formData = new FormData();
      formData.set("name", "Manual Entry Lead");
      formData.set("phone", "+91 99988 77766");
      formData.set("email", "manual@example.com");
      formData.set("status", "New");

      const res = await createLead(formData);
      expect(res.success).toBe(true);
      if (res.success) {
        createdLeadIds.push(res.data.id);
        expect(res.data.name).toBe("Manual Entry Lead");
      }
    });
  });

  // =========================================================================
  // 8. Unstructured Parsing: Cases A, B, C, D, E & Zero Hallucination
  // =========================================================================
  describe("Unstructured Inputs A, B, C, D, E & Zero Hallucination", () => {
    it("Input A: Phone only (9876543210) - does not hallucinate name or budget", async () => {
      const parsed = await parseUnstructuredLeadText("9876543210");
      expect(parsed.phone).toBe("+91 98765 43210");
      // Zero hallucination guarantee:
      expect(parsed.name).toBeNull();
      expect(parsed.budget).toBeNull();
      expect(parsed.industryOrRequirement).toBeNull();
      expect(parsed.email).toBeNull();
      expect(parsed.status).toBe("New");
    });

    it("Input B: Name + Phone (Rahul 9876543210) - extracts facts, leaves rest null", async () => {
      const parsed = await parseUnstructuredLeadText("Rahul 9876543210");
      expect(parsed.phone).toBe("+91 98765 43210");
      expect(parsed.name).toBe("Rahul");
      expect(parsed.budget).toBeNull();
      expect(parsed.industryOrRequirement).toBeNull();
      expect(parsed.email).toBeNull();
    });

    it("Input C: Requirement + Budget + Relative date (Rahul ecommerce website 25k call tomorrow)", async () => {
      const parsed = await parseUnstructuredLeadText("Rahul ecommerce website 25k call tomorrow");
      expect(parsed.name).toBe("Rahul");
      expect(parsed.budget).toBe(25000);
      expect(parsed.industryOrRequirement).toContain("ecommerce website");
      expect(parsed.suggestedFollowUpDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(parsed.phone).toBeNull(); // No phone hallucinated
    });

    it("Input D: Complex sentence with time (Sameer wants ecommerce site around 30k, discuss with partner, follow up Friday 4pm)", async () => {
      const parsed = await parseUnstructuredLeadText(
        "Sameer wants ecommerce site around 30k, discuss with partner, follow up Friday 4pm"
      );
      expect(parsed.name).toBe("Sameer");
      expect(parsed.budget).toBe(30000);
      expect(parsed.suggestedFollowUpTime).toBe("16:00");
      expect(parsed.suggestedFollowUpDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(parsed.notes).toContain("discuss with partner");
    });

    it("Input E: Incomplete / messy / random text - does not crash, preserves input in notes", async () => {
      const parsed = await parseUnstructuredLeadText("xyz random messy notes from a call with no details");
      expect(parsed.name).toBeNull();
      expect(parsed.phone).toBeNull();
      expect(parsed.budget).toBeNull();
      expect(parsed.notes).toContain("xyz random messy notes");
      expect(parsed.status).toBe("New");
    });
  });
});
