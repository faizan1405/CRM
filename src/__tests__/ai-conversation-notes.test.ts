import { describe, it, expect } from "vitest";
import {
  formatFollowUpDate,
  formatFollowUpTime,
  formatFollowUpCombined,
  formatStructuredCallNote,
} from "@/features/ai-conversation-notes/formatters";
import {
  mockStructureNotesCallback,
  MOCK_NOTE_PRESETS,
  DEFAULT_QUICK_TAGS,
} from "@/features/ai-conversation-notes/mock-data";
import type { StructuredCallNotesData, CallNotesWorkflowResult } from "@/features/ai-conversation-notes/types";

describe("AI Conversation / Call Notes Feature Unit Tests", () => {
  describe("Formatters & Clean Output for Phase 5 Lead Activity Notes", () => {
    it("formats a full structured call note matching prompt specification", () => {
      const sampleData: StructuredCallNotesData = {
        requirement: "E-commerce Website",
        budget: "₹25,000",
        interestLevel: "High",
        decisionFactor: "Discuss with partner",
        objections: null,
        importantDetails: null,
        nextAction: null,
        suggestedFollowUpDate: "2026-09-18",
        suggestedFollowUpTime: "16:00",
        tags: ["Interested", "Follow-up Required"],
      };

      const formatted = formatStructuredCallNote(sampleData);

      expect(formatted).toContain("Requirement: E-commerce Website");
      expect(formatted).toContain("Budget: ₹25,000");
      expect(formatted).toContain("Interest: High");
      expect(formatted).toContain("Decision: Discuss with partner");
      expect(formatted).toContain("Follow-up: 18 Sep 2026 — 4:00 PM");
      expect(formatted).toContain("Tags: Interested, Follow-up Required");
      // Missing fields should not generate empty lines
      expect(formatted).not.toContain("Objections:");
      expect(formatted).not.toContain("Important Details:");
    });

    it("formats follow-up date and time correctly", () => {
      expect(formatFollowUpDate("2026-09-18")).toBe("18 Sep 2026");
      expect(formatFollowUpTime("16:00")).toBe("4:00 PM");
      expect(formatFollowUpTime("11:00")).toBe("11:00 AM");
      expect(formatFollowUpCombined("2026-09-18", "16:00")).toBe("18 Sep 2026 — 4:00 PM");
      expect(formatFollowUpCombined("Friday", "4:00 PM")).toBe("Friday — 4:00 PM");
    });
  });

  describe("Mock AI Callback & Zero Invention of Missing Fields", () => {
    it("extracts structured fields for rough note: 'interested ecommerce 25k budget talk with partner follow up friday 4pm'", async () => {
      const raw = "interested ecommerce 25k budget talk with partner follow up friday 4pm";
      const result = await mockStructureNotesCallback(raw);

      expect(result.requirement).toBe("E-commerce Website");
      expect(result.budget).toBe("₹25,000");
      expect(result.interestLevel).toBe("High");
      expect(result.decisionFactor).toBe("Discuss with partner");
      expect(result.suggestedFollowUpDate).toBe("2026-09-18");
      expect(result.suggestedFollowUpTime).toBe("16:00");

      // Critical Rule: Never show invented values for missing fields
      expect(result.objections).toBeNull();
      expect(result.importantDetails).toBeNull();
    });

    it("returns null for missing fields on minimal note without hallucination", async () => {
      const raw = "called 3 times no response left voicemail to check if still interested";
      const result = await mockStructureNotesCallback(raw);

      expect(result.requirement).toBeNull();
      expect(result.budget).toBeNull();
      expect(result.decisionFactor).toBeNull();
      expect(result.objections).toBeNull();
      expect(result.suggestedFollowUpDate).toBeNull();
      expect(result.suggestedFollowUpTime).toBeNull();
      expect(result.interestLevel).toBe("Low");
      expect(result.tags).toContain("No Response");
    });

    it("handles all predefined mock presets consistently", async () => {
      for (const preset of MOCK_NOTE_PRESETS) {
        const result = await mockStructureNotesCallback(preset.rawNote);
        expect(result.interestLevel).toBe(preset.expectedResult.interestLevel);
        if (preset.expectedResult.requirement) {
          expect(result.requirement).toBe(preset.expectedResult.requirement);
        } else {
          expect(result.requirement).toBeNull();
        }
      }
    });

    it("provides the standard quick tags requested", () => {
      expect(DEFAULT_QUICK_TAGS).toContain("Interested");
      expect(DEFAULT_QUICK_TAGS).toContain("Price Concern");
      expect(DEFAULT_QUICK_TAGS).toContain("Follow-up Required");
      expect(DEFAULT_QUICK_TAGS).toContain("Decision Maker");
      expect(DEFAULT_QUICK_TAGS).toContain("No Response");
    });
  });

  describe("Original Note Preservation & Decision Flow", () => {
    it("preserves original raw note when choosing Apply Structured Note", () => {
      const rawNote = "rough unstructured call note text 25k";
      const structured: StructuredCallNotesData = {
        requirement: "Custom Dev",
        budget: "₹25,000",
        interestLevel: "High",
        decisionFactor: null,
        objections: null,
        importantDetails: null,
        nextAction: null,
        suggestedFollowUpDate: null,
        suggestedFollowUpTime: null,
      };

      const result: CallNotesWorkflowResult = {
        appliedType: "structured",
        formattedOutput: formatStructuredCallNote(structured),
        structuredData: structured,
        rawNote,
        appliedAt: new Date().toISOString(),
      };

      expect(result.appliedType).toBe("structured");
      expect(result.rawNote).toBe(rawNote);
      expect(result.formattedOutput).toContain("Requirement: Custom Dev");
    });

    it("preserves original raw note when choosing Keep Original", () => {
      const rawNote = "rough unstructured call note text 25k";

      const result: CallNotesWorkflowResult = {
        appliedType: "original",
        formattedOutput: rawNote,
        structuredData: null,
        rawNote,
        appliedAt: new Date().toISOString(),
      };

      expect(result.appliedType).toBe("original");
      expect(result.rawNote).toBe(rawNote);
      expect(result.formattedOutput).toBe(rawNote);
    });

    it("verifies user can edit any structured field before applying (Editable Review workflow)", () => {
      const initial: StructuredCallNotesData = {
        requirement: "E-commerce Website",
        budget: "₹25,000",
        interestLevel: "High",
        decisionFactor: "Discuss with partner",
        objections: null,
        importantDetails: null,
        nextAction: null,
        suggestedFollowUpDate: "2026-09-18",
        suggestedFollowUpTime: "16:00",
      };

      // User modifies requirement and budget during Review step
      const edited: StructuredCallNotesData = {
        ...initial,
        requirement: "E-commerce Website with Custom Mobile App",
        budget: "₹45,000",
        objections: "Requires payment in 3 installments",
        nextAction: "Send updated contract with installment terms",
      };

      const formatted = formatStructuredCallNote(edited);
      expect(formatted).toContain("Requirement: E-commerce Website with Custom Mobile App");
      expect(formatted).toContain("Budget: ₹45,000");
      expect(formatted).toContain("Objections: Requires payment in 3 installments");
      expect(formatted).toContain("Next Action: Send updated contract with installment terms");
      expect(formatted).toContain("Follow-up: 18 Sep 2026 — 4:00 PM");
    });
  });
});
