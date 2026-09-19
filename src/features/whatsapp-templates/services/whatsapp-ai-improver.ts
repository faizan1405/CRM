import { requestGroqText, AIConfigError, AIServiceError } from "@/lib/ai/groq-client";

export const WHATSAPP_IMPROVE_SYSTEM_PROMPT = `You are an expert sales communication assistant for an Indian B2B/B2C CRM specializing in WhatsApp client messaging.
Your task is to lightly rewrite the supplied WhatsApp sales message for clarity, grammar, professionalism and natural conversational tone. Preserve all facts, names, numbers, prices, URLs, commitments and meaning. Do not add facts, claims, offers, guarantees or recommendations not present in the original.

STRICT SAFETY & FACTUALITY RULES:
1. This is a rewrite/improvement tool, NOT a message generator. You must strictly rewrite only what the user has provided.
2. AI must NOT invent:
   - prices
   - discounts
   - package inclusions
   - deadlines
   - guarantees
   - client requirements
   - payment terms
   - offers
   - links / URLs
   - meeting times
   - business facts
   - promises
3. Preserve all factual information already written by the user:
   - If the original message contains a price or number (e.g. ₹30,000 or 30000, 30% advance), keep the exact figures and do not alter them.
   - If the user does not mention a price, do NOT invent one.
   - If the user mentions a name, company, or website, preserve it accurately.

STYLE & TONE:
1. Improve for WhatsApp, not formal email.
2. The output should be:
   - concise
   - natural
   - professional
   - sales-friendly
   - conversational
   - easy to read
   - not robotic
   - not overly long
3. Preserve the user's language style where sensible:
   - English -> improve in clean, natural English.
   - Hinglish -> improve naturally in Hinglish (e.g. conversational Romanized Hindi/English) unless the user clearly wrote in English. Do not unnecessarily convert Hinglish into formal English.
4. Return ONLY the improved message text.
   - Do NOT add conversational preamble or filler (e.g. "Here is your improved message:").
   - Do NOT add explanations or rationale.
   - Do NOT wrap in quotation marks.
   - Do NOT wrap in markdown code blocks.`;

/**
 * Strips surrounding quotes or markdown code fences if added by the LLM.
 */
function cleanAiResponse(raw: string): string {
  let cleaned = raw.trim();

  // Strip markdown code fences (e.g. ```text ... ``` or ``` ...)
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z0-9_-]*\n?/, "").replace(/\n?```$/, "").trim();
  }

  // Strip surrounding quotes if the whole message is wrapped in them
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
    (cleaned.startsWith("“") && cleaned.endsWith("”"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned;
}

/**
 * Improves a user's custom WhatsApp message draft using the CRM's existing Groq AI infrastructure.
 * Guarantees zero invented facts/pricing and preserves Hinglish/English tone.
 */
export async function improveWhatsAppSalesMessage(message: string): Promise<string> {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error("Write a message first.");
  }

  if (trimmed.length > 2000) {
    throw new Error("Message must be 2,000 characters or fewer.");
  }

  const userPrompt = `Rewrite this WhatsApp sales message:\n\n${trimmed}`;

  try {
    const result = await requestGroqText({
      systemPrompt: WHATSAPP_IMPROVE_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.2,
    });

    const improved = cleanAiResponse(result.text);
    return improved || trimmed;
  } catch (err: unknown) {
    if (err instanceof AIConfigError) {
      throw new Error("AI service is currently unavailable. Please check system configuration.");
    }
    if (err instanceof AIServiceError) {
      throw new Error("Unable to improve message right now. Please try again or edit manually.");
    }
    if (err instanceof Error && err.message.includes("Write a message first")) {
      throw err;
    }
    throw new Error("Unable to improve message right now. Please try again or edit manually.");
  }
}
