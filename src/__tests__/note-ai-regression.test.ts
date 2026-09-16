import { describe, it, expect, vi } from "vitest";
import { improveNoteText } from "@/app/actions/conversation-notes";
import * as groqClient from "@/lib/ai/groq-client";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn().mockResolvedValue({ id: "test-user-id" }),
  requireAuthenticatedUser: vi.fn().mockResolvedValue({ id: "test-user-id" }),
}));

describe("Note AI Regression Tests", () => {
  it("Light Improvement Only: Strict prompt prevents adding information", async () => {
    const input = "client call tomorrow";
    
    const requestSpy = vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({ text: "Client to call tomorrow." });

    const result = await improveNoteText(input);

    expect(result.success).toBe(true);
    expect(requestSpy).toHaveBeenCalled();
    const args = requestSpy.mock.calls[0][0];
    
    // Assert the strict prompt is being used to prevent invented information
    expect(args.systemPrompt).toContain("You are a light note editor");
    expect(args.systemPrompt).toContain("Do not add facts, assumptions, recommendations, categories, questions, follow-ups, sales advice, statuses, requirements, or missing information");
    expect(args.systemPrompt).toContain("Preserve the meaning exactly");
    expect(args.userPrompt).toBe(input);
    expect(args.temperature).toBe(0.1); // Deterministic
  });

  it("Does not invent facts for sparse input", async () => {
    const input = "need ecommerce website";
    const requestSpy = vi.spyOn(groqClient, "requestGroqText").mockResolvedValue({ text: "Needs an ecommerce website." });

    const result = await improveNoteText(input);
    expect(result.success).toBe(true);
    const args = requestSpy.mock.calls[0][0];
    
    expect(args.systemPrompt).not.toContain("extract");
    expect(args.systemPrompt).toContain("Do not add facts");
  });
});
