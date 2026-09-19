import { describe, it, expect, vi, beforeEach } from "vitest";
import * as groqClient from "@/lib/ai/groq-client";
import {
  improveWhatsAppSalesMessage,
  WHATSAPP_IMPROVE_SYSTEM_PROMPT,
} from "@/features/whatsapp-templates/services/whatsapp-ai-improver";
import { improveWhatsAppMessage } from "@/app/actions/whatsapp-templates";
import { getSession } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

describe("WhatsApp Custom Message AI Improve Feature", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      id: "test-user-id",
      email: "agent@example.com",
      role: "ADMIN",
    });
  });

  describe("1. Existing AI Infrastructure Reuse & System Prompt", () => {
    it("reuses requestGroqText from groq-client with temperature 0.2", async () => {
      const spy = vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({
        text: "Hi sir, sharing the website sample we discussed. Were you able to check it?",
      });

      const result = await improveWhatsAppSalesMessage(
        "hello sir website ka sample bheja tha apne dekha kya"
      );

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: WHATSAPP_IMPROVE_SYSTEM_PROMPT,
          temperature: 0.2,
        })
      );
      expect(result).toBe("Hi sir, sharing the website sample we discussed. Were you able to check it?");
    });

    it("includes strict safety, fact preservation, and Hinglish preservation rules in prompt", () => {
      // Must not invent facts, prices, discounts, deadlines, etc.
      expect(WHATSAPP_IMPROVE_SYSTEM_PROMPT).toContain("Do not add facts, claims, offers, guarantees or recommendations");
      expect(WHATSAPP_IMPROVE_SYSTEM_PROMPT).toContain("prices");
      expect(WHATSAPP_IMPROVE_SYSTEM_PROMPT).toContain("discounts");
      expect(WHATSAPP_IMPROVE_SYSTEM_PROMPT).toContain("package inclusions");
      expect(WHATSAPP_IMPROVE_SYSTEM_PROMPT).toContain("deadlines");
      expect(WHATSAPP_IMPROVE_SYSTEM_PROMPT).toContain("Hinglish");
      expect(WHATSAPP_IMPROVE_SYSTEM_PROMPT).toContain("Return ONLY the improved message text");
    });
  });

  describe("2. Fact & Price Preservation", () => {
    it("preserves price and advance percentages without alteration", async () => {
      const input = "Sir package 30000 ka hai and 30 percent advance rahega";
      const expectedOutput = "Sir, package ₹30,000 ka hai aur 30% advance payment rahegi. Let me know how you'd like to proceed.";

      vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({
        text: expectedOutput,
      });

      const result = await improveWhatsAppSalesMessage(input);

      // Verify numbers remain unaltered
      expect(result).toContain("30,000");
      expect(result).toContain("30%");
    });

    it("strips wrapping quotes and markdown code blocks returned by AI", async () => {
      vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({
        text: '```\n"Hi sir, I shared the website sample with you earlier. Did you get a chance to review it?"\n```',
      });

      const result = await improveWhatsAppSalesMessage("hello sir website sample bheja tha");
      expect(result).toBe("Hi sir, I shared the website sample with you earlier. Did you get a chance to review it?");
      expect(result.startsWith('"')).toBe(false);
      expect(result.endsWith('"')).toBe(false);
      expect(result.includes("```")).toBe(false);
    });
  });

  describe("3. Hinglish & Language Style Preservation", () => {
    it("improves natural Hinglish while preserving intent and meaning", async () => {
      const input = "hello sir maine website sample bheja tha dekha kya";
      const improvedHinglish = "Hello sir, maine website sample share kiya tha. Kya aapne check karne ka time mila?";

      vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({
        text: improvedHinglish,
      });

      const result = await improveWhatsAppSalesMessage(input);
      expect(result).toBe(improvedHinglish);
      expect(result.toLowerCase()).toContain("sample");
    });
  });

  describe("4. Empty Input Handling", () => {
    it("throws a clean error on empty or whitespace message in service", async () => {
      await expect(improveWhatsAppSalesMessage("")).rejects.toThrow("Write a message first.");
      await expect(improveWhatsAppSalesMessage("   ")).rejects.toThrow("Write a message first.");
    });

    it("returns error cleanly in server action without invoking AI", async () => {
      const spy = vi.spyOn(groqClient, "requestGroqText");

      const res1 = await improveWhatsAppMessage("");
      expect(res1.success).toBe(false);
      expect(res1.error).toBe("Write a message first.");

      const res2 = await improveWhatsAppMessage("   \n\t  ");
      expect(res2.success).toBe(false);
      expect(res2.error).toBe("Write a message first.");

      expect(spy).not.toHaveBeenCalled();
    });

    it("enforces sensible maximum character length limit", async () => {
      const longText = "a".repeat(2001);
      const res = await improveWhatsAppMessage(longText);
      expect(res.success).toBe(false);
      expect(res.error).toContain("2,000 characters or fewer");
    });
  });

  describe("5. AI Failure Preserves Original & Friendly Error", () => {
    it("catches AI service error and returns user-friendly error without leaking internals", async () => {
      vi.spyOn(groqClient, "requestGroqText").mockRejectedValue(
        new groqClient.AIServiceError("Internal provider 500 error")
      );

      const res = await improveWhatsAppMessage("hello sir need to discuss website");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Unable to improve message right now. Please try again or edit manually.");
      // Ensure provider internals or stack traces are NOT leaked
      expect(res.error).not.toContain("500");
      expect(res.error).not.toContain("Internal provider");
    });

    it("catches AI configuration error gracefully", async () => {
      vi.spyOn(groqClient, "requestGroqText").mockRejectedValue(
        new groqClient.AIConfigError("Groq API key is not configured.")
      );

      const res = await improveWhatsAppMessage("hello sir need to discuss website");
      expect(res.success).toBe(false);
      expect(res.error).toBe("AI service is currently unavailable. Please check system configuration.");
    });
  });

  describe("6. Server Action improveWhatsAppMessage", () => {
    it("returns success and improvedMessage on valid input", async () => {
      vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({
        text: "Hi sir, following up on our previous discussion regarding the website package.",
      });

      const res = await improveWhatsAppMessage("sir website package ka follow up kar raha tha");
      expect(res.success).toBe(true);
      expect(res.improvedMessage).toBe("Hi sir, following up on our previous discussion regarding the website package.");
      expect(res.data?.improvedMessage).toBe(res.improvedMessage);
    });

    it("accepts object parameter format { message }", async () => {
      vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({
        text: "Hi sir, here is the updated proposal.",
      });

      const res = await improveWhatsAppMessage({ message: "sir updated proposal ye raha" });
      expect(res.success).toBe(true);
      expect(res.improvedMessage).toBe("Hi sir, here is the updated proposal.");
    });

    it("requires authenticated session", async () => {
      vi.mocked(getSession).mockResolvedValueOnce(null);

      const res = await improveWhatsAppMessage("hello");
      expect(res.success).toBe(false);
      expect(res.error).toContain("signed in");
    });
  });

  describe("7. WhatsAppTemplatePicker Component Rendering", () => {
    it("renders Custom Message workflow with Open WhatsApp and editable controls", async () => {
      const { renderToStaticMarkup } = await import("react-dom/server");
      const React = await import("react");
      const { WhatsAppTemplatePicker } = await import("@/components/whatsapp-template-picker");

      const html = renderToStaticMarkup(
        React.createElement(WhatsAppTemplatePicker, {
          isOpen: true,
          lead: { id: "test-lead", name: "Rohan", phone: "9876543210" },
          onClose: () => {},
        })
      );

      expect(html).toContain("Send WhatsApp");
      expect(html).toContain("Custom Message");
      expect(html).toContain("Open WhatsApp");
    });
  });
});
