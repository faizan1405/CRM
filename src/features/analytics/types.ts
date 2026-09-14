/**
 * Phase 6 – Analytics Data Layer Types
 *
 * All types here are plain-JSON-safe (no Prisma Decimal, no Date objects,
 * no raw Prisma models). Safe to pass from Server Actions to Client Components.
 */

// --- Date Range ----------------------------------------------------------------

export type DateRange = "7d" | "30d" | "90d" | "all";
export type AnalyticsDateRange = DateRange;

export const DATE_RANGE_LABELS: Record<DateRange, string> = {
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  "90d": "Last 90 Days",
  all: "All Time",
};

// --- Funnel --------------------------------------------------------------------

export type FunnelStage = {
  /** Human-readable stage label */
  label: string;
  /** DB enum value for this stage */
  status: string;
  /** Number of leads that have reached (or passed through) this stage */
  reached: number;
  /**
   * Conversion rate from the previous stage, expressed as 0–1.
   * null means the data is unreliable (e.g., predates activity tracking)
   * or the previous stage count is 0.
   */
  conversionFromPrev: number | null;
};

// --- Trends --------------------------------------------------------------------

export type TrendPoint = {
  /** ISO date string for daily, "YYYY-Www" for weekly, "YYYY-MM" for monthly */
  label: string;
  revenue: number;
  /**
   * true when at least one WON lead in this bucket used a fallback timestamp
   * (Lead.updatedAt) instead of a reliable STATUS_CHANGED activity timestamp.
   */
  isEstimated: boolean;
  /** How many WON leads contributed to this bucket */
  leadCount: number;
};
export type RevenueTrendPoint = TrendPoint;

export type LeadTrendPoint = {
  /** Same granularity as TrendPoint.label */
  label: string;
  /** Alias date: same as label, used by Agent B chart dataKey */
  date: string;
  count: number;
  /** Alias value: same as count, used by Agent B chart dataKey */
  value: number;
};

/**
 * Agent B compatibility wrapper for the lead trend chart.
 * Wraps the flat LeadTrendPoint[] in a { points } envelope.
 */
export type LeadTrendData = {
  points: LeadTrendPoint[];
};

// --- Follow-up Performance -----------------------------------------------------

export type FollowUpBreakdown = {
  type: "CALL" | "WHATSAPP" | "EMAIL" | "OTHER" | string;
  /** Total follow-ups of this type (all statuses) */
  total: number;
  /** Alias for total — used by Agent B components */
  created: number;
  completed: number;
  pending: number;
  overdue: number;
};
export type FollowUpTypeRow = FollowUpBreakdown;

export type FollowUpPerformance = {
  created: number;
  completed: number;
  pending: number;
  overdue: number;
  /**
   * Completion Rate = Completed / (Completed + Pending + Overdue)
   * CANCELLED follow-ups are excluded from the denominator (they were abandoned,
   * not outstanding). 0 when denominator is 0.
   */
  completionRate: number;
  byType: FollowUpBreakdown[];
};

/** Agent B compatibility alias */
export type FollowUpPerformanceData = FollowUpPerformance;

// --- Pipeline Health -----------------------------------------------------------

export type PipelineStageHealth = {
  /** DB enum value */
  stage: string;
  /** Human-readable label */
  label: string;
  count: number;
  /**
   * Sum of quotedAmount for leads in this stage.
   * Only meaningful for active stages (NEW, CONTACTED, QUALIFIED, PROPOSAL_SENT).
   */
  value: number;
};
export type PipelineStage = PipelineStageHealth;

/**
 * Agent B compatibility wrapper for the pipeline health component.
 * Wraps the flat PipelineStageHealth[] in a { stages } envelope.
 */
export type PipelineHealthData = {
  stages: PipelineStageHealth[];
};

// --- Win / Loss ----------------------------------------------------------------

/**
 * Derived win/loss summary used by Agent B's WinLossCard component.
 * winRate is expressed as a PERCENTAGE (0–100) to match the component's
 * `data.winRate.toFixed(1) + "%"` rendering.
 */
