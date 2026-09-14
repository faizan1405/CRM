"use server";

/**
 * Phase 6 – Analytics Server Action
 *
 * getAnalyticsData(dateRange) is the single authenticated loader for /analytics.
 *
 * Design principles:
 *  - All independent queries run in Promise.all (no waterfall)
 *  - Prisma aggregates/groupBy used instead of full row fetches where possible
 *  - No raw Prisma objects returned to the client
 *  - Decimal fields serialized to number via serializeDecimal()
 *  - Date fields serialized to ISO strings
 *  - Session validated before any DB query
 *  - Data honesty: incomplete historical data is flagged, never fabricated
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

const ACTIVE_STATUSES = [
  LeadStatus.NEW,
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

// Valid date range values — used to validate the incoming param
const VALID_RANGES = new Set<string>(["7d", "30d", "90d", "all"]);

// ─── Main Loader ───────────────────────────────────────────────────────────────

/**
 * Returns the full analytics payload for the requested date range.
 *
 * dateRange controls the analysis window for:
 *   - coreMetrics (lead counts, revenue)
 *   - funnel
 *   - revenueTrend / leadTrend
 *
 * openPipelineValue is always a CURRENT snapshot (not date-filtered)
 * because the pipeline reflects today's state, not historical creation dates.
 *
 * followUpPerformance is also current-snapshot — overdue is based on now.
 */
