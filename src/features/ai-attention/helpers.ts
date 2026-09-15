import type { Lead } from "@/features/leads/types";
import {
  type AIAttentionLeadData,
  type AIAttentionSummaryItem,
  type AttentionPriority,
  getScoreCategory,
} from "./types";
import { computeLeadFactsSync } from "./services/lead-facts";
import { deriveFallbackInsight } from "./services/attention-engine";

function toActionType(type?: string | null): "call" | "followup" | "whatsapp" | "email" | "review" | "warning" {
  const lower = type?.toLowerCase();
  if (lower === "call" || lower === "followup" || lower === "whatsapp" || lower === "email" || lower === "review" || lower === "warning") {
    return lower;
  }
  return "call";
}

/**
 * Transforms a Lead object into complete AIAttentionLeadData.
 * Uses real persistent LeadAIInsight if available, or deterministic facts fallback.
 */
export function deriveAIAttention(
  lead: Lead & {
    aiInsight?: {
      score: number;
      priority: string;
      scoreReason: string;
      recommendedAction: string;
      recommendedActionType?: string | null;
      lastAnalyzedAt?: Date | string;
      needsRefresh?: boolean;
    } | null;
  }
): AIAttentionLeadData {
  const facts = computeLeadFactsSync({
    id: lead.id,
    name: lead.name,
    status: lead.status,
    budget: lead.budget,
    quotedAmount: lead.quotedAmount,
    createdAt: new Date(lead.createdAt),
    updatedAt: new Date(lead.updatedAt),
    lastContactDate: lead.lastContactDate ? new Date(lead.lastContactDate) : null,
  });

  const isTerminal = lead.status === "Won" || lead.status === "Lost" || (lead.status as string).toUpperCase() === "WON" || (lead.status as string).toUpperCase() === "LOST";

  if (lead.aiInsight) {
    const score = lead.aiInsight.score;
    const priority = (isTerminal ? "normal" : lead.aiInsight.priority.toLowerCase()) as AttentionPriority;
    const scoreCategory = getScoreCategory(score);

    return {
      score,
      scoreCategory,
      scoreReason: lead.aiInsight.scoreReason,
      priority,
      staleStatus: {
        isStale: isTerminal ? false : facts.isStale,
        staleFor: facts.staleFor,
        lastActivityDate: facts.lastActivityAt ? facts.lastActivityAt.toISOString() : null,
        lastContactDate: facts.lastContactAt ? facts.lastContactAt.toISOString() : null,
        durationWithoutContact: facts.durationWithoutContact,
        warningLevel: priority === "critical" ? "critical" : facts.isStale ? "warning" : "normal",
        warningMessage: facts.isStale ? facts.staleFor : undefined,
      },
      stageAging: {
        currentStage: lead.status,
        timeInStage: facts.stageAgeText,
        stageEnteredAt: facts.stageEnteredAt.toISOString(),
        stageAgeDays: facts.stageAgeDays,
        stageAgeEstimated: facts.stageAgeEstimated,
        isStagnant: facts.stageAgeDays >= 5,
      },
      recommendedAction: {
        title: lead.aiInsight.recommendedAction,
        type: toActionType(lead.aiInsight.recommendedActionType),
        reason: lead.aiInsight.scoreReason,
      },
      lastAnalyzedAt: lead.aiInsight.lastAnalyzedAt ? new Date(lead.aiInsight.lastAnalyzedAt).toISOString() : undefined,
      needsRefresh: lead.aiInsight.needsRefresh,
      signals: [
        {
          label: `${scoreCategory.toUpperCase()} Score (${score}/100)`,
          tone: scoreCategory === "hot" ? "positive" : scoreCategory === "warm" ? "neutral" : "warning",
        },
        {
          label: `Stage: ${lead.status} (${facts.stageAgeText})`,
          tone: facts.stageAgeDays > 4 ? "warning" : "neutral",
        },
        ...(facts.isStale && !isTerminal
          ? [
              {
                label: `Stale: ${facts.staleFor}`,
                tone: "warning" as const,
              },
            ]
          : []),
      ],
    };
  }

  // Fallback if no database AI insight snapshot exists yet
  const fallback = deriveFallbackInsight(facts);
  const score = fallback.score;
  const scoreCategory = getScoreCategory(score);
  const priority = (isTerminal ? "normal" : fallback.priority.toLowerCase()) as AttentionPriority;

  return {
    score,
    scoreCategory,
    scoreReason: fallback.scoreReason,
    priority,
    staleStatus: {
      isStale: isTerminal ? false : facts.isStale,
      staleFor: facts.staleFor,
      lastActivityDate: facts.lastActivityAt ? facts.lastActivityAt.toISOString() : null,
      lastContactDate: facts.lastContactAt ? facts.lastContactAt.toISOString() : null,
      durationWithoutContact: facts.durationWithoutContact,
      warningLevel: priority === "critical" ? "critical" : facts.isStale ? "warning" : "normal",
      warningMessage: facts.isStale ? facts.staleFor : undefined,
    },
    stageAging: {
      currentStage: lead.status,
      timeInStage: facts.stageAgeText,
      stageEnteredAt: facts.stageEnteredAt.toISOString(),
      stageAgeDays: facts.stageAgeDays,
      stageAgeEstimated: facts.stageAgeEstimated,
      isStagnant: facts.stageAgeDays >= 5,
    },
    recommendedAction: {
      title: fallback.recommendedAction,
      type: toActionType(fallback.recommendedActionType),
      reason: fallback.scoreReason,
    },

    needsRefresh: true,
    signals: [
      {
        label: `${scoreCategory.toUpperCase()} Score (${score}/100)`,
        tone: scoreCategory === "hot" ? "positive" : scoreCategory === "warm" ? "neutral" : "warning",
      },
      {
        label: `Stage: ${lead.status} (${facts.stageAgeText})`,
        tone: facts.stageAgeDays > 4 ? "warning" : "neutral",
      },
      ...(facts.isStale && !isTerminal
        ? [
            {
              label: `Stale: ${facts.staleFor}`,
              tone: "warning" as const,
            },
          ]
        : []),
    ],
  };
}

