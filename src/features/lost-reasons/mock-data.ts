import type { LostReasonsAnalyticsData, LostLeadDetailProps } from "./types";

/**
 * Isolated mock data for Lost Reasons feature.
 * TRIVIAL TO DELETE LATER once real backend integration is wired up.
 */

export const MOCK_LOST_REASONS_ANALYTICS: LostReasonsAnalyticsData = {
  totalLost: 47,
  period: "This Month (Sep 2026)",
  topReason: {
    reason: "Price",
    count: 15,
    percentage: 32,
  },
  breakdown: [
    { reason: "Price", count: 15, percentage: 32 },
    { reason: "No Response", count: 10, percentage: 21 },
    { reason: "Competitor", count: 7, percentage: 15 },
    { reason: "Timing", count: 5, percentage: 11 },
    { reason: "Trust", count: 3, percentage: 6 },
    { reason: "Requirement Changed", count: 3, percentage: 6 },
    { reason: "Not Qualified", count: 2, percentage: 4 },
    { reason: "No Urgency", count: 1, percentage: 2 },
    { reason: "Other", count: 1, percentage: 2 },
  ],
  aiInsight: "32% of lost leads this month were lost because of price.",
};

export const MOCK_LOST_LEAD_SAMPLE: LostLeadDetailProps = {
  reason: "Price",
  lostAt: "15 Sep 2026",
  notes: "Client felt the quotation was above budget.",
  leadName: "Rahul Sharma",
};

export const MOCK_LOST_LEADS_LIST: Array<LostLeadDetailProps & { id: string }> = [
  {
    id: "lost-1",
    leadName: "Rahul Sharma",
    reason: "Price",
    lostAt: "15 Sep 2026",
    notes: "Client felt the quotation was above budget.",
  },
  {
    id: "lost-2",
    leadName: "Priya Patel",
    reason: "Competitor",
    lostAt: "14 Sep 2026",
    notes: "Decided to renew with their legacy vendor for another year.",
  },
  {
    id: "lost-3",
    leadName: "Vikram Malhotra",
    reason: "No Response",
    lostAt: "12 Sep 2026",
    notes: "Unreachable across 4 WhatsApp touchpoints and 2 follow-up calls.",
  },
  {
    id: "lost-4",
    leadName: "Anita Desai",
    reason: "Timing",
    lostAt: "10 Sep 2026",
    notes: "Internal budget frozen until Q1 next fiscal year.",
  },
  {
    id: "lost-5",
    leadName: "Kunal Singhania",
    reason: "Other",
    lostAt: "08 Sep 2026",
    notes: "Company merged with parent conglomerate; procurement centralized.",
  },
];
