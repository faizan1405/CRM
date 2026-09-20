"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActivityType, Prisma } from "@prisma/client";
import {
  parseRawCallNotes,
  formatStructuredNoteToReadableText,
} from "@/features/ai-conversation-notes/services/notes-parser";
import { suggestNextFollowUp } from "@/features/followups/services/followup-suggester";
import { markLeadAIInsightNeedsRefresh } from "@/features/ai-attention/services/attention-engine";
import type {
  StructuredCallNotesData,
  ApplyCallNotesInput,
  SuggestedFollowUpResult,
  CallNotesActionResult,
} from "@/features/ai-conversation-notes/types";
import { requestGroqText } from "@/lib/ai/groq-client";

class UserFacingError extends Error {}

async function requireAuthenticatedUser() {
  const session = await getSession();
  if (!session || typeof session.id !== "string") {
    throw new UserFacingError("You must be signed in to manage conversation notes.");
  }
  return session;
}

function cleanError(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred while processing conversation notes.";
}

/**
 * Parses raw shorthand sales notes into structured facts.
 * AI structuring does NOT automatically save to the database.
 */
export async function structureCallNotes(
  rawNote: string,
  leadId?: string
): Promise<CallNotesActionResult<StructuredCallNotesData>> {
  try {
    await requireAuthenticatedUser();

    let leadContext: { name?: string; business?: string; requirement?: string; status?: string } | undefined;
    if (leadId) {
      const lead = await db.lead.findUnique({
        where: { id: leadId },
        select: { name: true, business: true, notes: true, status: true },
      });
      if (lead) {
        leadContext = {
          name: lead.name,
          business: lead.business || undefined,
          requirement: lead.notes || undefined,
          status: lead.status,
        };
      }
    }

    const structured = await parseRawCallNotes(rawNote, leadContext);
    return { success: true, data: structured };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Applies reviewed and confirmed call notes to the existing Phase 5 Lead Activity system.
 * Creates an activity record of type NOTE_ADDED.
 * Does not create a duplicate notes database.
 */
export async function applyCallNotes(
  input: ApplyCallNotesInput
): Promise<CallNotesActionResult<{ activityId: string; message: string }>> {
  try {
    const session = await requireAuthenticatedUser();

    const lead = await db.lead.findUnique({ where: { id: input.leadId } });
    if (!lead) throw new UserFacingError("Lead not found.");

    let messageToSave = input.formattedNote?.trim();
    if (!messageToSave) {
      if (input.structuredData) {
        messageToSave = formatStructuredNoteToReadableText({
          rawNote: input.rawNote,
          requirement: input.structuredData.requirement || null,
          budget: input.structuredData.budget || null,
          interestLevel: input.structuredData.interestLevel || "UNKNOWN",
          decisionFactor: input.structuredData.decisionFactor || null,
          objections: input.structuredData.objections || null,
          importantDetails: input.structuredData.importantDetails || null,
          nextAction: input.structuredData.nextAction || null,
          suggestedFollowUpDate: input.structuredData.suggestedFollowUpDate || null,
          suggestedFollowUpTime: input.structuredData.suggestedFollowUpTime || null,
          tags: input.structuredData.tags || [],
        });
      } else {
        messageToSave = input.rawNote.trim();
      }
    }

    if (!messageToSave) {
      throw new UserFacingError("Note message cannot be empty.");
    }

    const result = await db.$transaction(async (tx) => {
      // 1. Create standard NOTE_ADDED activity
      const activity = await tx.leadActivity.create({
        data: {
          leadId: input.leadId,
          type: ActivityType.NOTE_ADDED,
          message: messageToSave,
          metadata: {
            rawNote: input.rawNote,
            structuredData: (input.structuredData || {}) as Prisma.InputJsonValue,
            appliedType: input.appliedType || "structured",
            source: "ai_conversation_notes",
          },
          createdByUserId: session.id as string,
        },
      });

      // 2. Optionally update lead fields if lead is missing budget or notes
      const updates: { notes?: string; budget?: Prisma.Decimal } = {};
      if (!lead.notes && input.structuredData?.requirement) {
        updates.notes = input.structuredData.requirement;
      }
      if (!lead.budget && input.structuredData?.budget) {
        const num = Number(input.structuredData.budget.replace(/[^0-9.]/g, ""));
        if (!isNaN(num) && num > 0 && num <= 9_999_999_999) {
          updates.budget = new Prisma.Decimal(num);
        }
      }

      if (Object.keys(updates).length > 0) {
        await tx.lead.update({
          where: { id: input.leadId },
          data: updates,
        });
      }

      // 3. Mark AI insight needs refresh
      await markLeadAIInsightNeedsRefresh(input.leadId, tx);

      return activity;
    });

    try {
      revalidatePath("/leads");
      revalidatePath("/dashboard");
      revalidatePath("/pipeline");
      revalidatePath("/follow-ups");
    } catch {
      // safe in tests
    }

    return {
      success: true,
      data: {
        activityId: result.id,
        message: result.message,
      },
    };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Returns follow-up suggestions for a lead using status, activities, and AI insights.
 * Server calculation only; does NOT create follow-ups automatically.
 */
export async function getSuggestedFollowUp(
  leadId: string
): Promise<CallNotesActionResult<SuggestedFollowUpResult>> {
  try {
    await requireAuthenticatedUser();
    const result = await suggestNextFollowUp(leadId);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export const LEAD_NOTE_IMPROVE_SYSTEM_PROMPT = `You are an expert CRM assistant that structures raw lead notes.
Your task is to rewrite the user's raw note into clear, structured, numbered points.

STRICT FORMAT RULES:
- Output MUST strictly be a numbered list:
1. ...
2. ...
3. ...
- Each meaningful idea, requirement, objection, or update must be its own separate numbered point.
- If there is only one meaningful fact, output a single numbered point (e.g. "1. Client requested a follow-up tomorrow.").
- Do NOT return a single continuous paragraph.
- Do NOT return one giant sentence.
- Do NOT include any titles, markdown headings, or section labels (e.g. no "Notes:", "Summary:", "Key Points:").
- Do NOT include any introductory or concluding conversational filler (e.g. no "Here is the improved note:", no "Let me know if you need anything else.").
- Return ONLY the numbered points, starting directly with "1. ".

FACTUAL SAFETY & INTEGRITY:
- ONLY improve structure, grammar, and clarity.
- You must NOT invent, extrapolate, or assume ANY:
  - client requirements
  - pricing or budget
  - dates, days, or deadlines
  - follow-up commitments
  - names or company details
  - business information
  - objections
  - recommendations, sales strategies, or next steps
  - promises or guarantees
- Strictly preserve all facts, dates, times, names, URLs, product/package names, and constraints mentioned by the user.
- Strictly preserve amounts and numerical values (e.g. if the input states "30k" budget in INR context, write ₹30,000; if currency like ₹ or $ is mentioned, preserve it; never invent or change numerical amounts).

LANGUAGE PRESERVATION:
- Always preserve the input language:
  - English input -> English output.
  - Hinglish input -> natural Hinglish output.
  - Hindi input -> Hindi output.
- Do NOT automatically translate between languages.`;

export function formatNumberedPoints(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);

  // Find where numbered list begins if there's any intro header
  const firstNumberedIndex = lines.findIndex((l) => /^(\*\*)?(\d+)[\.\)](\*\*)?\s/.test(l));

  const relevantLines = firstNumberedIndex !== -1 ? lines.slice(firstNumberedIndex) : lines;

  const hasNumbers = relevantLines.some((l) => /^(\*\*)?(\d+)[\.\)](\*\*)?\s/.test(l));
  if (!hasNumbers) {
    return relevantLines.map((line, idx) => `${idx + 1}. ${line.replace(/^[-*•]\s*/, "")}`).join("\n");
  }

  let count = 1;
  const formatted: string[] = [];
  for (const line of relevantLines) {
    const match = line.match(/^(\*\*)?(\d+)[\.\)](\*\*)?\s*(.*)$/);
    if (match) {
      formatted.push(`${count}. ${match[4].trim()}`);
      count++;
    } else {
      const cleaned = line.replace(/^[-*•]\s*/, "");
      if (formatted.length > 0) {
        formatted[formatted.length - 1] += ` ${cleaned}`;
      } else {
        formatted.push(`${count}. ${cleaned}`);
        count++;
      }
    }
  }

  return formatted.join("\n");
}

/**
 * Rewrites raw lead note into clear structured numbered points.
 * Preserves facts, amounts, and input language without inventing information.
 */
export async function improveNoteText(rawNote: string): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    await requireAuthenticatedUser();
    if (!rawNote || !rawNote.trim()) return { success: true, data: rawNote };

    const { text } = await requestGroqText({
      systemPrompt: LEAD_NOTE_IMPROVE_SYSTEM_PROMPT,
      userPrompt: rawNote.trim(),
      temperature: 0.1,
    });

    const cleaned = formatNumberedPoints(text);
    return { success: true, data: cleaned };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

