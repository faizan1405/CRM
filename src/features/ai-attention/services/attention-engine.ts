import { db } from "@/lib/db";
import { requestGroqJson } from "@/lib/ai/groq-client";
import { calculateLeadFacts } from "./lead-facts";
import {
  GroqLeadScoreSchema,
  SCORING_SYSTEM_PROMPT,
  buildScoringUserPrompt,
  type GroqLeadScoreOutput,
} from "./scoring-rubric";
import type { CalculatedLeadFacts } from "../types";
import { AIPriority, AIActionType, Prisma, type LeadAIInsight } from "@prisma/client";

/**
 * Enforces deterministic business and safety rules on top of the raw AI output.
 * Never allows downgrading an objectively critical situation.
 */
export function applyDeterministicSafetyRules(
  aiOutput: GroqLeadScoreOutput,
  facts: CalculatedLeadFacts
): GroqLeadScoreOutput {
  // 1. Clamp score strictly 0-100
  let score = Math.min(100, Math.max(0, Math.round(aiOutput.score)));
  let priority = aiOutput.priority;
  let recommendedAction = aiOutput.recommendedAction;
  let recommendedActionType = aiOutput.recommendedActionType || "CALL";
  let scoreReason = aiOutput.scoreReason;

  const isTerminal = facts.status === "WON" || facts.status === "LOST";

  if (isTerminal) {
    // Closed leads are terminal - priority is always NORMAL
    priority = "NORMAL";
    if (facts.status === "WON") {
      score = Math.max(90, score);
      recommendedAction = "Deal won. Proceed with onboarding or fulfillment.";
      recommendedActionType = "OTHER";
    } else {
      score = Math.min(20, score);
      recommendedAction = "Deal lost. Archive or add to long-term nurturing.";
      recommendedActionType = "OTHER";
    }
    return {
      score,
      priority,
      scoreReason,
      recommendedAction,
      recommendedActionType,
      factorBreakdown: aiOutput.factorBreakdown,
    };
  }

  // 2. Deterministic Priority Upgrades for Active Leads:
  // Rule A: Any overdue follow-up is objectively CRITICAL
  if (facts.hasOverdueFollowUp) {
    if (priority !== "CRITICAL") {
      priority = "CRITICAL";
      if (!scoreReason.toLowerCase().includes("overdue")) {
        scoreReason = `${scoreReason} (Priority upgraded to Critical: Follow-up is overdue by ${facts.overdueHours}h).`;
      }
    }
    if (!recommendedAction.toLowerCase().includes("overdue") && !recommendedAction.toLowerCase().includes("call")) {
      recommendedAction = `Follow-up overdue by ${facts.overdueHours}h — Contact immediately`;
      recommendedActionType = "CALL";
    }
  }

  // Rule B: High-value or Hot opportunity becoming stale is CRITICAL
  if ((score >= 80 || (facts.budget && facts.budget >= 50000)) && facts.isStale) {
    if (priority !== "CRITICAL") {
      priority = "CRITICAL";
      if (!scoreReason.toLowerCase().includes("stale")) {
        scoreReason = `${scoreReason} (Priority upgraded to Critical: High-value lead is becoming stale).`;
      }
    }
  }

  // Rule C: Proposal Sent leads without a future follow-up must be at least IMPORTANT
  if (facts.status === "PROPOSAL_SENT" && priority === "NORMAL") {
    priority = "IMPORTANT";
    if (!scoreReason.toLowerCase().includes("proposal")) {
      scoreReason = `${scoreReason} (Priority set to Important: Awaiting proposal response).`;
    }
  }

  return {
    score,
    priority,
    scoreReason,
    recommendedAction,
    recommendedActionType,
    factorBreakdown: aiOutput.factorBreakdown,
  };
}

/**
 * Pure deterministic fallback scoring in case Groq is temporarily unavailable
 * or API key is not configured.
 */
