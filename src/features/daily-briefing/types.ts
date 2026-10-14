export type BriefingPriority = "Critical" | "Important" | "Normal";

export type BriefingCardId =
  | "hot_leads"
  | "followups_today"
  | "overdue_followups"
  | "new_leads"
  | "stale_leads"
  | "opportunity_value";

export interface BriefingSummaryStats {
  hotLeadsCount: number;
  followUpsTodayCount: number;
  overdueFollowUpsCount: number;
  newLeadsCount: number;
  staleLeadsCount: number;
  activeOpportunityValue: number;
  activeOpportunityValueFormatted: string;
}

export interface BriefingActionItem {
  id: string;
  title: string;
  subtitle: string;
  description?: string;
  leadId?: string;
  leadName?: string;
  phone?: string;
  business?: string | null;
  score?: number;
  opportunityValue?: number;
  formattedValue?: string;
  priority: BriefingPriority;
  isDone: boolean;
  dueTime?: string;
  tag?: string;
  suggestedActionType?: "call" | "whatsapp" | "followup" | "open";
  reason: string;
  recommendedAction: string;
  followUpId?: string | null;
}

export interface AiBriefingData {
  summary: string;
  keyPoints?: string[];
  recommendation?: string;
  generatedAt?: string;
}

export interface BriefingCallItem {
  id: string;
  leadId: string;
  leadName: string;
  phone?: string;
  context?: string;
  timeFormatted: string;
  isOverdue: boolean;
  scheduledAt: string;
}

export interface BriefingProposalItem {
  id: string;
  leadId: string;
  clientName: string;
  companyName?: string | null;
  quotedAmountFormatted: string;
  statusLabel: string;
  daysAgo?: number;
}

export interface BriefingPaymentItem {
  id: string;
  dealId: string;
  leadId?: string | null;
  clientName: string;
  companyName?: string | null;
  amount: number;
  amountFormatted: string;
  dueDateFormatted?: string;
  isOverdue: boolean;
}

export interface BriefingHeroProps {
  stats: BriefingSummaryStats;
  onResetActions?: () => void;
  className?: string;
}

export interface DailyBriefingPayload {
  briefingDate: string; // YYYY-MM-DD
  summaryStats: BriefingSummaryStats;
  priorityActions: BriefingActionItem[];
  aiBriefing: AiBriefingData;
  todayCalls?: BriefingCallItem[];
  awaitingProposals?: BriefingProposalItem[];
  paymentToChase?: BriefingPaymentItem | null;
}

export interface DailyBriefingActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

