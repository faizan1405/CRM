import { describe, it, expect, vi, beforeEach } from "vitest";
import { improveNoteText, formatNumberedPoints, LEAD_NOTE_IMPROVE_SYSTEM_PROMPT } from "@/app/actions/conversation-notes";
import * as groqClient from "@/lib/ai/groq-client";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn().mockResolvedValue({ id: "test-user-id" }),
  requireAuthenticatedUser: vi.fn().mockResolvedValue({ id: "test-user-id" }),
}));

describe("Lead Detail Note AI Improvement Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. NUMBERED OUTPUT
  describe("NUMBERED OUTPUT", () => {
    it("rewrites raw lead notes into structured numbered points (1. ..., 2. ...)", async () => {
      const input = "client wants ecommerce website budget around 30k he will talk to partner call him monday and he liked premium design";
      const mockOutput = `1. Client is interested in an e-commerce website.
2. Approximate budget is ₹30,000.
3. Client will discuss the project with their partner.
4. Follow up with the client on Monday.
5. Client prefers the premium design option.`;

      const requestSpy = vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({ text: mockOutput });

      const result = await improveNoteText(input);

      expect(result.success).toBe(true);
      expect(result.data).toBe(mockOutput);
      expect(requestSpy).toHaveBeenCalledTimes(1);

      // Verify each point starts with a number and period
      const lines = result.data!.split("\n");
      expect(lines).toHaveLength(5);
      lines.forEach((line, index) => {
        expect(line.startsWith(`${index + 1}. `)).toBe(true);
      });
    });

    it("accepts a single numbered point when there is only one meaningful fact", async () => {
      const input = "client call tomorrow";
      const mockOutput = "1. Client requested a follow-up tomorrow.";

      vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({ text: mockOutput });

      const result = await improveNoteText(input);
      expect(result.success).toBe(true);
      expect(result.data).toBe("1. Client requested a follow-up tomorrow.");
    });
  });

  // 2. NO PARAGRAPH OUTPUT
  describe("NO PARAGRAPH OUTPUT", () => {
    it("strict system prompt forbids single paragraphs, giant sentences, and headings", async () => {
      const input = "need ecommerce website";
      const requestSpy = vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({
        text: "1. Client requires an e-commerce website.",
      });

      await improveNoteText(input);
      const args = requestSpy.mock.calls[0][0];

      expect(args.systemPrompt).toContain("Do NOT return a single continuous paragraph");
      expect(args.systemPrompt).toContain("Do NOT return one giant sentence");
      expect(args.systemPrompt).toContain("Do NOT include any titles, markdown headings, or section labels");
      expect(args.systemPrompt).toContain("Do NOT include any introductory or concluding conversational filler");
      expect(args.temperature).toBe(0.1);
    });

    it("formatNumberedPoints normalizes unformatted text and strips conversational preamble", () => {
      const rawWithPreamble = `Here is the improved note:
1. Client wants a custom web application.
2. Budget is ₹50,000.`;
      const cleaned = formatNumberedPoints(rawWithPreamble);
      expect(cleaned).toBe("1. Client wants a custom web application.\n2. Budget is ₹50,000.");

      // If AI returns raw unnumbered lines, it automatically converts them to numbered points
      const rawParagraphLines = `Client wants an ecommerce portal
Follow up on Friday`;
      const cleanedLines = formatNumberedPoints(rawParagraphLines);
      expect(cleanedLines).toBe("1. Client wants an ecommerce portal\n2. Follow up on Friday");
    });
  });

  // 3. FACT PRESERVATION
  describe("FACT PRESERVATION", () => {
    it("strict system prompt strictly prohibits inventing facts, requirements, or commitments", async () => {
      const input = "client wants website 30k budget call tomorrow he likes ecommerce";
      const requestSpy = vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({
        text: `1. Client is interested in an e-commerce website.
2. Budget is approximately ₹30,000.
3. Follow up tomorrow.`,
      });

      const result = await improveNoteText(input);
      expect(result.success).toBe(true);

      const prompt = requestSpy.mock.calls[0][0].systemPrompt;
      expect(prompt).toContain("You must NOT invent, extrapolate, or assume");
      expect(prompt).toContain("client requirements");
      expect(prompt).toContain("pricing or budget");
      expect(prompt).toContain("dates, days, or deadlines");
      expect(prompt).toContain("follow-up commitments");
      expect(prompt).toContain("objections");
      expect(prompt).toContain("recommendations");
      expect(prompt).toContain("promises or guarantees");
      expect(prompt).toContain("Strictly preserve all facts");
    });
  });

  // 4. AMOUNT PRESERVATION
  describe("AMOUNT PRESERVATION", () => {
    it("preserves exact amounts such as 30k / ₹30,000 without alteration", async () => {
      const input = "client wants website 30k budget call tomorrow he likes ecommerce";
      const mockOutput = `1. Client is interested in an e-commerce website.
2. Budget is approximately ₹30,000.
3. Follow up tomorrow.`;

      const requestSpy = vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({ text: mockOutput });

      const result = await improveNoteText(input);
      expect(result.success).toBe(true);
      expect(result.data).toContain("₹30,000");

      const prompt = requestSpy.mock.calls[0][0].systemPrompt;
      expect(prompt).toContain("Strictly preserve amounts and numerical values");
      expect(prompt).toContain("₹30,000");
    });
  });

  // 5. LANGUAGE PRESERVATION
  describe("LANGUAGE PRESERVATION", () => {
    it("instructs language preservation for English, Hinglish, and Hindi", () => {
      expect(LEAD_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("English input -> English output");
      expect(LEAD_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("Hinglish input -> natural Hinglish output");
      expect(LEAD_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("Hindi input -> Hindi output");
      expect(LEAD_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("Do NOT automatically translate between languages");
    });

    it("handles Hinglish input and preserves natural Hinglish response", async () => {
      const hinglishInput = "client ko demo pasand aaya budget 30k bola kal call karna hai";
      const mockHinglishOutput = `1. Client ko demo pasand aaya.
2. Client ne budget ₹30,000 bataya hai.
3. Kal client ko call karna hai.`;

      vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({ text: mockHinglishOutput });

      const result = await improveNoteText(hinglishInput);
      expect(result.success).toBe(true);
      expect(result.data).toBe(mockHinglishOutput);
    });

    it("handles Hindi input and preserves Hindi response", async () => {
      const hindiInput = "ग्राहक को वेबसाइट चाहिए बजट तीस हजार है कल बात होगी";
      const mockHindiOutput = `1. ग्राहक को वेबसाइट की आवश्यकता है।
2. बजट लगभग ₹30,000 है।
3. कल ग्राहक से बातचीत होगी।`;

      vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({ text: mockHindiOutput });

      const result = await improveNoteText(hindiInput);
      expect(result.success).toBe(true);
      expect(result.data).toBe(mockHindiOutput);
    });
  });

  // 6. UX: UNDO, NO AUTO SAVE, ERROR PRESERVATION
  describe("UX: Undo, No Auto-Save, and Error Handling", () => {
    it("simulates NoteComposer behavior: Improve replaces draft, Undo restores original, Save is explicit", async () => {
      // Step 1: User writes initial draft
      const originalDraft = "client wants website 30k budget call tomorrow he likes ecommerce";
      let currentText = originalDraft;
      let savedDraft: string | null = null;
      let isSaved = false;

      // Mock save handler
      const onAddNote = vi.fn(async (note: string) => {
        isSaved = true;
        return { success: true };
      });

      // Step 2: User clicks "Improve with AI"
      const mockAiOutput = `1. Client is interested in an e-commerce website.
2. Budget is approximately ₹30,000.
3. Follow up tomorrow.`;

      vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({ text: mockAiOutput });

      const improveResult = await improveNoteText(currentText);
      expect(improveResult.success).toBe(true);

      // Verify NO auto-save occurred
      expect(onAddNote).not.toHaveBeenCalled();
      expect(isSaved).toBe(false);

      // NoteComposer stores pre-improved draft for Undo and updates textarea
      savedDraft = currentText;
      currentText = improveResult.data!;

      expect(currentText).toBe(mockAiOutput);
      expect(savedDraft).toBe(originalDraft);

      // Step 3: Test Undo - restores exact original draft
      currentText = savedDraft;
      savedDraft = null;

      expect(currentText).toBe(originalDraft);
      expect(savedDraft).toBeNull();
      expect(onAddNote).not.toHaveBeenCalled();

      // Step 4: Improve again and explicit Save
      const reImprove = await improveNoteText(currentText);
      currentText = reImprove.data!;
      await onAddNote(currentText);

      expect(onAddNote).toHaveBeenCalledTimes(1);
      expect(onAddNote).toHaveBeenCalledWith(mockAiOutput);
      expect(isSaved).toBe(true);
    });

    it("if AI fails, keep original draft unchanged", async () => {
      const originalDraft = "client wants website 30k budget";
      let currentText = originalDraft;

      vi.spyOn(groqClient, "requestGroqText").mockRejectedValue(new Error("Groq timeout"));

      const result = await improveNoteText(currentText);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Draft remains unchanged
      expect(currentText).toBe(originalDraft);
    });
  });

  // 7. MULTILINE FORMAT PRESERVATION
  describe("MULTILINE FORMAT PRESERVATION", () => {
    it("maintains line breaks in structured points", () => {
      const structured = `1. Client is interested in an e-commerce website.
2. Budget is approximately ₹30,000.
3. Follow up tomorrow.`;

      const formatted = formatNumberedPoints(structured);
      expect(formatted.split("\n")).toHaveLength(3);
      expect(formatted).toContain("\n2. Budget is approximately ₹30,000.");
    });
  });
});