export function deriveFallbackInsight(facts: CalculatedLeadFacts): GroqLeadScoreOutput {
  const isTerminal = facts.status === "WON" || facts.status === "LOST";

  if (isTerminal) {
    return {
      score: facts.status === "WON" ? 95 : 15,
      priority: "NORMAL",
      scoreReason: facts.status === "WON" ? "Lead successfully closed and won." : "Lead marked as lost.",
      recommendedAction: facts.status === "WON" ? "Prepare customer onboarding." : "Archive lead.",
      recommendedActionType: "OTHER",
    };
  }

  let baseScore = 45;
  if (facts.budget && facts.budget >= 100000) baseScore += 25;
  else if (facts.budget && facts.budget >= 25000) baseScore += 15;

  if (facts.status === "PROPOSAL_SENT") baseScore += 20;
  else if (facts.status === "QUALIFIED") baseScore += 15;
  else if (facts.status === "CONTACTED") baseScore += 10;

  if (facts.isStale) baseScore -= 15;
  if (facts.hasOverdueFollowUp) baseScore -= 10;

  const score = Math.min(100, Math.max(10, baseScore));

  let priority: "CRITICAL" | "IMPORTANT" | "NORMAL" = "NORMAL";
  if (facts.hasOverdueFollowUp || (score >= 80 && facts.isStale)) {
    priority = "CRITICAL";
  } else if (score >= 70 || facts.isStale || facts.status === "PROPOSAL_SENT") {
    priority = "IMPORTANT";
  }

  let scoreReason = "";
  if (score >= 80) {
    scoreReason = facts.budget
      ? `High-value prospect with ₹${facts.budget.toLocaleString("en-IN")} budget in ${facts.status} stage.`
      : `High intent lead in ${facts.status} stage with active engagement.`;
  } else if (score >= 50) {
    scoreReason = `Solid opportunity in ${facts.status} stage requiring timely follow-up.`;
  } else {
    scoreReason = facts.isStale
      ? `Low recent activity with no contact recorded for ${facts.durationWithoutContact}.`
      : `Early stage prospect in ${facts.status} stage pending qualification.`;
  }

  let recommendedAction = "Call today";
  let recommendedActionType: "CALL" | "FOLLOWUP" | "WHATSAPP" | "EMAIL" | "REVIEW" | "WARNING" | "OTHER" = "CALL";

  if (facts.hasOverdueFollowUp) {
    recommendedAction = `Overdue follow-up (${facts.overdueHours}h) — Contact immediately`;
    recommendedActionType = "CALL";
  } else if (score >= 80 && facts.isStale) {
    recommendedAction = "High-value opportunity becoming cold — Call now";
    recommendedActionType = "WARNING";
  } else if (facts.status === "PROPOSAL_SENT") {
    recommendedAction = "Follow up on sent proposal";
    recommendedActionType = "FOLLOWUP";
  } else if (facts.status === "NEW") {
    recommendedAction = "Contact new lead immediately";
    recommendedActionType = "CALL";
  } else if (facts.isStale) {
    recommendedAction = "Send re-engagement WhatsApp message";
    recommendedActionType = "WHATSAPP";
  }

  return applyDeterministicSafetyRules(
    {
      score,
      priority,
      scoreReason,
      recommendedAction,
      recommendedActionType,
      factorBreakdown: {
        stageSignal: facts.status,
        budgetSignal: facts.budget ? `₹${facts.budget}` : "Not specified",
        urgencySignal: priority,
      },
    },
    facts
  );
}

/**
 * Analyzes a single lead using Groq and updates LeadAIInsight in the database.
 * If Groq fails, previous insight is preserved and needsRefresh remains true.
 */
