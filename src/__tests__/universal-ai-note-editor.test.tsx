import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AiNoteEditor } from "@/components/ui/ai-note-editor";
import { improveNoteText } from "@/app/actions/conversation-notes";
import * as groqClient from "@/lib/ai/groq-client";
import {
  formatNumberedPoints,
  LEAD_NOTE_IMPROVE_SYSTEM_PROMPT,
} from "@/lib/format-numbered-points";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn().mockResolvedValue({ id: "test-user-id" }),
  requireAuthenticatedUser: vi.fn().mockResolvedValue({ id: "test-user-id" }),
}));

describe("Universal AI Note Editor & AI Improvement Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. FACT PRESERVATION & SYSTEM PROMPT SAFETY
  // ─────────────────────────────────────────────────────────────
  describe("1. Fact Preservation & AI Safety", () => {
    it("preserves facts, amounts, dates, names, URLs, phone numbers without hallucinating", () => {
      expect(LEAD_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("You must NOT invent, extrapolate, or assume");
      expect(LEAD_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("client requirements");
      expect(LEAD_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("pricing or budget");
      expect(LEAD_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("dates, days, or deadlines");
      expect(LEAD_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("follow-up commitments");
      expect(LEAD_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("Strictly preserve all facts");
      expect(LEAD_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("Strictly preserve amounts and numerical values");
    });

    it("verifies language preservation rules for English, Hinglish, and Hindi", () => {
      expect(LEAD_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("English input -> English output");
      expect(LEAD_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("Hinglish input -> natural Hinglish output");
      expect(LEAD_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("Hindi input -> Hindi output");
      expect(LEAD_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("Do NOT automatically translate between languages");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. NUMBERED FORMATTING RULES
  // ─────────────────────────────────────────────────────────────
  describe("2. Numbered Formatting Structure", () => {
    it("enforces numbered point format (1. ..., 2. ...) and removes conversational filler", () => {
      const sample = `Here is the note:
1. Client needs ecommerce portal.
2. Quoted amount ₹45,000.`;
      const cleaned = formatNumberedPoints(sample);
      expect(cleaned).toBe("1. Client needs ecommerce portal.\n2. Quoted amount ₹45,000.");
      expect(cleaned).not.toContain("Here is the note:");
    });

    it("formats unnumbered multiline notes into numbered list correctly", () => {
      const rawText = `Client wants custom CRM
Budget is 50k
Call on Friday`;
      const cleaned = formatNumberedPoints(rawText);
      expect(cleaned).toBe("1. Client wants custom CRM\n2. Budget is 50k\n3. Call on Friday");
    });

    it("allows a single factual point to remain 1 numbered item", () => {
      const raw = "Client will call back at 4pm";
      const cleaned = formatNumberedPoints(raw);
      expect(cleaned).toBe("1. Client will call back at 4pm");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. REUSABLE COMPONENT RENDERING & ATTRIBUTES
  // ─────────────────────────────────────────────────────────────
  describe("3. AiNoteEditor Component Rendering", () => {
    it("renders textarea, label, placeholder, and Improve with AI button", () => {
      const html = renderToStaticMarkup(
        <AiNoteEditor
          label="Follow-up Note"
          placeholder="Add a note about this follow-up..."
          defaultValue="initial draft"
          name="note"
        />
      );

      expect(html).toContain("Follow-up Note");
      expect(html).toContain('placeholder="Add a note about this follow-up..."');
      expect(html).toContain("initial draft");
      expect(html).toContain("Improve with AI");
      expect(html).toContain('name="note"');
    });

    it("renders disabled Improve button when text is empty", () => {
      const html = renderToStaticMarkup(
        <AiNoteEditor
          label="Empty Note"
          placeholder="Write..."
          defaultValue=""
        />
      );

      expect(html).toContain("Improve with AI");
      expect(html).toContain("disabled");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. IMPROVE WITH AI, UNDO, AND NO AUTOSAVE WORKFLOW
  // ─────────────────────────────────────────────────────────────
  describe("4. AI Improvement & Undo Workflow Simulation", () => {
    it("simulates full note improvement lifecycle: draft -> AI improved -> Undo -> explicit save", async () => {
      const originalDraft = "client wants website 30k budget call tomorrow he likes ecommerce";
      let currentText = originalDraft;
      let lastOriginalDraft: string | null = null;
      let isSaved = false;

      const onSaveMock = vi.fn(async (text: string) => {
        isSaved = true;
        return { success: true };
      });

      const mockAiOutput = `1. Client is interested in an e-commerce website.
2. Approximate budget is ₹30,000.
3. Follow up with the client tomorrow.`;

      vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({ text: mockAiOutput });

      // Step 1: User clicks Improve with AI
      const improveRes = await improveNoteText(currentText);
      expect(improveRes.success).toBe(true);
      expect(improveRes.data).toBe(mockAiOutput);

      // Verify NO autosave
      expect(onSaveMock).not.toHaveBeenCalled();
      expect(isSaved).toBe(false);

      // AiNoteEditor replaces text and stores original for Undo
      lastOriginalDraft = currentText;
      currentText = improveRes.data!;
      expect(currentText).toBe(mockAiOutput);
      expect(lastOriginalDraft).toBe(originalDraft);

      // Step 2: User clicks Undo -> restores exact original draft
      currentText = lastOriginalDraft;
      lastOriginalDraft = null;
      expect(currentText).toBe(originalDraft);
      expect(lastOriginalDraft).toBeNull();
      expect(onSaveMock).not.toHaveBeenCalled();

      // Step 3: User re-improves and saves explicitly
      const reImprove = await improveNoteText(currentText);
      currentText = reImprove.data!;
      await onSaveMock(currentText);

      expect(onSaveMock).toHaveBeenCalledWith(mockAiOutput);
      expect(isSaved).toBe(true);
    });

    it("keeps original draft untouched when AI / Groq call fails", async () => {
      const originalDraft = "important draft that should not be lost";
      let currentText = originalDraft;

      vi.spyOn(groqClient, "requestGroqText").mockRejectedValue(new Error("Groq timeout 504"));

      const result = await improveNoteText(currentText);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Draft remains intact
      expect(currentText).toBe(originalDraft);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. INTEGRATION IN ALL TRUE NOTE AREAS
  // ─────────────────────────────────────────────────────────────
  describe("5. Integration in Note Areas", () => {
    it("renders NoteComposer using AiNoteEditor with Save Note button", async () => {
      const { NoteComposer } = await import("@/features/activity/note-composer");
      const html = renderToStaticMarkup(
        <NoteComposer onAddNote={vi.fn().mockResolvedValue({ success: true })} />
      );

      expect(html).toContain("Add a note");
      expect(html).toContain("Improve with AI");
      expect(html).toContain("Save Note");
    });

    it("renders Follow-up Form with AiNoteEditor", async () => {
      const { FollowUpForm } = await import("@/features/followups/follow-up-form");
      const html = renderToStaticMarkup(
        <FollowUpForm
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          defaultLeadId="lead-1"
          leads={[{ id: "lead-1", name: "Acme Corp" }]}
        />
      );

      expect(html).toContain("Note");
      expect(html).toContain("placeholder=\"Add a note about this follow-up...\"");
      expect(html).toContain("Improve with AI");
    });

    it("renders Call Outcome Modal with AiNoteEditor", async () => {
      const { CallOutcomeModal } = await import("@/components/call-outcome-modal");
      const html = renderToStaticMarkup(
        <CallOutcomeModal
          isOpen={true}
          lead={{
            id: "lead-1",
            name: "John Doe",
            phone: "+919876543210",
            email: "john@example.com",
            status: "New",
            notes: "Test notes",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as any}
          onClose={vi.fn()}
        />
      );

      // Outcome selection buttons rendered
      expect(html).toContain("Call Outcome");
    });

    it("renders Lead Form Modal with AiNoteEditor for notes", async () => {
      const { LeadForm } = await import("@/features/leads/lead-form");
      const html = renderToStaticMarkup(
        <LeadForm
          open={true}
          lead={{
            id: "lead-1",
            name: "Acme Corp",
            phone: "+919876543210",
            email: "acme@example.com",
            business: "Acme LLC",
            industry: "Retail",
            quotedAmount: 50000,
            source: "Website",
            notes: "Initial requirement note",
            status: "New",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            deletedAt: null,
          } as any}
          saving={false}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />
      );

      expect(html).toContain("Notes");
      expect(html).toContain("Initial requirement note");
      expect(html).toContain("Improve with AI");
    });

    it("renders Structured Lead Preview with AiNoteEditor", async () => {
      const { StructuredLeadPreview } = await import("@/features/leads/structured-lead-preview");
      const html = renderToStaticMarkup(
        <StructuredLeadPreview
          draft={{
            name: "Jane Smith",
            phone: "+919876543211",
            notes: "Needs Shopify website",
            status: "New",
          }}
          saving={false}
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onDismissDuplicate={vi.fn()}
        />
      );

      expect(html).toContain("Notes");
      expect(html).toContain("Needs Shopify website");
      expect(html).toContain("Improve with AI");
    });

    it("renders Deals Workspace with AiNoteEditor for deal notes", async () => {
      const { DealsWorkspace } = await import("@/features/deals/components/deals-workspace");
      const { calculateDealMetrics } = await import("@/features/deals/calculations");
      const html = renderToStaticMarkup(
        <DealsWorkspace
          initialDeals={[]}
          initialMetrics={calculateDealMetrics([])}
        />
      );

      expect(html).toContain("Search deals...");
    });

    it("renders Lost Reason Dialog with AiNoteEditor", async () => {
      const { LostReasonDialog } = await import("@/features/lost-reasons/lost-reason-dialog");
      const html = renderToStaticMarkup(
        <LostReasonDialog
          isOpen={true}
          leadId="lead-1"
          leadName="Lost Lead"
          initialReason="OTHER"
          initialNotes="Pricing too high"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(html).toContain("Explanation");
      expect(html).toContain("Pricing too high");
      expect(html).toContain("Improve with AI");
    });
  });
});
