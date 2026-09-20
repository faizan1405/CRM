"use server";

/**
 * Sales Analytics Server Action
 *
 * getAnalyticsData(dateRange) is the single authenticated loader for /analytics.
 *
 * Canonical Rules:
 *  - Active leads rule: deletedAt = null AND isWaste = false
 *  - Funnel stage counts derive directly from canonical Lead.status for the cohort
 *  - Won Revenue derives from real Deal.finalAmount for WON leads with an associated Deal
 *  - Average Won Deal = Won Revenue / count(WON deals with finalAmount > 0)
 *  - Open Pipeline represents active opportunities (CONTACTED, QUALIFIED, PROPOSAL_SENT)
 *    preferring confirmed Deal.finalAmount, falling back to Lead.quotedAmount
 *  - Overdue Follow-ups = pending follow-ups with scheduledAt < now on active non-waste leads
 *  - Strict Asia/Kolkata date boundaries across all cohort metrics
 */

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { LeadStatus, FollowUpStatus, ActivityType } from "@prisma/client";
import {
  getDateRangeBoundaries,
  getTrendGranularity,
  bucketLabel,
  generateBucketLabels,
  serializeDecimal,
  safeRate,
} from "@/lib/analytics-helpers";
import type {
  DateRange,
  AnalyticsResult,
  AnalyticsData,
  FunnelStage,
  TrendPoint,
  LeadTrendPoint,
  FollowUpBreakdown,
  PipelineStageHealth,
  DataCoverage,
  CoreMetrics,
} from "@/features/analytics/types";

// ─── Auth Helpers ──────────────────────────────────────────────────────────────

class UserFacingError extends Error {}

async function requireAuth() {
  const session = await getSession();
  if (!session || typeof session.id !== "string") {
    throw new UserFacingError("You must be signed in to view analytics.");
  }
  return session;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const ACTIVE_OPPORTUNITY_STATUSES = [
  LeadStatus.CONTACTED,
  LeadStatus.QUALIFIED,
  LeadStatus.PROPOSAL_SENT,
] as const;

const PIPELINE_STAGE_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL_SENT: "Proposal Sent",
  WON: "Won",
  LOST: "Lost",
};

const ALL_STATUSES: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.QUALIFIED,
  LeadStatus.PROPOSAL_SENT,
  LeadStatus.WON,
  LeadStatus.LOST,
];

const STAGE_RANK: Record<LeadStatus, number> = {
  NEW: 0,
  CONTACTED: 1,
  QUALIFIED: 2,
  PROPOSAL_SENT: 3,
  WON: 4,
  LOST: -1,
};

// Valid date range values — used to validate incoming param
const VALID_RANGES = new Set<string>(["7d", "30d", "90d", "all"]);

// ─── Main Loader ───────────────────────────────────────────────────────────────

/**
 * Returns the full analytics payload for the requested date range.
 *
 * dateRange controls the cohort window for:
 *   - coreMetrics (total leads, status counts, win rate, won revenue, avg won deal)
 *   - funnel (cumulative reached stages & conversions for the cohort)
 *   - revenueTrend / leadTrend
 *
 * openPipelineValue is always a CURRENT snapshot of active opportunities.
 * followUpPerformance is also a CURRENT snapshot based on current time.
 */
/**
 * Core analytics calculation service.
 * Performs all queries and calculations with canonical source-of-truth rules.
 */
