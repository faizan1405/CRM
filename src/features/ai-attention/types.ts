import type { LeadStatus } from "@/features/leads/types";

export type LeadScoreCategory = "hot" | "warm" | "cold";

export type AttentionPriority = "critical" | "important" | "normal";

export interface StaleStatus {
  isStale: boolean;
  staleFor: string; // e.g. "3 days without contact", "2 hours ago"
  lastActivityDate?: string | null;
  lastContactDate?: string | null;
  durationWithoutContact: string; // e.g. "4 days", "18 hours"
  warningLevel?: "critical" | "warning" | "normal";
  warningMessage?: string;
}

export interface StageAging {
  currentStage: LeadStatus | string;
  timeInStage: string; // e.g. "4 days", "12 hours", "1 week"
  stageEnteredAt?: string;
  stageAgeDays: number;
  stageAgeEstimated: boolean;
  isStagnant?: boolean;
}

export interface RecommendedAction {
  title: string;
  type?: "call" | "followup" | "whatsapp" | "email" | "review" | "warning";
  dueDate?: string;
  reason?: string;
}

export interface AIAttentionLeadData {
  score: number; // 0 to 100
  scoreCategory: LeadScoreCategory; // 80-100 Hot, 50-79 Warm, 0-49 Cold
  scoreReason: string; // Concise explanation
  priority: AttentionPriority; // Critical, Important, Normal
  staleStatus: StaleStatus;
  stageAging: StageAging;
  recommendedAction: RecommendedAction;
  lastAnalyzedAt?: string;
  needsRefresh?: boolean;
  signals?: Array<{
    label: string;
    tone: "positive" | "warning" | "neutral";
  }>;
}

export interface AIAttentionSummaryItem {
  id: string;
  leadId: string;
  leadName: string;
  business?: string;
  phone?: string;
  score: number;
  scoreCategory: LeadScoreCategory;
  priority: AttentionPriority;
  attentionReason: string;
  recommendedAction?: RecommendedAction;
  stage?: string;
  lastActivity?: string;
  staleFor?: string;
  stageAge?: string;
}

export interface CalculatedLeadFacts {
  leadId: string;
  name: string;
  status: string;
  budget: number | null;
  quotedAmount: number | null;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date | null;
  lastContactAt: Date | null;
  isStale: boolean;
  staleFor: string;
  durationWithoutContact: string;
  stageEnteredAt: Date;
  stageAgeDays: number;
  stageAgeText: string;
  stageAgeEstimated: boolean;
  hasOverdueFollowUp: boolean;
  overdueFollowUpCount: number;
  overdueHours: number;
  pendingFollowUpCount: number;
  nextFollowUpAt: Date | null;
  completedFollowUpCount: number;
  recentNotes: string[];
  recentActivitiesSummary: string[];
}

export function getScoreCategory(score: number): LeadScoreCategory {
  if (score >= 80) return "hot";
  if (score >= 50) return "warm";
  return "cold";
}

export function getScoreCategoryLabel(category: LeadScoreCategory): string {
  switch (category) {
    case "hot":
      return "Hot";
    case "warm":
      return "Warm";
    case "cold":
      return "Cold";
  }
}

export function getPriorityLabel(priority: AttentionPriority): string {
  switch (priority) {
    case "critical":
      return "Critical";
    case "important":
      return "Important";
    case "normal":
      return "Normal";
  }
}
