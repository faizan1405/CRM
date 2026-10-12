import type { BackupAnalytics } from "../../analytics";
import type { ReportBuilder } from "../report-builder";
import { canonicalFinanceNote, count, inr, pct, tableSection, type ReportContext } from "./shared";

export function monthlyRows(analytics: BackupAnalytics): string[][] {
  const keys = new Set<string>([
    ...analytics.monthly.leads.map((point) => point.key),
    ...analytics.monthly.deals.map((point) => point.key),
    ...analytics.monthly.payments.map((point) => point.key),
  ]);

  const leads = new Map(analytics.monthly.leads.map((point) => [point.key, point]));
  const deals = new Map(analytics.monthly.deals.map((point) => [point.key, point]));
  const payments = new Map(analytics.monthly.payments.map((point) => [point.key, point]));

  return [...keys]
    .sort((a, b) => a.localeCompare(b))
    .map((key) => {
      const lead = leads.get(key);
      const deal = deals.get(key);
      const payment = payments.get(key);
      return [
        lead?.label ?? deal?.label ?? payment?.label ?? key,
        count(lead?.count ?? 0),
        count(deal?.count ?? 0),
        inr(deal?.amount ?? 0),
        inr(payment?.amount ?? 0),
        count(payment?.count ?? 0),
      ];
    });
}

/**
 * 01 — CRM Overview: the management one-pager. Totals, distribution, sales performance, money,
 * receivables and follow-up health, followed by the historical monthly summary.
 */