export async function calculateSalesAnalytics(
  rawRange: string = "30d"
): Promise<AnalyticsData> {
  // Sanitize incoming param
  const dateRange: DateRange = VALID_RANGES.has(rawRange)
    ? (rawRange as DateRange)
    : "30d";

    const now = new Date();
    const { start, end } = getDateRangeBoundaries(dateRange, now);
    const granularity = getTrendGranularity(dateRange);

    // Prisma date filter for cohort leads (based on createdAt)
    const dateFilter = start ? { gte: start, lte: end } : undefined;

    // ─── Parallel Query Execution ─────────────────────────────────────────────
    const [
      // 1. Cohort leads matching selected date range with attached Deal
      cohortLeads,

      // 2. Active opportunities for live open pipeline (any creation date)
      activeOpportunities,

      // 3. All follow-ups on active non-waste leads (current snapshot)
      followUpsOnActiveLeads,

      // 4. Earliest LeadActivity record for coverage metadata
      earliestActivity,

      // 5. STATUS_CHANGED to WON activities for revenue timestamps
      wonActivities,

      // 6. STATUS_CHANGED activities for LOST cohort leads (if any reached later stages)
      lostActivities,

      // 7. All active non-waste leads currently in CRM (for live pipeline health)
      allActiveLeads,
    ] = await Promise.all([
      // 1: Cohort leads
      db.lead.findMany({
        where: {
          deletedAt: null,
          isWaste: false,
          mergedIntoLeadId: null,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        include: {
          deal: true,
        },
        orderBy: { createdAt: "asc" },
      }),

      // 2: Active opportunities (CONTACTED, QUALIFIED, PROPOSAL_SENT)
      db.lead.findMany({
        where: {
          status: { in: [...ACTIVE_OPPORTUNITY_STATUSES] },
          deletedAt: null,
          isWaste: false,
          mergedIntoLeadId: null,
        },
        include: {
          deal: true,
        },
      }),

      // 3: Follow-ups on active non-waste leads
      db.followUp.findMany({
        where: {
          lead: {
            deletedAt: null,
            isWaste: false,
            mergedIntoLeadId: null,
          },
        },
        select: {
          id: true,
          type: true,
          status: true,
          scheduledAt: true,
        },
      }),

      // 4: Earliest activity record
      db.leadActivity.findFirst({
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),

      // 5: WON status change activities
      db.leadActivity.findMany({
        where: {
          type: ActivityType.STATUS_CHANGED,
          metadata: { path: ["to"], equals: "WON" },
          lead: { deletedAt: null, isWaste: false, mergedIntoLeadId: null },
        },
        select: {
          leadId: true,
          createdAt: true,
        },
      }),

      // 6: LOST cohort activities (to check if any reached later stages historically)
      db.leadActivity.findMany({
        where: {
          type: ActivityType.STATUS_CHANGED,
          lead: {
            status: LeadStatus.LOST,
            deletedAt: null,
            isWaste: false,
            mergedIntoLeadId: null,
            ...(dateFilter ? { createdAt: dateFilter } : {}),
          },
        },
        select: {
          leadId: true,
          metadata: true,
        },
      }),

      // 7: All active leads for current pipeline health
      db.lead.findMany({
        where: {
          deletedAt: null,
          isWaste: false,
          mergedIntoLeadId: null,
        },
        include: {
          deal: true,
        },
      }),
    ]);

    // ─── 1. Canonical Status Counts for Cohort ─────────────────────────────────
    const totalLeads = cohortLeads.length;

    let newLeads = 0;
    let contactedLeads = 0;
    let qualifiedLeads = 0;
    let proposalSent = 0;
    let wonLeads = 0;
    let lostLeads = 0;

    for (const lead of cohortLeads) {
      switch (lead.status) {
        case LeadStatus.NEW:
          newLeads++;
          break;
        case LeadStatus.CONTACTED:
          contactedLeads++;
          break;
        case LeadStatus.QUALIFIED:
          qualifiedLeads++;
          break;
        case LeadStatus.PROPOSAL_SENT:
          proposalSent++;
          break;
        case LeadStatus.WON:
          wonLeads++;
          break;
        case LeadStatus.LOST:
          lostLeads++;
          break;
      }
    }

    // Closed deals & win/loss rates
    const closedDeals = wonLeads + lostLeads;
    const winRate = safeRate(wonLeads, closedDeals);
    const lostRate = safeRate(lostLeads, closedDeals);

    // ─── 2. Won Revenue & Average Won Deal ────────────────────────────────────
    // Won Revenue = sum of Deal.finalAmount for WON leads with an associated Deal
    // Average Won Deal = Won Revenue / number of WON deals that actually have finalAmount
    let wonRevenue = 0;
    let wonDealsCount = 0;

    for (const lead of cohortLeads) {
      if (lead.status === LeadStatus.WON && lead.deal) {
        const finalAmount = Number(lead.deal.finalAmount) || 0;
        if (finalAmount > 0) {
          wonRevenue += finalAmount;
          wonDealsCount++;
        }
      }
    }

    const avgWonDeal = safeRate(wonRevenue, wonDealsCount);

    // ─── 3. Open Pipeline Value ───────────────────────────────────────────────
    // Active opportunities only: CONTACTED, QUALIFIED, PROPOSAL_SENT
    // Prefer: Deal.finalAmount if confirmed
    // Fallback: Lead.quotedAmount if present
    let openPipelineValue = 0;
    for (const opp of activeOpportunities) {
      if (opp.deal?.status === "CONFIRMED" && Number(opp.deal.finalAmount) > 0) {
        openPipelineValue += Number(opp.deal.finalAmount);
      } else if (opp.quotedAmount != null) {
        openPipelineValue += serializeDecimal(opp.quotedAmount);
      }
    }

    // ─── 4. Overdue Follow-ups & Follow-up Performance ────────────────────────
    let fuCompleted = 0;
    let fuPending = 0;
    let overdueCount = 0;

    const fuTypeMap = new Map<
      string,
      { total: number; completed: number; pending: number; overdue: number }
    >();
    for (const t of ["CALL", "WHATSAPP", "EMAIL", "OTHER"] as const) {
      fuTypeMap.set(t, { total: 0, completed: 0, pending: 0, overdue: 0 });
    }

    for (const fu of followUpsOnActiveLeads) {
      const entry = fuTypeMap.get(fu.type) ?? {
        total: 0,
        completed: 0,
        pending: 0,
        overdue: 0,
      };
      entry.total++;

      if (fu.status === FollowUpStatus.COMPLETED) {
        fuCompleted++;
        entry.completed++;
      } else if (fu.status === FollowUpStatus.PENDING) {
        fuPending++;
        entry.pending++;
        if (fu.scheduledAt < now) {
          overdueCount++;
          entry.overdue++;
        }
      }
      fuTypeMap.set(fu.type, entry);
    }

    const followUpsCreated = followUpsOnActiveLeads.length;
    const completionDenominator = fuCompleted + fuPending;
    const completionRate = safeRate(fuCompleted, completionDenominator);

    const followUpByType: FollowUpBreakdown[] = (
      ["CALL", "WHATSAPP", "EMAIL", "OTHER"] as const
    ).map((type) => {
      const entry = fuTypeMap.get(type)!;
      return {
        type,
        total: entry.total,
        created: entry.total,
        completed: entry.completed,
        pending: entry.pending,
        overdue: entry.overdue,
      };
    });

    // ─── 5. Current Funnel Counts & Conversion ────────────────────────────────
    // Snapshot funnel analytics using cumulative reached-stage counts.
    // Contacted+ = CONTACTED + QUALIFIED + PROPOSAL_SENT + WON
    // Qualified+ = QUALIFIED + PROPOSAL_SENT + WON
    // Proposal+  = PROPOSAL_SENT + WON
    // Won        = WON
    // LOST is only counted if historical activity explicitly proves reaching later stages.

    const lostHighestRank = new Map<string, number>();
    for (const act of lostActivities) {
      const meta = act.metadata as { to?: string } | null;
      if (meta?.to && meta.to in STAGE_RANK) {
        const rank = STAGE_RANK[meta.to as LeadStatus];
        const current = lostHighestRank.get(act.leadId) ?? 0;
        if (rank > current) {
          lostHighestRank.set(act.leadId, rank);
        }
      }
    }

    let lostReachedContacted = 0;
    let lostReachedQualified = 0;
    let lostReachedProposal = 0;

    for (const rank of lostHighestRank.values()) {
      if (rank >= STAGE_RANK.CONTACTED) lostReachedContacted++;
      if (rank >= STAGE_RANK.QUALIFIED) lostReachedQualified++;
      if (rank >= STAGE_RANK.PROPOSAL_SENT) lostReachedProposal++;
    }

    const wonReached = wonLeads;
    const proposalReached = proposalSent + wonLeads + lostReachedProposal;
    const qualifiedReached = qualifiedLeads + proposalSent + wonLeads + lostReachedQualified;
    const contactedReached = contactedLeads + qualifiedLeads + proposalSent + wonLeads + lostReachedContacted;
    const newReached = totalLeads;

    const funnel: FunnelStage[] = [
      {
        label: PIPELINE_STAGE_LABELS[LeadStatus.NEW],
        status: LeadStatus.NEW,
        reached: newReached,
        conversionFromPrev: null,
      },
      {
        label: PIPELINE_STAGE_LABELS[LeadStatus.CONTACTED],
        status: LeadStatus.CONTACTED,
        reached: contactedReached,
        conversionFromPrev: safeRate(contactedReached, newReached),
      },
      {
        label: PIPELINE_STAGE_LABELS[LeadStatus.QUALIFIED],
        status: LeadStatus.QUALIFIED,
        reached: qualifiedReached,
        conversionFromPrev: safeRate(qualifiedReached, contactedReached),
      },
      {
        label: PIPELINE_STAGE_LABELS[LeadStatus.PROPOSAL_SENT],
        status: LeadStatus.PROPOSAL_SENT,
        reached: proposalReached,
        conversionFromPrev: safeRate(proposalReached, qualifiedReached),
      },
      {
        label: PIPELINE_STAGE_LABELS[LeadStatus.WON],
        status: LeadStatus.WON,
        reached: wonReached,
        conversionFromPrev: safeRate(wonReached, proposalReached),
      },
    ];

    // ─── 6. Revenue Trend ─────────────────────────────────────────────────────
    const wonTimestampMap = new Map<string, Date>();
    for (const act of wonActivities) {
      wonTimestampMap.set(act.leadId, act.createdAt);
    }

    const revenueBuckets = new Map<
      string,
      { revenue: number; estimatedCount: number; leadCount: number }
    >();
    let revenueLegacyCount = 0;

    const wonLeadsForTrend = cohortLeads.filter((l) => l.status === LeadStatus.WON);
    for (const lead of wonLeadsForTrend) {
      const reliableTs = wonTimestampMap.get(lead.id);
      const isEstimated = !reliableTs;
      if (isEstimated) revenueLegacyCount++;

      const timestamp = reliableTs ?? lead.updatedAt;
      const label = bucketLabel(timestamp, granularity);
      const amount = lead.deal ? Number(lead.deal.finalAmount) || 0 : 0;

      const bucket = revenueBuckets.get(label) ?? {
        revenue: 0,
        estimatedCount: 0,
        leadCount: 0,
      };
      bucket.revenue += amount;
      bucket.leadCount++;
      if (isEstimated) bucket.estimatedCount++;
      revenueBuckets.set(label, bucket);
    }

    const revenueLabels =
      dateRange === "all"
        ? Array.from(revenueBuckets.keys()).sort()
        : generateBucketLabels(dateRange, granularity, now);

    const revenueTrend: TrendPoint[] = revenueLabels.map((label) => {
      const bucket = revenueBuckets.get(label);
      return {
        label,
        revenue: bucket?.revenue ?? 0,
        isEstimated: (bucket?.estimatedCount ?? 0) > 0,
        leadCount: bucket?.leadCount ?? 0,
      };
    });

    // ─── 7. Lead Trend ────────────────────────────────────────────────────────
    const leadBuckets = new Map<string, number>();
    for (const lead of cohortLeads) {
      const label = bucketLabel(lead.createdAt, granularity);
      leadBuckets.set(label, (leadBuckets.get(label) ?? 0) + 1);
    }

    const leadLabels =
      dateRange === "all"
        ? Array.from(leadBuckets.keys()).sort()
        : generateBucketLabels(dateRange, granularity, now);

    const leadTrendPoints: LeadTrendPoint[] = leadLabels.map((label) => {
      const count = leadBuckets.get(label) ?? 0;
      return {
        label,
        date: label,
        count,
        value: count,
      };
    });

    const leadTrend = { points: leadTrendPoints };

    // ─── 8. Pipeline Health (Current Live Snapshot across All Statuses) ───────
    const pipelineHealthStages: PipelineStageHealth[] = ALL_STATUSES.map((stage) => {
      const leadsInStage = allActiveLeads.filter((l) => l.status === stage);
      let value = 0;
      for (const lead of leadsInStage) {
        if (stage === LeadStatus.LOST) {
          value += 0;
        } else if (lead.deal?.status === "CONFIRMED" && Number(lead.deal.finalAmount) > 0) {
          value += Number(lead.deal.finalAmount);
        } else if (stage === LeadStatus.WON && lead.deal) {
          value += Number(lead.deal.finalAmount) || 0;
        } else if (lead.quotedAmount != null) {
          value += serializeDecimal(lead.quotedAmount);
        }
      }
      return {
        stage,
        label: PIPELINE_STAGE_LABELS[stage],
        count: leadsInStage.length,
        value,
      };
    });

    const pipelineHealth = { stages: pipelineHealthStages };

    // ─── 9. Data Coverage ─────────────────────────────────────────────────────
    const activityStart = earliestActivity?.createdAt ?? null;
    let legacyLeadCount = 0;
    if (activityStart) {
      legacyLeadCount = await db.lead.count({
        where: { isWaste: false, deletedAt: null, createdAt: { lt: activityStart } },
      });
    }

    const dataCoverage: DataCoverage = {
      analysisStart: start ? start.toISOString() : null,
      activityHistoryCoverageStart: activityStart ? activityStart.toISOString() : null,
      legacyLeadCount,
      funnelWarning: false,
      revenueLegacyCount,
    };

    // ─── 10. Assemble Final DTO ───────────────────────────────────────────────
    const coreMetrics: CoreMetrics = {
      totalLeads,
      newLeads,
      contactedLeads,
      qualifiedLeads,
      proposalSent,
      wonLeads,
      lostLeads,
      winRate,
      lostRate,
      wonRevenue,
      openPipelineValue,
      avgWonDeal,
      followUpsCreated,
      followUpsCompleted: fuCompleted,
      overdueFollowUps: overdueCount,
    };

    const data: AnalyticsData = {
      meta: {
        dateRange,
        generatedAt: now.toISOString(),
      },
      coreMetrics,
      kpis: coreMetrics,
      funnel,
      revenueTrend,
      leadTrend,
      winLoss: {
        won: wonLeads,
        lost: lostLeads,
        winRate: closedDeals > 0 ? Math.round((wonLeads / closedDeals) * 10000) / 100 : 0,
        lostRate: closedDeals > 0 ? Math.round((lostLeads / closedDeals) * 10000) / 100 : 0,
      },
      followUpPerformance: {
        created: followUpsCreated,
        completed: fuCompleted,
        pending: fuPending,
        overdue: overdueCount,
        completionRate,
        byType: followUpByType,
      },
      pipelineHealth,
      dataCoverage,
    };

    return data;
}

/**
 * Single canonical analytics calculation service alias
 */
export const getSalesAnalytics = calculateSalesAnalytics;

/**
 * Authenticated Server Action loader for /analytics
 */
export async function getAnalyticsData(
  rawRange: string = "30d"
): Promise<AnalyticsResult> {
  try {
    await requireAuth();
    const data = await calculateSalesAnalytics(rawRange);
    return { success: true, data };
  } catch (error) {
    if (error instanceof UserFacingError) {
      return { success: false, error: error.message };
    }
    console.error("[analytics] Unexpected error:", error);
    return { success: false, error: "Could not load analytics data." };
  }
}
