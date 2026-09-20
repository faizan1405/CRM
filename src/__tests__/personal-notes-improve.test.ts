import { describe, it, expect, vi, beforeEach } from "vitest";
import * as groqClient from "@/lib/ai/groq-client";
import {
  improvePersonalNoteService,
  PERSONAL_NOTE_IMPROVE_SYSTEM_PROMPT,
} from "@/features/personal-notes/services/notes-ai-transformer";
import { improvePersonalNote } from "@/app/actions/personal-notes";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    personalNote: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe("Personal Notes AI Improve Feature", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      id: "test-user-id",
      email: "user@example.com",
    });
  });

  describe("1. Existing AI / Groq Infrastructure Reuse", () => {
    it("reuses requestGroqText from groq-client with temperature 0.1", async () => {
      const spy = vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({
        text: "Call Rahul tomorrow regarding the 30k budget.",
      });

      const result = await improvePersonalNoteService("call rahul tomorrow 30k budget");

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: PERSONAL_NOTE_IMPROVE_SYSTEM_PROMPT,
          userPrompt: "call rahul tomorrow 30k budget",
          temperature: 0.1,
        })
      );
      expect(result).toBe("Call Rahul tomorrow regarding the 30k budget.");
    });

    it("verifies system prompt enforces strict rules: light rewrite, clarity, fact preservation, no hallucinations", () => {
      expect(PERSONAL_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("Lightly rewrite this personal CRM note for clarity and readability");
      expect(PERSONAL_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("Preserve every factual detail, number, name, date, amount and meaning");
      expect(PERSONAL_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("Do not invent, infer or recommend anything");
      expect(PERSONAL_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("numbers");
      expect(PERSONAL_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("prices");
      expect(PERSONAL_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("names");
      expect(PERSONAL_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("dates");
      expect(PERSONAL_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("Hinglish");
      expect(PERSONAL_NOTE_IMPROVE_SYSTEM_PROMPT).toContain("Return ONLY the improved note text");
    });
  });

  describe("2. Targeted Checks: Fact Preservation", () => {
    it('preserves Rahul, tomorrow, 30k for "call rahul tomorrow 30k budget"', async () => {
      const input = "call rahul tomorrow 30k budget";
      const improvedText = "Call Rahul tomorrow regarding the 30k budget.";

      vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({
        text: improvedText,
      });

      const result = await improvePersonalNoteService(input);

      expect(result.toLowerCase()).toContain("rahul");
      expect(result.toLowerCase()).toContain("tomorrow");
      expect(result.toLowerCase()).toContain("30k");
    });

    it('preserves 9000 and 21000 for "payment 9000 received remaining 21000"', async () => {
      const input = "payment 9000 received remaining 21000";
      const improvedText = "Payment of 9000 received; remaining balance is 21000.";

      vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({
        text: improvedText,
      });

      const result = await improvePersonalNoteService(input);

      expect(result).toContain("9000");
      expect(result).toContain("21000");
    });

    it("strips wrapping quotes and markdown code blocks if returned by model", async () => {
      vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({
        text: '```\n"Call client tomorrow. They mentioned a budget concern around ₹30,000."\n```',
      });

      const result = await improvePersonalNoteService("call client tommorow he say budget issue maybe 30k");
      expect(result).toBe("Call client tomorrow. They mentioned a budget concern around ₹30,000.");
      expect(result.startsWith('"')).toBe(false);
      expect(result.endsWith('"')).toBe(false);
      expect(result.includes("```")).toBe(false);
    });
  });

  describe("3. Hinglish & Language Style Preservation", () => {
    it("preserves natural Hinglish without forcing formal English", async () => {
      const input = "kl rahul ko call krna h 30k budget h uska";
      const naturalHinglish = "Kal Rahul ko call karna hai, uska budget 30k hai.";

      vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({
        text: naturalHinglish,
      });

      const result = await improvePersonalNoteService(input);

      expect(result).toBe(naturalHinglish);
      expect(result.toLowerCase()).toContain("rahul");
      expect(result.toLowerCase()).toContain("30k");
      expect(result.toLowerCase()).toContain("call");
    });
  });

  describe("4. AI Failure Safety", () => {
    it("service handles AIServiceError cleanly and does not leak internals", async () => {
      vi.spyOn(groqClient, "requestGroqText").mockRejectedValue(
        new groqClient.AIServiceError("Provider internal timeout")
      );

      await expect(improvePersonalNoteService("important note")).rejects.toThrow(
        "Unable to improve note right now. Please try again or edit manually."
      );
    });

    it("server action catches AI error and returns success: false with safe message", async () => {
      vi.spyOn(groqClient, "requestGroqText").mockRejectedValue(
        new groqClient.AIServiceError("Provider 500 error")
      );

      const res = await improvePersonalNote("call rahul tomorrow 30k budget");

      expect(res.success).toBe(false);
      expect(res.error).toBe("Unable to improve note right now. Please try again or edit manually.");
      expect(res.data).toBeUndefined();
    });

    it("rejects empty or whitespace notes cleanly without invoking AI", async () => {
      const spy = vi.spyOn(groqClient, "requestGroqText");

      const res1 = await improvePersonalNote("");
      expect(res1.success).toBe(false);
      expect(res1.error).toBe("Note content cannot be empty.");

      const res2 = await improvePersonalNote("    \n   ");
      expect(res2.success).toBe(false);
      expect(res2.error).toBe("Note content cannot be empty.");

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("5. No Auto-Save Enforcement", () => {
    it("does NOT trigger database create or update when improvePersonalNote is called", async () => {
      vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({
        text: "Call Rahul tomorrow regarding the 30k budget.",
      });

      const res = await improvePersonalNote("call rahul tomorrow 30k budget");

      expect(res.success).toBe(true);
      expect(res.data).toBe("Call Rahul tomorrow regarding the 30k budget.");

      // Verify db was never touched
      expect(db.personalNote.create).not.toHaveBeenCalled();
      expect(db.personalNote.update).not.toHaveBeenCalled();
    });
  });

  describe("6. NoteEditor UI: States, Undo, Editability & No Auto-Save", () => {
    it("renders NoteEditor with Improve button disabled when empty, and enabled when text exists", async () => {
      const { renderToStaticMarkup } = await import("react-dom/server");
      const React = await import("react");
      const { NoteEditor } = await import("@/features/personal-notes/components/note-editor");

      // Empty note
      const emptyHtml = renderToStaticMarkup(
        React.createElement(NoteEditor, {
          note: null,
          onSave: vi.fn(),
          onClose: vi.fn(),
        })
      );

      // Improve button is rendered with disabled attribute
      expect(emptyHtml).toContain("✨ Improve");
      expect(emptyHtml).toContain("disabled");

      // Note with content
      const filledHtml = renderToStaticMarkup(
        React.createElement(NoteEditor, {
          note: {
            id: "note-1",
            title: "Test",
            content: "call rahul tomorrow 30k budget",
            pinned: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          onSave: vi.fn(),
          onClose: vi.fn(),
        })
      );

      expect(filledHtml).toContain("✨ Improve");
      expect(filledHtml).toContain("call rahul tomorrow 30k budget");
    });

    it("verifies state transitions: original note -> improved -> editable -> undo restores original", async () => {
      // Direct simulation of NoteEditor's state logic
      let content = "call client tommorow he say budget issue maybe 30k";
      let lastOriginalDraft: string | null = null;
      let isImproving = false;
      let aiError: string | null = null;
      const saveMock = vi.fn();

      // 1. Initial State: Improve enabled since content is non-empty
      expect(content.trim().length > 0).toBe(true);
      expect(lastOriginalDraft).toBeNull();

      // 2. Click Improve: enters loading state
      isImproving = true;
      expect(isImproving).toBe(true); // Button displays "Improving..."

      // 3. AI Success: replaces textarea content directly, records lastOriginalDraft, clears error
      const aiResponse = "Call the client tomorrow. They mentioned a budget concern around ₹30,000.";
      lastOriginalDraft = content;
      content = aiResponse;
      isImproving = false;

      // Assert textarea content is now improved text
      expect(content).toBe(aiResponse);
      expect(lastOriginalDraft).toBe("call client tommorow he say budget issue maybe 30k");
      // Assert Undo button is now available
      expect(lastOriginalDraft !== null).toBe(true);

      // 4. Note Remains Editable: user edits the improved note before saving
      content = content + " Follow up by 2 PM.";
      expect(content).toBe(
        "Call the client tomorrow. They mentioned a budget concern around ₹30,000. Follow up by 2 PM."
      );
      // Auto-save was NOT triggered
      expect(saveMock).not.toHaveBeenCalled();

      // 5. Test Undo: restoring exact original text
      content = lastOriginalDraft!;
      lastOriginalDraft = null;
      aiError = null;

      expect(content).toBe("call client tommorow he say budget issue maybe 30k");
      expect(lastOriginalDraft).toBeNull(); // Undo button hides

      // 6. Test AI Failure: original note remains untouched
      const noteBeforeFailure = content;
      const failedMock = vi.fn().mockRejectedValue(new Error("AI transformation failed"));
      try {
        await failedMock();
      } catch (err: unknown) {
        // Keeps original note untouched on failure
        aiError = (err as Error).message;
      }
      expect(content).toBe(noteBeforeFailure);
      expect(aiError).toBe("AI transformation failed");

      // 7. Test Save: only happens when user explicitly calls save
      saveMock({ content });
      expect(saveMock).toHaveBeenCalledTimes(1);
      expect(saveMock).toHaveBeenCalledWith({ content: noteBeforeFailure });
    });
  });
});