export function renderOverview(builder: ReportBuilder, ctx: ReportContext): void {
  const { analytics: a } = ctx;

  builder.heading("Executive summary", "All-time, unfiltered snapshot of the complete CRM workspace.");
  builder.kpiCards(
    [
      {
        label: "Total leads",
        value: count(a.leads.total),
        hint: `${count(a.leads.current)} current · ${count(a.leads.historical)} historical`,
      },
      {
        label: "Won deal value",
        value: inr(a.deals.wonDealValue),
        hint: "Canonical won CRM deal value",
        tone: "positive",
      },
      {
        label: "Contracted deal value",
        value: inr(a.deals.contracted),
        hint: `${count(a.deals.total)} projects & deals`,
      },
      {
        label: "Money received",
        value: inr(a.deals.received),
        hint: `${count(a.payments.total)} payment transactions`,
        tone: "positive",
      },
      {
        label: "Outstanding",
        value: inr(a.deals.outstanding),
        hint: `${count(a.receivables.dealsWithBalance)} projects with balance`,
        tone: "warning",
      },
      {
        label: "Overdue balance",
        value: inr(a.receivables.overdueAmount),
        hint: `${count(a.receivables.overdueDealCount)} overdue projects`,
        tone: "critical",
      },
      {
        label: "Collection rate",
        value: pct(a.deals.collectionRate),
        hint: "Received ÷ contracted value",
        tone: "info",
      },
      {
        label: "Open pipeline value",
        value: inr(a.deals.openPipelineValue),
        hint: `${count(a.opportunities.length)} open opportunities`,
        tone: "info",
      },
      {
        label: "Active follow-ups",
        value: count(a.followUps.pending),
        hint: `${count(a.followUps.overdue)} overdue · ${count(a.followUps.dueToday)} due today`,
        tone: a.followUps.overdue > 0 ? "warning" : "positive",
      },
    ],
    3
  );

  builder.heading("Lead distribution", "Every lead on record, including waste, archived (deleted) and merged rows.");
  const totalLeads = a.leads.total || 1;
  tableSection(builder, {
    title: "Leads by status",
    columns: [
      { header: "Status", width: 1.3 },
      { header: "Leads", width: 0.7, align: "right" },
      { header: "Quoted value", width: 1.1, align: "right" },
      { header: "Share of leads", width: 0.9, align: "right" },
    ],
    rows: a.leads.byStatus.map((bucket) => [
      bucket.key,
      count(bucket.count),
      inr(bucket.amount),
      pct((bucket.count / totalLeads) * 100),
    ]),
    totals: [
      "Total leads",
      count(a.leads.total),
      inr(a.leads.quotedValue),
      pct(100),
    ],
    emptyMessage: "No leads recorded in this workspace.",
    fullDataSetFile: "Raw Data/leads.csv",
  });

  builder.barList(
    a.leads.byStatus.map((bucket) => ({
      label: bucket.key,
      value: bucket.count,
      display: count(bucket.count),
    })),
    { tone: "info", maxItems: 8, emptyMessage: "No lead status distribution available." }
  );

  builder.keyValueRows(
    [
      { label: "Current leads", value: count(a.leads.current) },
      { label: "Historical leads", value: count(a.leads.historical) },
      { label: "Waste leads", value: count(a.leads.waste) },
      { label: "Archived (deleted)", value: count(a.leads.archivedDeleted) },
      { label: "Merged away", value: count(a.leads.merged) },
      { label: "Pinned leads", value: count(a.leads.pinned) },
      { label: "Leads with quotes", value: `${count(a.leads.withQuotes)} · ${inr(a.leads.quotedValue)}` },
      { label: "Leads created (last 30 days)", value: count(a.leads.createdLast30Days) },
    ],
    2
  );

  tableSection(builder, {
    title: "Lead sources",
    columns: [
      { header: "Source", width: 2 },
      { header: "Leads", width: 0.7, align: "right" },
      { header: "Share", width: 0.7, align: "right" },
    ],
    rows: a.leads.bySource
      .slice(0, 12)
      .map((bucket) => [bucket.key, count(bucket.count), pct((bucket.count / totalLeads) * 100)]),
    emptyMessage: "No lead sources recorded.",
  });

  tableSection(builder, {
    title: "Industries",
    columns: [
      { header: "Industry", width: 2 },
      { header: "Leads", width: 0.7, align: "right" },
      { header: "Share", width: 0.7, align: "right" },
    ],
    rows: a.leads.byIndustry
      .slice(0, 12)
      .map((bucket) => [bucket.key, count(bucket.count), pct((bucket.count / totalLeads) * 100)]),
    emptyMessage: "No industry information recorded.",
  });

  builder.heading("Sales performance", "Won/lost outcomes and month-by-month momentum.");
  builder.kpiCards(
    [
      { label: "Projects won", value: count(a.deals.paidDeals + a.deals.partiallyPaidDeals), hint: "Paid + partially paid projects" },
      { label: "Won clients", value: count(a.leads.wonCount), hint: "Leads closed won", tone: "positive" },
      { label: "Lost clients", value: count(a.leads.lostCount), hint: "Leads closed lost", tone: "critical" },
      { label: "Win rate", value: pct(a.leads.winRate), hint: "Won ÷ (won + lost)", tone: "info" },
      { label: "Average payment", value: inr(a.payments.averagePayment), hint: `${count(a.payments.total)} payments` },
      { label: "Collected (last 30 days)", value: inr(a.payments.last30DaysAmount), hint: `${count(a.payments.last30DaysCount)} payments`, tone: "positive" },
    ],
    3
  );

  tableSection(builder, {
    title: "Historical monthly summary",
    description: "Leads created, projects created, contracted value and collections by calendar month (IST).",
    columns: [
      { header: "Month", width: 1.1 },
      { header: "Leads created", width: 0.9, align: "right" },
      { header: "Projects created", width: 0.9, align: "right" },
      { header: "Contracted value", width: 1.1, align: "right" },
      { header: "Payments received", width: 1.1, align: "right" },
      { header: "Payments", width: 0.7, align: "right" },
    ],
    rows: monthlyRows(a),
    emptyMessage: "No dated records available for a monthly summary.",
  });

  builder.heading("Deal, payment and receivables totals");
  builder.keyValueRows(
    [
      { label: "Projects & deals", value: count(a.deals.total) },
      { label: "CRM client projects", value: count(a.deals.crmClientDeals) },
      { label: "Other client projects", value: count(a.deals.otherClientDeals) },
      { label: "Contracted value", value: inr(a.deals.contracted) },
      { label: "Money received", value: inr(a.deals.received) },
      { label: "Outstanding balance", value: inr(a.deals.outstanding) },
      { label: "Overdue balance", value: inr(a.receivables.overdueAmount) },
      { label: "Upcoming balance", value: inr(a.receivables.upcomingAmount) },
      { label: "Fully paid projects", value: count(a.deals.paidDeals) },
      { label: "Partially paid projects", value: count(a.deals.partiallyPaidDeals) },
      { label: "Unpaid projects", value: count(a.deals.unpaidDeals) },
      { label: "Overdue projects", value: count(a.deals.overdueDeals) },
    ],
    2
  );

  builder.barList(
    a.payments.byMethod.map((bucket) => ({ label: bucket.key, value: bucket.amount, display: inr(bucket.amount) })),
    { tone: "positive", maxItems: 8, labelWidth: 130, emptyMessage: "No payments recorded." }
  );

  builder.heading("Follow-up health", "Operational follow-up load across every recorded follow-up.");
  builder.keyValueRows(
    [
      { label: "Total follow-ups", value: count(a.followUps.total) },
      { label: "Pending", value: count(a.followUps.pending) },
      { label: "Overdue", value: count(a.followUps.overdue) },
      { label: "Due today", value: count(a.followUps.dueToday) },
      { label: "Upcoming", value: count(a.followUps.upcoming) },
      { label: "Completed", value: count(a.followUps.completed) },
      { label: "Cancelled", value: count(a.followUps.cancelled) },
      { label: "Completion rate", value: pct(a.followUps.completionRate) },
    ],
    2
  );

  tableSection(builder, {
    title: "Follow-ups by channel",
    columns: [
      { header: "Type", width: 1.4 },
      { header: "Follow-ups", width: 0.7, align: "right" },
    ],
    rows: a.followUps.byType.map((bucket) => [bucket.key, count(bucket.count)]),
    totals: ["Total follow-ups", count(a.followUps.total)],
    emptyMessage: "No follow-ups recorded.",
    fullDataSetFile: "Raw Data/followups.csv",
  });

  builder.heading("Workspace activity & notes");
  builder.kpiCards(
    [
      { label: "Activities logged", value: count(a.activities.total), hint: `${count(a.activities.last30Days)} in the last 30 days` },
      { label: "Notes added", value: count(a.activities.noteActivities), hint: "Note activities on client records" },
      { label: "Personal notes", value: count(a.notes.personalNotes), hint: `${count(a.notes.pinnedPersonalNotes)} pinned` },
      { label: "Leads with notes", value: count(a.notes.leadsWithNotes), hint: `${count(a.notes.leadNotesCharacters)} characters stored` },
      { label: "Sales notifications", value: count(ctx.dataset.notifications.length), hint: "Alert history" },
      { label: "AI insights", value: count(ctx.dataset.aiInsights.length), hint: "Lead scoring snapshots" },
    ],
    3
  );

  builder.addCallout(
    "Financial reconciliation statement",
    [
      ...canonicalFinanceNote(a),
      `All figures above are derived from the same read-only database snapshot (${ctx.dataset.meta.snapshotMode === "transaction-repeatable-read" ? "single repeatable-read transaction" : "sequential batched reads"}), and the export did not modify any CRM record.`,
    ],
    "positive"
  );
}