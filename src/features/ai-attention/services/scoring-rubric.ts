import { z } from "zod";
import type { CalculatedLeadFacts } from "../types";

export const GroqLeadScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  priority: z.enum(["CRITICAL", "IMPORTANT", "NORMAL"]),
  scoreReason: z.string().min(5).max(300),
  recommendedAction: z.string().min(3).max(150),
  recommendedActionType: z
    .enum(["CALL", "FOLLOWUP", "WHATSAPP", "EMAIL", "REVIEW", "WARNING", "OTHER"])
    .default("CALL"),
  factorBreakdown: z
    .object({
      stageSignal: z.string().optional(),
      budgetSignal: z.string().optional(),
      engagementSignal: z.string().optional(),
      urgencySignal: z.string().optional(),
    })
    .optional(),
});

export type GroqLeadScoreOutput = z.infer<typeof GroqLeadScoreSchema>;

export const SCORING_SYSTEM_PROMPT = `You are an expert CRM Lead Attention & Scoring AI for an Indian SMB sales team.
Your job is to analyze CRM facts about a lead and provide an objective AI Lead Score (0–100), an Attention Priority (CRITICAL, IMPORTANT, or NORMAL), a concise explanation (WHY), and a clear, actionable recommended next action.

CRITICAL DISTINCTION:
- Score (0–100) measures OPPORTUNITY QUALITY & CONVERSION LIKELIHOOD.
- Priority (CRITICAL, IMPORTANT, NORMAL) measures IMMEDIATE ACTION URGENCY for the sales rep.
They are related but NOT identical. (E.g. A ₹1,00,000 Proposal Sent lead may have Score 90 and Priority CRITICAL if follow-up is overdue).

SCORING RUBRIC (0–100):
- 80–100 (Hot): High value or qualified/proposal sent stage, active responsiveness, recent engagement, high budget.
  * If WON: Score should be 90–100.
- 50–79 (Warm): Solid potential, early-to-mid stage (Contacted, Qualified), moderate budget, normal response cycle.
- 0–49 (Cold): Low responsiveness, stale for multiple days, stuck in early stage with no budget, or non-responsive.
  * If LOST: Score should be 0–20.

PRIORITY CRITERIA:
- CRITICAL: Immediate action required today. Overdue follow-up, hot opportunity turning cold/stale, high-value proposal expiring, or uncontacted new lead that is urgent.
- IMPORTANT: Action needed within 24–48 hours. Active proposal awaiting follow-up, qualified lead needing proposal, or mildly stale lead.
- NORMAL: No urgent action needed today. Scheduled future follow-up already in place, or terminal closed lead (WON/LOST).

TERMINAL STATES:
- If stage is WON: Priority MUST be NORMAL. Score 90-100. Action: "Lead won. Prepare onboarding or delivery."
- If stage is LOST: Priority MUST be NORMAL. Score 0-20. Action: "Lead lost. Keep on low-priority nurturing or archive."

RECOMMENDED ACTION:
Return practical, specific next actions supported by CRM data.
Examples:
- "Call today regarding proposal discussion"
- "Contact this new lead immediately"
- "Send quotation follow-up via WhatsApp"
- "Follow up tomorrow on pending review"
- "High-value opportunity becoming cold — Call now"

SCORE EXPLANATION:
Keep it concise (1–2 sentences) explicitly explaining the score and priority.

Return valid JSON adhering strictly to:
{
  "score": integer (0-100),
  "priority": "CRITICAL" | "IMPORTANT" | "NORMAL",
  "scoreReason": string (concise explanation),
  "recommendedAction": string (practical next action),
  "recommendedActionType": "CALL" | "FOLLOWUP" | "WHATSAPP" | "EMAIL" | "REVIEW" | "WARNING" | "OTHER",
  "factorBreakdown": {
    "stageSignal": string,
    "budgetSignal": string,
    "engagementSignal": string,
    "urgencySignal": string
  }
}`;

export function buildScoringUserPrompt(facts: CalculatedLeadFacts): string {
  const payload = {
    leadId: facts.leadId,
    name: facts.name,
    currentStage: facts.status,
    stageAge: facts.stageAgeText,
    stageAgeEstimated: facts.stageAgeEstimated,
    budgetINR: facts.budget,
    quotedAmountINR: facts.quotedAmount,
    isStale: facts.isStale,
    staleDuration: facts.durationWithoutContact,
    staleSummary: facts.staleFor,
    hasOverdueFollowUp: facts.hasOverdueFollowUp,
    overdueHours: facts.overdueHours,
    pendingFollowUpCount: facts.pendingFollowUpCount,
    nextScheduledFollowUp: facts.nextFollowUpAt ? facts.nextFollowUpAt.toISOString() : null,
    completedFollowUps: facts.completedFollowUpCount,
    recentNotes: facts.recentNotes,
    recentActivities: facts.recentActivitiesSummary,
  };

  return `Analyze this CRM lead and return structured JSON scoring:\n${JSON.stringify(payload, null, 2)}`;
}
