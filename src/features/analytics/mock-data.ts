/**
 * Analytics Mock Data — Phase 6
 *
 * ⚠️  AGENT A: This file is NOT used in production — the page already calls
 *     getAnalyticsData() from @/app/actions/analytics.
 *
 *     This mock was used during UI scaffolding only.
 *     You can safely delete this file and the import below:
 *       import { getMockAnalyticsData } from "@/features/analytics/mock-data";
 *
 *     It is intentionally isolated so removal is trivial.
 */

import type { AnalyticsData, DateRange } from "@/features/analytics/types";

export function getMockAnalyticsData(_range: DateRange): AnalyticsData {
  const cm = {
    totalLeads: 84,
    newLeads: 12,
    qualifiedLeads: 18,
    proposalSent: 5,
    wonLeads: 12,
    lostLeads: 30,
    winRate: 0.286,
    lostRate: 0.714,
    wonRevenue: 1_840_000,
    openPipelineValue: 3_200_000,
    avgWonDeal: 153_333,
    followUpsCreated: 142,
    followUpsCompleted: 98,
    overdueFollowUps: 7,
  };

  return {
    meta: {
      dateRange: _range,
      generatedAt: new Date().toISOString(),
    },
    coreMetrics: cm,
    kpis: cm,
    funnel: [
      { label: "New", status: "NEW", reached: 84, conversionFromPrev: null },
      { label: "Contacted", status: "CONTACTED", reached: 61, conversionFromPrev: 0.726 },
      { label: "Qualified", status: "QUALIFIED", reached: 38, conversionFromPrev: 0.623 },
      { label: "Proposal Sent", status: "PROPOSAL_SENT", reached: 24, conversionFromPrev: null },
      { label: "Won", status: "WON", reached: 12, conversionFromPrev: 0.5 },
    ],

    revenueTrend: [
      { label: "Aug 19", revenue: 0, isEstimated: false, leadCount: 0 },
      { label: "Aug 26", revenue: 180_000, isEstimated: true, leadCount: 1 },
      { label: "Sep 2", revenue: 320_000, isEstimated: false, leadCount: 2 },
      { label: "Sep 9", revenue: 610_000, isEstimated: false, leadCount: 3 },
      { label: "Sep 15", revenue: 730_000, isEstimated: false, leadCount: 6 },
    ],
    leadTrend: {
      points: [
        { label: "Aug 19", date: "Aug 19", count: 8, value: 8 },
        { label: "Aug 26", date: "Aug 26", count: 14, value: 14 },
        { label: "Sep 2", date: "Sep 2", count: 21, value: 21 },
        { label: "Sep 9", date: "Sep 9", count: 19, value: 19 },
        { label: "Sep 15", date: "Sep 15", count: 22, value: 22 },
      ],
    },
    followUpPerformance: {
      created: 142,
      completed: 98,
      pending: 37,
      overdue: 7,
      completionRate: 0.69,
      byType: [
        { type: "CALL", total: 62, created: 62, completed: 44, pending: 15, overdue: 3 },
        { type: "WHATSAPP", total: 48, created: 48, completed: 35, pending: 10, overdue: 3 },
        { type: "EMAIL", total: 24, created: 24, completed: 16, pending: 7, overdue: 1 },
        { type: "OTHER", total: 8, created: 8, completed: 3, pending: 5, overdue: 0 },
      ],
    },
    winLoss: {
      won: 12,
      lost: 30,
      winRate: 28.57,
      lostRate: 71.43,
    },
    pipelineHealth: {
      stages: [
        { stage: "NEW", label: "New", count: 12, value: 480_000 },
        { stage: "CONTACTED", label: "Contacted", count: 9, value: 720_000 },
        { stage: "QUALIFIED", label: "Qualified", count: 6, value: 1_100_000 },
        { stage: "PROPOSAL_SENT", label: "Proposal Sent", count: 5, value: 900_000 },
        { stage: "WON", label: "Won", count: 12, value: 1_840_000 },
        { stage: "LOST", label: "Lost", count: 30, value: 0 },
      ]
    },
    dataCoverage: {
      analysisStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      activityHistoryCoverageStart: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      legacyLeadCount: 14,
      funnelWarning: true,
      revenueLegacyCount: 1,
    },
  };
}