/**
 * Derives AI attention summary items from active leads.
 * Strictly excludes terminal states (WON and LOST).
 * NO MOCK DATA.
 */
export function deriveDashboardAttentionLeads(leads: Lead[]): AIAttentionSummaryItem[] {
  if (!leads || leads.length === 0) {
    return [];
  }

  // Active leads only (exclude Won / Lost)
  const activeLeads = leads.filter(
    (lead) => lead.status !== "Won" && lead.status !== "Lost" && (lead.status as string).toUpperCase() !== "WON" && (lead.status as string).toUpperCase() !== "LOST"
  );

  const items: AIAttentionSummaryItem[] = activeLeads.map((lead) => {
    const ai = deriveAIAttention(lead);
    let attentionReason = ai.scoreReason;
    if (lead.nextFollowUpDate && new Date(lead.nextFollowUpDate).getTime() < Date.now()) {
      attentionReason = "Overdue follow-up";
    } else if (ai.staleStatus.isStale) {
      attentionReason = ai.staleStatus.staleFor;
    } else if (ai.scoreCategory === "hot") {
      attentionReason = "High-value opportunity";
    }

    return {
      id: lead.id,
      leadId: lead.id,
      leadName: lead.name,
      business: lead.business,
      phone: lead.phone,
      score: ai.score,
      scoreCategory: ai.scoreCategory,
      priority: ai.priority,
      attentionReason,
      recommendedAction: ai.recommendedAction,
      stage: lead.status,
      staleFor: ai.staleStatus.staleFor,
      stageAge: ai.stageAging.timeInStage,
    };
  });

  // Sort primarily by priority (critical > important > normal), then score descending
  const priorityWeight: Record<AttentionPriority, number> = {
    critical: 3,
    important: 2,
    normal: 1,
  };

  items.sort((a, b) => {
    const pDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
    if (pDiff !== 0) return pDiff;
    return b.score - a.score;
  });

  return items.slice(0, 10);
}
