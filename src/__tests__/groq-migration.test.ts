import { describe, it, expect, vi, beforeEach } from "vitest";
import { AI_CONFIG } from "@/lib/ai/config";
import * as groqClient from "@/lib/ai/groq-client";
import { parseUnstructuredLeadText } from "@/features/leads/ai-parser/lead-parser";
import { parseRawCallNotes } from "@/features/ai-conversation-notes/services/notes-parser";
import {
  cleanPersonalNote,
  organizePersonalNote,
  rewritePersonalNoteClearly,
  summarizePersonalNote,
} from "@/features/personal-notes/services/notes-ai-transformer";
import { GroqLeadScoreSchema } from "@/features/ai-attention/services/scoring-rubric";
import { z } from "zod";

describe("Groq Model Migration to openai/gpt-oss-120b", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Centralized GROQ_MODEL Configuration", () => {
    it("defaults to openai/gpt-oss-120b when GROQ_MODEL is not set", () => {
      const origEnv = process.env.GROQ_MODEL;
      delete process.env.GROQ_MODEL;

      expect(AI_CONFIG.model).toBe("openai/gpt-oss-120b");

      if (origEnv !== undefined) {
        process.env.GROQ_MODEL = origEnv;
      }
    });

    it("uses trimmed GROQ_MODEL environment variable when set", () => {
      const origEnv = process.env.GROQ_MODEL;
      process.env.GROQ_MODEL = "  openai/gpt-oss-120b  ";

      expect(AI_CONFIG.model).toBe("openai/gpt-oss-120b");

      if (origEnv !== undefined) {
        process.env.GROQ_MODEL = origEnv;
      } else {
        delete process.env.GROQ_MODEL;
      }
    });

    it("handles custom model override via GROQ_MODEL env var", () => {
      const origEnv = process.env.GROQ_MODEL;
      process.env.GROQ_MODEL = "custom-groq-model-123";

      expect(AI_CONFIG.model).toBe("custom-groq-model-123");

      if (origEnv !== undefined) {
        process.env.GROQ_MODEL = origEnv;
      } else {
        delete process.env.GROQ_MODEL;
      }
    });
  });

  describe("2. Minimal Completion & Model Parameter Verification", () => {
    it("passes openai/gpt-oss-120b model to groq chat completions create", async () => {
      const origApiKey = process.env.GROQ_API_KEY;
      process.env.GROQ_API_KEY = "gsk_test_mock_migration_key";

      try {
        let passedModel: string | undefined;

        const groq = groqClient.getGroqClient();
        vi.spyOn(groq.chat.completions, "create").mockImplementation((async (params: unknown) => {
          const createParams = params as { model: string };
          passedModel = createParams.model;
          return {
            choices: [
              {
                message: {
                  content: "pong",
                },
              },
            ],
          };
        }) as never);

        const result = await groqClient.requestGroqText({
          systemPrompt: "You are a test ping responder.",
          userPrompt: "ping",
        });

        expect(result.text).toBe("pong");
        expect(passedModel).toBe("openai/gpt-oss-120b");
      } finally {
        if (origApiKey !== undefined) {
          process.env.GROQ_API_KEY = origApiKey;
        } else {
          delete process.env.GROQ_API_KEY;
        }
      }
    });
  });

  describe("3. AI Lead Entry & Structured JSON Zod Parsing", () => {
    it("extracts structured lead data matching GroqLeadExtractionSchema", async () => {
      const sampleJsonResponse = JSON.stringify({
        name: "Vikram Malhotra",
        phone: "+919876543210",
        email: "vikram@malhotralogistics.in",
        business: "Malhotra Logistics",
        industryOrRequirement: "Fleet tracking and inventory CRM",
        budget: 50000,
        status: "Qualified",
        notes: "Needs deployment by next month",
        suggestedFollowUpDate: "2026-09-20",
        suggestedFollowUpTime: "15:00",
        confidence: {
          name: "high",
          phone: "high",
          email: "high",
          business: "high",
          industryOrRequirement: "high",
          budget: "high",
          status: "high",
          notes: "high",
          suggestedFollowUpDate: "high",
          suggestedFollowUpTime: "high",
        },
      });

      vi.spyOn(groqClient, "requestGroqJson").mockResolvedValue({
        rawJson: sampleJsonResponse,
      });

      const parsed = await parseUnstructuredLeadText(
        "Vikram Malhotra from Malhotra Logistics, phone 9876543210, email vikram@malhotralogistics.in, needs fleet tracking CRM for 50k budget."
      );

      expect(parsed.name).toBe("Vikram Malhotra");
      expect(parsed.phone).toBe("+91 98765 43210");
      expect(parsed.business).toBe("Malhotra Logistics");
      expect(parsed.budget).toBe(50000);
      expect(parsed.status).toBe("Qualified");
    });
  });

  describe("4. AI Attention Scoring Schema Validation", () => {
    it("validates attention score output against GroqLeadScoreSchema", () => {
      const attentionOutput = {
        score: 85,
        priority: "CRITICAL",
        scoreReason: "High deal value with urgent timeline and upcoming demo scheduled",
        recommendedAction: "Call client to confirm demo agenda and stakeholders",
        recommendedActionType: "CALL",
        factorBreakdown: {
          engagementSignal: "High interaction frequency",
          budgetSignal: "Above average ticket size",
          stageSignal: "Moved stages rapidly",
        },
      };

      const validated = GroqLeadScoreSchema.parse(attentionOutput);
      expect(validated.score).toBe(85);
      expect(validated.priority).toBe("CRITICAL");
      expect(validated.recommendedActionType).toBe("CALL");
    });
  });

  describe("5. AI Call Notes Parsing Schema Validation", () => {
    it("extracts structured conversation notes using RawGroqNotesSchema", async () => {
      const rawNotesResponse = JSON.stringify({
        requirement: "Custom E-commerce mobile app and payment gateway",
        budget: "₹1,50,000",
        interestLevel: "HIGH",
        decisionFactor: "Delivery timeline before Diwali",
        objections: "Concerned about maintenance costs",
        importantDetails: "2 co-founders involved in final decision",
        nextAction: "Send proposal with milestone pricing",
        suggestedFollowUpDate: "2026-09-18",
        suggestedFollowUpTime: "11:00",
        tags: ["High Intent", "E-commerce", "Timeline Critical"],
      });

      vi.spyOn(groqClient, "requestGroqJson").mockResolvedValue({
        rawJson: rawNotesResponse,
      });

      const structured = await parseRawCallNotes(
        "Spoke with Amit. High interest in custom ecommerce app. Budget 1.5L. Wants before Diwali. Send proposal by Friday 11am."
      );

      expect(structured.requirement).toBe("Custom E-commerce mobile app and payment gateway");
      expect(structured.budget).toBe("₹1,50,000");
      expect(structured.interestLevel).toBe("HIGH");
      expect(structured.tags).toContain("High Intent");
      expect(structured.suggestedFollowUpDate).toBe("2026-09-18");
    });
  });

  describe("6. WhatsApp AI Personalization Schema", () => {
    it("validates WhatsApp AI personalization structured output", () => {
      const AIPersonalizeResponseSchema = z.object({
        personalizedMessage: z.string().min(1),
        rationale: z.string().optional(),
      });

      const sampleOutput = {
        personalizedMessage:
          "Hi Vikram, following up regarding the fleet management software for Malhotra Logistics. Would you like to connect this Friday at 3 PM?",
        rationale: "Added recipient name, business reference, and scheduled follow-up time.",
      };

      const validated = AIPersonalizeResponseSchema.parse(sampleOutput);
      expect(validated.personalizedMessage).toContain("Malhotra Logistics");
      expect(validated.rationale).toBeDefined();
    });
  });

  describe("7. Personal Notes AI Transformations", () => {
    it("executes Personal Notes Clean Up", async () => {
      vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({
        text: "Client requested a quote for the premium plan.",
      });

      const cleaned = await cleanPersonalNote("clnt reqst quote for prem plan");
      expect(cleaned).toBe("Client requested a quote for the premium plan.");
    });

    it("executes Personal Notes Organize", async () => {
      vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({
        text: "### Summary\n- Budget: ₹50k\n### Action Items\n- Call client on Monday",
      });

      const organized = await organizePersonalNote("budget 50k call on monday");
      expect(organized).toContain("### Summary");
      expect(organized).toContain("Action Items");
    });

    it("executes Personal Notes Rewrite Clearly", async () => {
      vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({
        text: "The client confirmed interest in scheduling a technical walkthrough tomorrow.",
      });

      const rewritten = await rewritePersonalNoteClearly("talked tmrw demo confirmed");
      expect(rewritten).toContain("technical walkthrough");
    });

    it("executes Personal Notes Summarize", async () => {
      vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({
        text: "Key Takeaway: Partnership approved at ₹2,00,000 pending contract sign-off.",
      });

      const summarized = await summarizePersonalNote("long meeting notes with approved deal at 2L pending sign");
      expect(summarized).toContain("Key Takeaway");
      expect(summarized).toContain("₹2,00,000");
    });
  });
});
