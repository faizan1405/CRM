import { db } from "@/lib/db";
import { z } from "zod";
import { requestGroqJson, AIConfigError, AIServiceError } from "@/lib/ai/groq-client";
import type {
  DailyBriefingPayload,
  BriefingSummaryStats,
  BriefingActionItem,
  AiBriefingData,
  BriefingPriority,
} from "../types";

/**
 * Returns today's ISO date string (YYYY-MM-DD) and current time in Asia/Kolkata
 */
export function getIndiaDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

const AiBriefingJsonSchema = z.object({
  summary: z.string().min(1),
  keyPoints: z.array(z.string()).default([]),
  recommendation: z.string().optional(),
});

/**
 * Generates or retrieves cached Daily Sales Briefing data.
 * Timezone: Asia/Kolkata.
 * Deterministic facts are always live; AI summary is cached per calendar day.
 */
export async function getDailySalesBriefingData(options?: {
  userId?: string;
  forceRefreshAi?: boolean;
}): Promise<DailyBriefingPayload> {
  const userId = options?.userId || "system";
  const now = new Date();
  const todayDateStr = getIndiaDateKey(now);

  // 1. Fetch active leads, pending follow-ups, and AI insights
  const [activeLeads, pendingFollowUps] = await Promise.all([
    db.lead.findMany({
      where: { status: { notIn: ["WON", "LOST"] } },
      include: {
        aiInsight: true,
        followUps: {
          where: { status: "PENDING" },
          orderBy: { scheduledAt: "asc" },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    db.followUp.findMany({
      where: {
        status: "PENDING",
        lead: {
          status: { notIn: ["WON", "LOST"] },
          deletedAt: null,
          mergedIntoLeadId: null,
        },
      },
      include: { lead: true },
      orderBy: { scheduledAt: "asc" },
    }),
  ]);

  // 2. Compute Deterministic Metrics
  let hotLeadsCount = 0;
  let newLeadsCount = 0;
  let staleLeadsCount = 0;
  let activeOpportunityValue = 0;

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (const lead of activeLeads) {
    // Opportunity value
    const val = lead.quotedAmount ? Number(lead.quotedAmount) : lead.budget ? Number(lead.budget) : 0;
    activeOpportunityValue += val;

    // Hot leads
    if (lead.aiInsight && lead.aiInsight.score >= 80) {
      hotLeadsCount++;
    }

    // New leads created today
    const createdDateStr = getIndiaDateKey(lead.createdAt);
    if (createdDateStr === todayDateStr && lead.status === "NEW") {
      newLeadsCount++;
    }

    // Stale leads
    const lastActivity = lead.activities[0]?.createdAt || lead.updatedAt;
    if (lastActivity < sevenDaysAgo) {
      staleLeadsCount++;
    }
  }

  // Follow-ups today & overdue
  let overdueFollowUpsCount = 0;
  let followUpsTodayCount = 0;

  for (const f of pendingFollowUps) {
    if (f.scheduledAt.getTime() < now.getTime()) {
      overdueFollowUpsCount++;
    } else {
      const fDateStr = getIndiaDateKey(f.scheduledAt);
      if (fDateStr === todayDateStr) {
        followUpsTodayCount++;
      }
    }
  }

  const activeOpportunityValueFormatted = `₹${activeOpportunityValue.toLocaleString("en-IN")}`;

  const summaryStats: BriefingSummaryStats = {
    hotLeadsCount,
    followUpsTodayCount,
    overdueFollowUpsCount,
    newLeadsCount,
    staleLeadsCount,
    activeOpportunityValue,
    activeOpportunityValueFormatted,
  };

  // 3. Compile Priority Action Items (no invented priorities; uses attention engine + follow-ups)
  const priorityMap = new Map<string, BriefingActionItem>();

  // A. Overdue follow-ups first (Urgent / Critical)
  for (const f of pendingFollowUps) {
    if (!f.lead) continue;
    if (f.scheduledAt.getTime() < now.getTime()) {
      const val = f.lead.quotedAmount ? Number(f.lead.quotedAmount) : f.lead.budget ? Number(f.lead.budget) : 0;
      priorityMap.set(f.lead.id, {
        id: `action_overdue_${f.id}`,
        title: f.lead.name,
        subtitle: f.lead.business || f.lead.notes || "Overdue follow-up",
        leadId: f.lead.id,
        leadName: f.lead.name,
        phone: f.lead.phone,
        business: f.lead.business,
        score: 90,
        opportunityValue: val,
        formattedValue: val > 0 ? `₹${val.toLocaleString("en-IN")}` : undefined,
        priority: "Critical" as BriefingPriority,
        isDone: false,
        dueTime: new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).format(f.scheduledAt),
        tag: "Overdue",
        suggestedActionType: "call",
        reason: `Scheduled ${f.type} follow-up is overdue.`,
        recommendedAction: `Call ${f.lead.name} immediately to reconnect.`,
        followUpId: f.id,
      });
    }
  }

  // B. Hot leads & Critical AI Insights
  for (const lead of activeLeads) {
    if (priorityMap.has(lead.id)) continue;
    const score = lead.aiInsight?.score || 50;
    const priority = lead.aiInsight?.priority || "NORMAL";

    if (score >= 80 || priority === "CRITICAL") {
      const val = lead.quotedAmount ? Number(lead.quotedAmount) : lead.budget ? Number(lead.budget) : 0;
      const nextFollowUp = lead.followUps[0];
      priorityMap.set(lead.id, {
        id: `action_hot_${lead.id}`,
        title: lead.name,
        subtitle: lead.business || lead.notes || "Hot prospect",
        leadId: lead.id,
        leadName: lead.name,
        phone: lead.phone,
        business: lead.business,
        score,
        opportunityValue: val,
        formattedValue: val > 0 ? `₹${val.toLocaleString("en-IN")}` : undefined,
        priority: (priority === "CRITICAL" || score >= 85 ? "Critical" : "Important") as BriefingPriority,
        isDone: false,
        dueTime: nextFollowUp
          ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).format(nextFollowUp.scheduledAt)
          : undefined,
        tag: score >= 80 ? "Hot Deal" : "Critical Attention",
        suggestedActionType:
          lead.aiInsight?.recommendedActionType === "WHATSAPP"
            ? "whatsapp"
            : lead.aiInsight?.recommendedActionType === "FOLLOWUP"
            ? "followup"
            : "call",
        reason: lead.aiInsight?.scoreReason || "High buying intent requires prompt engagement.",
        recommendedAction: lead.aiInsight?.recommendedAction || "Reach out to discuss proposal.",
        followUpId: nextFollowUp?.id || null,
      });
    }
  }

  // C. Follow-ups Due Today
  for (const f of pendingFollowUps) {
    if (!f.lead || priorityMap.has(f.lead.id)) continue;
    const fDateStr = getIndiaDateKey(f.scheduledAt);
    if (fDateStr === todayDateStr) {
      const val = f.lead.quotedAmount ? Number(f.lead.quotedAmount) : f.lead.budget ? Number(f.lead.budget) : 0;
      priorityMap.set(f.lead.id, {
        id: `action_today_${f.id}`,
        title: f.lead.name,
        subtitle: f.lead.business || "Follow-up due today",
        leadId: f.lead.id,
        leadName: f.lead.name,
        phone: f.lead.phone,
        business: f.lead.business,
        score: 75,
        opportunityValue: val,
        formattedValue: val > 0 ? `₹${val.toLocaleString("en-IN")}` : undefined,
        priority: "Important" as BriefingPriority,
        isDone: false,
        dueTime: new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).format(f.scheduledAt),
        tag: "Due Today",
        suggestedActionType: f.type === "CALL" ? "call" : f.type === "WHATSAPP" ? "whatsapp" : "followup",
        reason: `Scheduled ${f.type} follow-up for today.`,
        recommendedAction: f.note || `Reach out as planned.`,
        followUpId: f.id,
      });
    }
  }

  const priorityActions: BriefingActionItem[] = Array.from(priorityMap.values())
    .sort((a, b) => {
      if (a.priority === "Critical" && b.priority !== "Critical") return -1;
      if (b.priority === "Critical" && a.priority !== "Critical") return 1;
      return (b.score || 0) - (a.score || 0);
    })
    .slice(0, 10);

  // 4. Cached Daily AI Briefing Summary
  let aiBriefing: AiBriefingData;

  const cachedBriefing = await db.dailySalesBriefing.findUnique({
    where: {
      userId_briefingDate: {
        userId,
        briefingDate: todayDateStr,
      },
    },
  });

  if (cachedBriefing && !options?.forceRefreshAi) {
    // Return cached summary immediately
    const meta = (typeof cachedBriefing.metadata === "object" && cachedBriefing.metadata !== null
      ? cachedBriefing.metadata
      : {}) as Record<string, unknown>;
    aiBriefing = {
      summary: cachedBriefing.summary,
      keyPoints: Array.isArray(meta?.keyPoints) ? (meta.keyPoints as string[]) : [],
      recommendation: typeof meta?.recommendation === "string" ? meta.recommendation : undefined,
      generatedAt: cachedBriefing.generatedAt.toISOString(),
    };
  } else {
    // Generate AI summary or clean fallback
    aiBriefing = await generateAiDailySummary({
      summaryStats,
      priorityActions,
      todayDateStr,
    });

    // Save to database snapshot
    try {
      await db.dailySalesBriefing.upsert({
        where: {
          userId_briefingDate: {
            userId,
            briefingDate: todayDateStr,
          },
        },
        update: {
          summary: aiBriefing.summary,
          metadata: {
            keyPoints: aiBriefing.keyPoints || [],
            recommendation: aiBriefing.recommendation || null,
            generatedAt: new Date().toISOString(),
          },
          generatedAt: new Date(),
        },
        create: {
          userId,
          briefingDate: todayDateStr,
          summary: aiBriefing.summary,
          metadata: {
            keyPoints: aiBriefing.keyPoints || [],
            recommendation: aiBriefing.recommendation || null,
            generatedAt: new Date().toISOString(),
          },
        },
      });
    } catch {
      // In case of parallel write race, gracefully continue
    }
  }

  return {
    briefingDate: todayDateStr,
    summaryStats,
    priorityActions,
    aiBriefing,
  };
}

/**
 * Generates an AI summary for today's briefing using Groq, or falls back to a deterministic summary.
 */
async function generateAiDailySummary(context: {
  summaryStats: BriefingSummaryStats;
  priorityActions: BriefingActionItem[];
  todayDateStr: string;
}): Promise<AiBriefingData> {
  const { summaryStats, priorityActions, todayDateStr } = context;

  // Safe deterministic fallback template
  const defaultFallback: AiBriefingData = {
    summary: `You have ${summaryStats.overdueFollowUpsCount} overdue follow-up${
      summaryStats.overdueFollowUpsCount === 1 ? "" : "s"
    } and ${summaryStats.followUpsTodayCount} scheduled for today. Active opportunity pipeline is ${
      summaryStats.activeOpportunityValueFormatted
    }. Prioritize reconnecting with overdue leads to prevent drop-off.`,
    keyPoints: [
      `${summaryStats.hotLeadsCount} hot leads requiring attention`,
      `${summaryStats.followUpsTodayCount} follow-ups due today`,
      `${summaryStats.overdueFollowUpsCount} overdue items need immediate action`,
    ],
    recommendation: priorityActions[0]
      ? `Contact ${priorityActions[0].leadName} first: ${priorityActions[0].recommendedAction}`
      : "Review incoming new leads and log follow-ups.",
    generatedAt: new Date().toISOString(),
  };

  try {
    const topLeadsSummary = priorityActions
      .slice(0, 3)
      .map((item) => `- ${item.leadName} (${item.priority}): ${item.reason} -> Action: ${item.recommendedAction}`)
      .join("\n");

    const systemPrompt = `You are an executive sales AI assistant providing a daily briefing for an Indian business sales team.
Date: ${todayDateStr} (Asia/Kolkata).

Generate a sharp, motivational, 2-3 sentence morning briefing summary.
Focus on:
1. Urgent priorities today (overdue items and high-probability deals).
2. Exactly who to contact first and why.
3. Strict rule: Do not invent names or numbers not provided.

Return strictly JSON:
{
  "summary": "2-3 crisp sentences",
  "keyPoints": ["Bullet 1", "Bullet 2", "Bullet 3"],
  "recommendation": "1 specific immediate next step"
}`;

    const userPrompt = `Sales Stats for Today:
- Overdue Follow-ups: ${summaryStats.overdueFollowUpsCount}
- Due Today: ${summaryStats.followUpsTodayCount}
- Hot Leads: ${summaryStats.hotLeadsCount}
- New Leads Today: ${summaryStats.newLeadsCount}
- Active Pipeline Value: ${summaryStats.activeOpportunityValueFormatted}

Top Priority Leads:
${topLeadsSummary || "No critical leads pending."}

Generate the daily briefing JSON:`;

    const { rawJson } = await requestGroqJson({
      systemPrompt,
      userPrompt,
      temperature: 0.2,
      timeoutMs: 12000,
    });

    const parsed = JSON.parse(rawJson);
    const validated = AiBriefingJsonSchema.parse(parsed);

    return {
      summary: validated.summary.trim(),
      keyPoints: validated.keyPoints,
      recommendation: validated.recommendation,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof AIConfigError || error instanceof AIServiceError || error instanceof Error) {
      return defaultFallback;
    }
    return defaultFallback;
  }
}