export async function getAnalyticsData(
  rawRange: string = "30d"
): Promise<AnalyticsResult> {
  try {
    await requireAuth();

    // Sanitize incoming param
    const dateRange: DateRange = VALID_RANGES.has(rawRange)
      ? (rawRange as DateRange)
      : "30d";

    const now = new Date();
    const { start, end } = getDateRangeBoundaries(dateRange, now);
    const granularity = getTrendGranularity(dateRange);

    // Build Prisma date filter (used for date-filtered queries)
    const dateFilter = start ? { gte: start, lte: end } : undefined;

    // ─── Parallel Query Block ────────────────────────────────────────────────
    // All independent queries execute concurrently.
    // Each query is annotated with what it computes.

    const [
      // 1. Per-status counts + revenue for leads in the date range
      statusGrouped,

      // 2. WON leads in range with valid quotedAmount (for avg deal calculation)
      wonWithAmountCount,

      // 3. Open pipeline — CURRENT snapshot (not date-filtered)
      openPipelineAgg,

      // 4. Follow-up status breakdown (current snapshot)
      followUpStatusGrouped,

      // 5. Follow-up type × status breakdown (current snapshot)
      followUpTypeGrouped,

      // 6. Overdue pending follow-ups (scheduledAt < now)
      overdueGrouped,

      // 7. Earliest LeadActivity record — establishes activity tracking start
      earliestActivity,

      // 8. WON activities with STATUS_CHANGED for reliable revenue timestamps
      wonActivities,


      // 10. All leads in range for funnel analysis (status + activity metadata)
      leadsForFunnel,

      // 11. Leads in range for lead trend (createdAt only)
      leadsForTrend,

      // 12. Full pipeline health (current snapshot — all statuses)
      pipelineHealthGrouped,
    ] = await Promise.all([
      // 1 — Status counts + revenue sums within date range
      db.lead.groupBy({
        by: ["status"],
        _count: true,
        _sum: { quotedAmount: true },
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),

      // 2 — Count WON leads that have a quotedAmount (for avg won deal)
      db.lead.count({
        where: {
          status: LeadStatus.WON,
          quotedAmount: { not: null },
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
      }),

      // 3 — Open pipeline: current active leads, any creation date
      db.lead.aggregate({
        _sum: { quotedAmount: true },
        where: { status: { in: [...ACTIVE_STATUSES] } },
      }),

      // 4 — Follow-up status counts (for completion metrics)
      db.followUp.groupBy({
        by: ["status"],
        _count: true,
      }),

      // 5 — Follow-up type × status (for byType breakdown)
      db.followUp.groupBy({
        by: ["type", "status"],
        _count: true,
      }),

      // 6 — Overdue: PENDING follow-ups scheduled before now by type
      db.followUp.groupBy({
        by: ["type"],
        _count: true,
        where: {
          status: FollowUpStatus.PENDING,
          scheduledAt: { lt: now },
        },
      }),

      // 7 — Earliest activity record to determine coverage start
      db.leadActivity.findFirst({
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),

      // 8 — STATUS_CHANGED → WON activities (for reliable revenue timestamps)
      // metadata shape set by Phase 5: { from: "...", to: "WON" }
      db.leadActivity.findMany({
        where: {
          type: ActivityType.STATUS_CHANGED,
          // Filter for activities where metadata.to = "WON"
          // Using Prisma JSON path filter
          metadata: { path: ["to"], equals: "WON" },
        },
        select: {
          leadId: true,
          createdAt: true,
        },
      }),


      // 10 — Funnel: lead statuses (activity queried separately below for efficiency)
      db.lead.findMany({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
        select: {
          id: true,
          status: true,
          createdAt: true,
        },
      }),

      // 11 — Lead trend: just createdAt
      db.lead.findMany({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
        select: { createdAt: true },
      }),

      // 12 — Pipeline health: current snapshot by status + value
      db.lead.groupBy({
        by: ["status"],
        _count: true,
        _sum: { quotedAmount: true },
      }),
    ]);

    // ─── Activity coverage calculation ────────────────────────────────────────

    const activityStart = earliestActivity?.createdAt ?? null;

    // Count leads created before activity tracking started (legacy leads)
    let legacyLeadCount = 0;
    if (activityStart) {
      legacyLeadCount = await db.lead.count({
        where: { createdAt: { lt: activityStart } },
      });
    }

    // funnel warning: analysis window predates activity tracking
    const funnelWarning: boolean =
      activityStart !== null &&
      (start === null || start < activityStart);

    // ─── Core Metrics ─────────────────────────────────────────────────────────

    // Build a lookup map: status → { count, sumQuoted }
    const statusMap = new Map<
      string,
      { count: number; sumQuoted: number }
    >();
    for (const row of statusGrouped) {
      statusMap.set(row.status, {
        count: row._count,
        sumQuoted: serializeDecimal(row._sum.quotedAmount),
      });
    }

    const getCount = (s: LeadStatus) => statusMap.get(s)?.count ?? 0;
    const getSum = (s: LeadStatus) => statusMap.get(s)?.sumQuoted ?? 0;

    const totalLeads = Array.from(statusMap.values()).reduce(
      (acc, v) => acc + v.count,
      0
    );
    const wonLeads = getCount(LeadStatus.WON);
    const lostLeads = getCount(LeadStatus.LOST);
    const wonRevenue = getSum(LeadStatus.WON);
    const openPipelineValue = serializeDecimal(openPipelineAgg._sum.quotedAmount);

    // Average won deal: wonRevenue / WON leads with a valid quotedAmount
    const avgWonDeal = safeRate(wonRevenue, wonWithAmountCount);

    // Win/loss rates over CLOSED deals only
    const closedDeals = wonLeads + lostLeads;
    const winRate = safeRate(wonLeads, closedDeals);
    const lostRate = safeRate(lostLeads, closedDeals);

    // Follow-up stats from groupBy
    const fuStatusMap = new Map<string, number>();
    for (const row of followUpStatusGrouped) {
      fuStatusMap.set(row.status, row._count);
    }
    const fuCompleted = fuStatusMap.get(FollowUpStatus.COMPLETED) ?? 0;
    const fuPending = fuStatusMap.get(FollowUpStatus.PENDING) ?? 0;
    const fuTotal = (fuStatusMap.get(FollowUpStatus.COMPLETED) ?? 0) +
      (fuStatusMap.get(FollowUpStatus.PENDING) ?? 0) +
      (fuStatusMap.get(FollowUpStatus.CANCELLED) ?? 0);

    // followUpsCreated: total follow-ups (all statuses)
    const followUpsCreated = fuTotal;

    const overdueCount = overdueGrouped.reduce((acc, row) => acc + row._count, 0);

    // Completion rate = Completed / (Completed + Pending + Overdue)
    // Cancelled is excluded — they were abandoned, not "outstanding"
    const completionDenominator = fuCompleted + fuPending; // Pending already includes overdue
    const completionRate = safeRate(fuCompleted, completionDenominator);

    // ─── Follow-up Type Breakdown ─────────────────────────────────────────────

    // Build map: type → { total, completed, pending }
    const fuTypeMap = new Map<
      string,
      { total: number; completed: number; pending: number }
    >();
    for (const row of followUpTypeGrouped) {
      const entry = fuTypeMap.get(row.type) ?? { total: 0, completed: 0, pending: 0 };
      entry.total += row._count;
      if (row.status === FollowUpStatus.COMPLETED) {
        entry.completed += row._count;
      }
      if (row.status === FollowUpStatus.PENDING) {
        entry.pending += row._count;
      }
      fuTypeMap.set(row.type, entry);
    }
    
    const overdueTypeMap = new Map<string, number>();
    for (const row of overdueGrouped) {
      overdueTypeMap.set(row.type, row._count);
    }

    const followUpByType: FollowUpBreakdown[] = (
      ["CALL", "WHATSAPP", "EMAIL", "OTHER"] as const
    ).map((type) => {
      const total = fuTypeMap.get(type)?.total ?? 0;
      const completed = fuTypeMap.get(type)?.completed ?? 0;
      const pending = fuTypeMap.get(type)?.pending ?? 0;
      const overdue = overdueTypeMap.get(type) ?? 0;
      
      return {
        type,
        total,
        created: total,
        completed,
        pending,
        overdue,
      };
    });

    // ─── Funnel ───────────────────────────────────────────────────────────────
    //
    // Strategy:
    //  - For leads with activity history: use STATUS_CHANGED activities to
    //    determine the highest stage a lead reached within the analysis period.
    //  - For legacy leads (before activity tracking): use current status as
    //    a floor — if their current status is QUALIFIED, they at least reached
    //    QUALIFIED. This is NOT fabrication; it's an honest minimum.
    //  - Conversion from prev is set to null if funnelWarning is true AND
    //    there are not enough activity-tracked leads to be reliable.
    //
    // Stage order for funnel (not including LOST):
    const FUNNEL_STAGES: LeadStatus[] = [
      LeadStatus.NEW,
      LeadStatus.CONTACTED,
      LeadStatus.QUALIFIED,
      LeadStatus.PROPOSAL_SENT,
      LeadStatus.WON,
    ];

    // Stage rank: higher = further in the funnel
    const stageRank: Record<LeadStatus, number> = {
      NEW: 0,
      CONTACTED: 1,
      QUALIFIED: 2,
      PROPOSAL_SENT: 3,
      WON: 4,
      LOST: 5, // LOST treated as "reached at least PROPOSAL_SENT" for funnel purposes
    };

    // For funnel, count how many leads "reached" each stage.
    // A lead REACHED stage X if its current status has rank >= X.
    // (LOST leads are treated as having reached the stage before they were lost,
    //  but since we don't know which stage they were at when lost without activity,
    //  we use their current status which is LOST. We include them at stage 0 only.)
    //
    // More precise: use STATUS_CHANGED activities to find the highest stage reached.

    // Build a map: leadId → highestStageRank reached (from activity log)
    // Fetch STATUS_CHANGED activities for all leads in the analysis period
    const funnelLeadIds = leadsForFunnel.map((l) => l.id);

    let stageActivities: Array<{ leadId: string; metadata: unknown }> = [];
    if (funnelLeadIds.length > 0) {
      stageActivities = await db.leadActivity.findMany({
        where: {
          leadId: { in: funnelLeadIds },
          type: ActivityType.STATUS_CHANGED,
        },
        select: { leadId: true, metadata: true },
      });
    }

    // Build highestStageReached map from activities
    const highestFromActivity = new Map<string, number>();
    for (const act of stageActivities) {
      const meta = act.metadata as { from?: string; to?: string } | null;
      if (!meta?.to) continue;
      const toStatus = meta.to as LeadStatus;
      if (!(toStatus in stageRank)) continue;
      const rank = toStatus === LeadStatus.LOST
        ? stageRank[LeadStatus.PROPOSAL_SENT] // lost leads reached at least proposal (assumption) — only if activity says so
        : stageRank[toStatus];
      const current = highestFromActivity.get(act.leadId) ?? -1;
      if (rank > current) {
        highestFromActivity.set(act.leadId, rank);
      }
    }

    // For leads without activity data, fall back to current status rank
    // (honest minimum — they currently are at least at this stage)
    const highestStageByLead = new Map<string, number>();
    for (const lead of leadsForFunnel) {
      const activityRank = highestFromActivity.get(lead.id);
      if (activityRank !== undefined) {
        highestStageByLead.set(lead.id, activityRank);
      } else {
        // No activity data — use current status as floor
        const currentRank = stageRank[lead.status];
        // For LOST with no activity, we don't know which stage they reached, 
        // so only count them at rank 0 (NEW) — they at least entered the funnel
        highestStageByLead.set(lead.id, lead.status === LeadStatus.LOST ? 0 : currentRank);
      }
    }

    // Count how many leads reached each funnel stage
    const reachedCounts = FUNNEL_STAGES.map((stage) => {
      const rank = stageRank[stage];
      let count = 0;
      for (const highestRank of highestStageByLead.values()) {
        if (highestRank >= rank) count++;
      }
      return count;
    });

    const funnel: FunnelStage[] = FUNNEL_STAGES.map((stage, i) => {
      const reached = reachedCounts[i];
      let conversionFromPrev: number | null = null;

      if (i > 0) {
        const prevReached = reachedCounts[i - 1];
        if (prevReached > 0) {
          // If funnelWarning is active AND we have no activity data for many leads,
          // mark conversion as unreliable (null) for stages beyond NEW
          conversionFromPrev = funnelWarning && i > 1
            ? null // Cannot reliably compute intermediate conversions without full history
            : safeRate(reached, prevReached);
        }
        // If funnelWarning is false, compute normally for all stages
        if (!funnelWarning && prevReached > 0) {
          conversionFromPrev = safeRate(reached, prevReached);
        }
      }

      return {
        label: PIPELINE_STAGE_LABELS[stage],
        status: stage,
        reached,
        conversionFromPrev,
      };
    });

    // ─── Revenue Trend ────────────────────────────────────────────────────────
    //
    // For each WON lead:
    //  1. Try to find a STATUS_CHANGED → WON activity timestamp (reliable)
    //  2. Fall back to Lead.updatedAt with isEstimated=true (legacy)
    //
    // Fetch WON leads with updatedAt for fallback
    const wonLeadsForTrend = await db.lead.findMany({
      where: {
        status: LeadStatus.WON,
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      select: {
        id: true,
        quotedAmount: true,
        updatedAt: true,
      },
    });

    // Build map: leadId → reliable WON timestamp from activity
    const wonTimestampMap = new Map<string, Date>();
    for (const act of wonActivities) {
      wonTimestampMap.set(act.leadId, act.createdAt);
    }

    // Build revenue trend buckets
    const revenueBuckets = new Map<
      string,
      { revenue: number; estimatedCount: number; leadCount: number }
    >();
    let revenueLegacyCount = 0;

    for (const lead of wonLeadsForTrend) {
      const reliableTs = wonTimestampMap.get(lead.id);
      const isEstimated = !reliableTs;
      if (isEstimated) revenueLegacyCount++;

      const timestamp = reliableTs ?? lead.updatedAt;
      const label = bucketLabel(timestamp, granularity);
      const amount = serializeDecimal(lead.quotedAmount);

      const bucket = revenueBuckets.get(label) ?? {
        revenue: 0, estimatedCount: 0, leadCount: 0,
      };
      bucket.revenue += amount;
      bucket.leadCount++;
      if (isEstimated) bucket.estimatedCount++;
      revenueBuckets.set(label, bucket);
    }

    // Merge with complete label skeleton (so chart has all time points)
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

    // ─── Lead Trend ───────────────────────────────────────────────────────────

    const leadBuckets = new Map<string, number>();
    for (const lead of leadsForTrend) {
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

    // ─── Pipeline Health ──────────────────────────────────────────────────────

    const pipelineHealthMap = new Map<
      string,
      { count: number; value: number }
    >();
    for (const row of pipelineHealthGrouped) {
      pipelineHealthMap.set(row.status, {
        count: row._count,
        value: serializeDecimal(row._sum.quotedAmount),
      });
    }

    const ALL_STATUSES: LeadStatus[] = [
      LeadStatus.NEW,
      LeadStatus.CONTACTED,
      LeadStatus.QUALIFIED,
      LeadStatus.PROPOSAL_SENT,
      LeadStatus.WON,
      LeadStatus.LOST,
    ];

    const pipelineHealthStages: PipelineStageHealth[] = ALL_STATUSES.map((stage) => ({
      stage,
      label: PIPELINE_STAGE_LABELS[stage],
      count: pipelineHealthMap.get(stage)?.count ?? 0,
      value: pipelineHealthMap.get(stage)?.value ?? 0,
    }));
    
    const pipelineHealth = { stages: pipelineHealthStages };

    // ─── Data Coverage ────────────────────────────────────────────────────────

    const dataCoverage: DataCoverage = {
      analysisStart: start ? start.toISOString() : null,
      activityHistoryCoverageStart: activityStart ? activityStart.toISOString() : null,
      legacyLeadCount,
      funnelWarning,
      revenueLegacyCount,
    };

    // ─── Assemble Final DTO ───────────────────────────────────────────────────

    const data: AnalyticsData = {
      meta: {
        dateRange,
        generatedAt: now.toISOString(),
      },
      coreMetrics: {
        totalLeads,
        newLeads: getCount(LeadStatus.NEW),
        qualifiedLeads: getCount(LeadStatus.QUALIFIED),
        proposalSent: getCount(LeadStatus.PROPOSAL_SENT),
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
      },
      kpis: {
        totalLeads,
        newLeads: getCount(LeadStatus.NEW),
        qualifiedLeads: getCount(LeadStatus.QUALIFIED),
        proposalSent: getCount(LeadStatus.PROPOSAL_SENT),
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
      },
      funnel,
      revenueTrend,
      leadTrend,
      winLoss: {
        won: wonLeads,
        lost: lostLeads,
        winRate: Math.round(winRate * 10000) / 100,
        lostRate: Math.round(lostRate * 10000) / 100,
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

    return { success: true, data };
  } catch (error) {
    if (error instanceof UserFacingError) {
      return { success: false, error: error.message };
    }
    console.error("[analytics] Unexpected error:", error);
    return { success: false, error: "Could not load analytics data." };
  }
}