export async function analyzeLead(
  leadId: string,
  options: { force?: boolean } = {}
): Promise<LeadAIInsight | null> {
  const facts = await calculateLeadFacts(leadId);
  if (!facts) return null;

  const existing = await db.leadAIInsight.findUnique({
    where: { leadId },
  });

  // If already analyzed recently and doesn't need refresh, return existing snapshot
  if (!options.force && existing && !existing.needsRefresh) {
    const ageMs = Date.now() - existing.lastAnalyzedAt.getTime();
    if (ageMs < 2 * 60 * 60 * 1000) {
      return existing;
    }
  }

  let structuredOutput: GroqLeadScoreOutput;

  try {
    const userPrompt = buildScoringUserPrompt(facts);
    const { rawJson } = await requestGroqJson({
      systemPrompt: SCORING_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.1,
    });

    const parsed = JSON.parse(rawJson);
    const validated = GroqLeadScoreSchema.parse(parsed);
    structuredOutput = applyDeterministicSafetyRules(validated, facts);
  } catch (error) {
    console.warn(`[AI Attention] Groq analysis failed for lead ${leadId}:`, error);

    if (existing) {
      // Preserve existing insight, keep needsRefresh = true so it can retry later
      return await db.leadAIInsight.update({
        where: { leadId },
        data: { needsRefresh: true },
      });
    }

    // If no existing insight at all, save safe deterministic fallback so UI has data
    structuredOutput = deriveFallbackInsight(facts);
  }

  // Upsert insight into database
  return await db.leadAIInsight.upsert({
    where: { leadId },
    update: {
      score: structuredOutput.score,
      priority: structuredOutput.priority as AIPriority,
      scoreReason: structuredOutput.scoreReason,
      recommendedAction: structuredOutput.recommendedAction,
      recommendedActionType: structuredOutput.recommendedActionType as AIActionType,
      factorBreakdown: structuredOutput.factorBreakdown
        ? (structuredOutput.factorBreakdown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      lastAnalyzedAt: new Date(),
      needsRefresh: false,
    },
    create: {
      leadId,
      score: structuredOutput.score,
      priority: structuredOutput.priority as AIPriority,
      scoreReason: structuredOutput.scoreReason,
      recommendedAction: structuredOutput.recommendedAction,
      recommendedActionType: structuredOutput.recommendedActionType as AIActionType,
      factorBreakdown: structuredOutput.factorBreakdown
        ? (structuredOutput.factorBreakdown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      lastAnalyzedAt: new Date(),
      needsRefresh: false,
    },
  });
}

/**
 * Batch analysis job for recurring background execution (e.g. 2-hour scheduler).
 * Prioritizes active leads needing refresh.
 */
export async function batchAnalyzeLeads(options: {
  limit?: number;
  concurrency?: number;
  forceAll?: boolean;
} = {}): Promise<{ analyzed: number; skipped: number; errors: number }> {
  const { limit = 25, concurrency = 3, forceAll = false } = options;

  // Find active leads (exclude WON / LOST from recurring heavy analysis if already analyzed)
  const candidates = await db.lead.findMany({
    where: forceAll
      ? { isWaste: false }
      : {
          isWaste: false,
          status: { notIn: ["WON", "LOST"] },
          OR: [
            { aiInsight: null },
            { aiInsight: { needsRefresh: true } },
            {
              aiInsight: {
                lastAnalyzedAt: {
                  lt: new Date(Date.now() - 2 * 60 * 60 * 1000),
                },
              },
            },
          ],
        },
    take: limit,
    select: { id: true },
  });

  let analyzed = 0;
  let errors = 0;

  // Process in chunks with concurrency control
  for (let i = 0; i < candidates.length; i += concurrency) {
    const chunk = candidates.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (candidate) => {
        try {
          const res = await analyzeLead(candidate.id, { force: true });
          if (res) analyzed++;
        } catch {
          errors++;
        }
      })
    );
  }

  return {
    analyzed,
    skipped: Math.max(0, candidates.length - analyzed - errors),
    errors,
  };
}

/**
 * Safely marks a lead's AI insight as needing refresh without failing caller transaction.
 */
export async function markLeadAIInsightNeedsRefresh(
  leadId: string,
  client: Prisma.TransactionClient | typeof db = db
): Promise<void> {
  try {
    await client.leadAIInsight.upsert({
      where: { leadId },
      update: { needsRefresh: true },
      create: {
        leadId,
        score: 50,
        priority: "NORMAL",
        scoreReason: "Lead updated; pending background AI analysis.",
        recommendedAction: "Review updated lead details",
        needsRefresh: true,
      },
    });
  } catch (err) {
    console.warn(`[AI Attention] Could not mark lead ${leadId} needsRefresh:`, err);
  }
}