export type WinLossData = {
  won: number;
  lost: number;
  /** Win rate as a percentage, e.g. 50.0 means 50% */
  winRate: number;
  /** Lost rate as a percentage */
  lostRate: number;
};

// --- Data Coverage / Honesty ---------------------------------------------------

export type DataCoverage = {
  /** ISO date string (start of the selected analysis window) or null for "all time" */
  analysisStart: string | null;
  /**
   * ISO date string of the earliest LeadActivity record.
   * Activity tracking (Phase 5) started after some leads existed.
   */
  activityHistoryCoverageStart: string | null;
  /**
   * Number of Lead records created BEFORE the first LeadActivity record.
   * These leads have no reliable stage-transition history.
   */
  legacyLeadCount: number;
  /**
   * true when the analysis period includes time before activity tracking began.
   * Agent B should show: "Historical stage data may be incomplete."
   */
  funnelWarning: boolean;
  /**
   * Number of WON leads whose revenue was timestamped using Lead.updatedAt
   * as a fallback instead of a reliable STATUS_CHANGED activity timestamp.
   */
  revenueLegacyCount: number;
};

// --- Core Metrics --------------------------------------------------------------

export type CoreMetrics = {
  /** All leads matching the date filter (createdAt in range) */
  totalLeads: number;
  /** Leads currently in NEW status, within the date range */
  newLeads: number;
  /** Leads currently in QUALIFIED status, within the date range */
  qualifiedLeads: number;
  /** Leads currently in PROPOSAL_SENT status, within the date range */
  proposalSent: number;
  /** Leads currently in WON status, within the date range */
  wonLeads: number;
  /** Leads currently in LOST status, within the date range */
  lostLeads: number;

  /**
   * Win Rate = Won / (Won + Lost)
   * Uses ONLY WON and LOST leads — not total leads —
   * because many leads are still open/active.
   * Returns 0 when denominator is 0.
   */
  winRate: number;

  /**
   * Lost Rate = Lost / (Won + Lost)
   * Returns 0 when denominator is 0.
   */
  lostRate: number;

  /** Sum of quotedAmount for WON leads within the date range */
  wonRevenue: number;

  /**
   * Sum of quotedAmount for leads in active statuses (current snapshot).
   * Active = NEW | CONTACTED | QUALIFIED | PROPOSAL_SENT.
   * NOT date-filtered — reflects the current live pipeline.
   */
  openPipelineValue: number;

  /**
   * Average Won Deal = wonRevenue / count(WON leads with quotedAmount != null)
   * Returns 0 when denominator is 0.
   */
  avgWonDeal: number;

  /** Total follow-ups created (within date range) */
  followUpsCreated: number;
  /** Follow-ups with status COMPLETED (within date range) */
  followUpsCompleted: number;
  /** Pending follow-ups past their scheduledAt (overdue) */
  overdueFollowUps: number;
};
export type AnalyticsKpiData = CoreMetrics;

// --- Top-Level Analytics Response ---------------------------------------------

export type AnalyticsData = {
  meta: {
    dateRange: DateRange;
    /** ISO timestamp when this data was generated */
    generatedAt: string;
  };
  /** Core metrics. Also available as `kpis` for Agent B compatibility. */
  coreMetrics: CoreMetrics;
  /** Alias for coreMetrics — used by Agent B's AnalyticsKpis component */
  kpis: CoreMetrics;
  funnel: FunnelStage[];
  revenueTrend: TrendPoint[];
  leadTrend: LeadTrendData;
  followUpPerformance: FollowUpPerformance;
  /**
   * Derived win/loss summary for Agent B's WinLossCard.
   * winRate / lostRate are expressed as PERCENTAGES (0–100).
   */
  winLoss: WinLossData;
  pipelineHealth: PipelineHealthData;
  dataCoverage: DataCoverage;
  dataCoverageWarning?: string | null;
};

// --- Action Result Wrapper -----------------------------------------------------

export type AnalyticsResult =
  | { success: true; data: AnalyticsData }
  | { success: false; error: string };
