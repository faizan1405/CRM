import type { Lead } from "@prisma/client";
import { count, dash, dateIst, dateTimeIst, inr, leadStatusLabel, pct, tableSection, type ReportContext } from "./shared";
import type { ReportBuilder } from "../report-builder";
import { monthlyRows } from "./report-overview";

const FUNNEL_STAGES: Array<{ status: string; label: string }> = [
  { status: "NEW", label: "New" },
  { status: "CONTACTED", label: "Contacted" },
  { status: "QUALIFIED", label: "Qualified" },
  { status: "PROPOSAL_SENT", label: "Proposal sent" },
  { status: "WON", label: "Won" },
  { status: "LOST", label: "Lost" },
];

/**
 * 02 — Sales Report: funnel, conversion, won/lost history, project values, performance trend and
 * every open opportunity.
 */
export function renderSales(builder: ReportBuilder, ctx: ReportContext): void {
  const { analytics: a, dataset } = ctx;

  const largestDeal = [...dataset.deals].sort(
    (left, right) => Number(right.finalAmount) - Number(left.finalAmount)
  )[0];
  const averageDealValue = a.deals.total ? a.deals.contracted / a.deals.total : 0;

  builder.heading("Sales performance", "Opportunity, conversion and closing performance across the whole workspace.");
  builder.kpiCards(
    [
      {
        label: "Open pipeline value",
        value: inr(a.deals.openPipelineValue),
        hint: `${count(a.opportunities.length)} open opportunities`,
        tone: "info",
      },
      { label: "Won deal value", value: inr(a.deals.wonDealValue), hint: "Confirmed + completed", tone: "positive" },
      { label: "Contracted deal value", value: inr(a.deals.contracted), hint: `${count(a.deals.total)} projects` },
      { label: "Win rate", value: pct(a.leads.winRate), hint: `${count(a.leads.wonCount)} won · ${count(a.leads.lostCount)} lost`, tone: "info" },
      { label: "Average project value", value: inr(averageDealValue), hint: "Contracted ÷ projects" },
      { label: "Largest project", value: inr(largestDeal ? Number(largestDeal.finalAmount) : 0), hint: largestDeal?.projectName ?? "—" },
    ],
    3
  );

  const totalLeads = a.leads.total || 1;
  builder.heading("Sales funnel", "Lead counts by pipeline stage and the value attached to each stage.");
  builder.table({
    columns: [
      { header: "Stage", width: 1.4 },
      { header: "Leads", width: 0.7, align: "right" },
      { header: "Share of leads", width: 0.9, align: "right" },
      { header: "Quoted / opportunity value", width: 1.3, align: "right" },
    ],
    rows: FUNNEL_STAGES.map((stage) => {
      const bucket = a.leads.byStatus.find((entry) => entry.key === stage.label);
      const leadsInStage = dataset.leads.filter((lead) => lead.status === stage.status);
      const value = leadsInStage.reduce((sum, lead) => sum + (lead.quotedAmount ? Number(lead.quotedAmount) : 0), 0);
      return [stage.label, count(bucket?.count ?? leadsInStage.length), pct((leadsInStage.length / totalLeads) * 100), inr(value)];
    }),
    totals: ["Total pipeline", count(a.leads.total), pct(100), inr(a.leads.quotedValue)],
    emptyMessage: "No pipeline stages recorded.",
  });

  builder.barList(
    FUNNEL_STAGES.map((stage) => ({
      label: stage.label,
      value: dataset.leads.filter((lead) => lead.status === stage.status).length,
      display: count(dataset.leads.filter((lead) => lead.status === stage.status).length),
    })),
    { tone: "info", labelWidth: 140 }
  );

  builder.heading("Conversion metrics");
  const stageCount = (status: string): number => dataset.leads.filter((lead) => lead.status === status).length;
  const reached = (status: string): number => {
    const order = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "WON"];
    const index = order.indexOf(status);
    if (index < 0) return 0;
    return dataset.leads.filter((lead) => order.indexOf(lead.status) >= index).length;
  };

  builder.keyValueRows(
    [
      { label: "New leads", value: count(stageCount("NEW")) },
      { label: "Contacted (reached)", value: count(reached("CONTACTED")) },
      { label: "Qualified (reached)", value: count(reached("QUALIFIED")) },
      { label: "Proposal sent (reached)", value: count(reached("PROPOSAL_SENT")) },
      { label: "Lead → contacted rate", value: pct((reached("CONTACTED") / totalLeads) * 100) },
      { label: "Contacted → qualified rate", value: pct((reached("QUALIFIED") / Math.max(1, reached("CONTACTED"))) * 100) },
      { label: "Qualified → proposal rate", value: pct((reached("PROPOSAL_SENT") / Math.max(1, reached("QUALIFIED"))) * 100) },
      { label: "Proposal → won rate", value: pct((a.leads.wonCount / Math.max(1, reached("PROPOSAL_SENT"))) * 100) },
      { label: "Lost leads", value: count(a.leads.lostCount) },
      { label: "Loss events recorded", value: count(dataset.lossEvents.length) },
    ],
    2
  );

  const leadsById = new Map(dataset.leads.map((lead) => [lead.id, lead]));
  const wonLeads = dataset.leads.filter(
    (lead) => lead.status === "WON" && !lead.isWaste && lead.deletedAt === null && lead.mergedIntoLeadId === null
  );

  tableSection(builder, {
    title: "Won history",
    description: "Won CRM clients with the project value attached to each win.",
    columns: [
      { header: "Client", width: 1.5, maxLines: 2 },
      { header: "Business", width: 1.3, maxLines: 2 },
      { header: "Projects", width: 0.6, align: "right" },
      { header: "Contracted value", width: 1, align: "right" },
      { header: "Received", width: 0.9, align: "right" },
      { header: "Outstanding", width: 0.9, align: "right" },
      { header: "Last updated (IST)", width: 1.05 },
    ],
    rows: wonLeads.map((lead) => {
      const group = a.clientGroups.find((entry) => entry.key === `lead:${lead.id}`);
      return [
        lead.name,
        dash(lead.business),
        count(group?.dealCount ?? 0),
        inr(group?.contracted ?? 0),
        inr(group?.received ?? 0),
        inr(group?.outstanding ?? 0),
        dateIst(lead.updatedAt),
      ];
    }),
    totals: [
      "Won clients",
      "",
      count(wonLeads.reduce((sum, lead) => sum + (a.clientGroups.find((g) => g.key === `lead:${lead.id}`)?.dealCount ?? 0), 0)),
      inr(a.deals.wonDealValue),
      "",
      "",
      "",
    ],
    emptyMessage: "No won clients recorded.",
    fullDataSetFile: "Raw Data/leads.csv",
  });

  const lostLeadIds = new Set(
    dataset.leads.filter((lead) => lead.status === "LOST").map((lead) => lead.id)
  );
  const lossEventsByLead = new Map<string, typeof dataset.lossEvents>();
  for (const event of dataset.lossEvents) {
    const list = lossEventsByLead.get(event.leadId) ?? [];
    list.push(event);
    lossEventsByLead.set(event.leadId, list);
  }

  tableSection(builder, {
    title: "Lost history",
    columns: [
      { header: "Client", width: 1.5, maxLines: 2 },
      { header: "Business", width: 1.3, maxLines: 2 },
      { header: "Lost reason", width: 1.1, maxLines: 2 },
      { header: "Lost at (IST)", width: 1 },
      { header: "Note", width: 1.7, maxLines: 3 },
    ],
    rows: [...lostLeadIds].map((leadId) => {
      const lead = leadsById.get(leadId) as Lead;
      const events = (lossEventsByLead.get(leadId) ?? []).sort(
        (left, right) => new Date(right.lostAt).getTime() - new Date(left.lostAt).getTime()
      );
      const latest = events[0];
      return [
        lead?.name ?? "—",
        dash(lead?.business),
        latest ? latest.reason.replace(/_/g, " ") : "Not recorded",
        latest ? dateIst(latest.lostAt) : dateIst(lead?.updatedAt ?? null),
        latest?.note ? latest.note : "—",
      ];
    }),
    emptyMessage: "No lost clients recorded.",
    fullDataSetFile: "Raw Data/loss_events.csv",
  });

  builder.heading("Loss reasons", "Why opportunities were lost, by frequency.");
  builder.barList(
    a.lossReasons.map((bucket) => ({ label: bucket.key, value: bucket.count, display: count(bucket.count) })),
    { tone: "critical", labelWidth: 140, emptyMessage: "No loss reasons recorded." }
  );

  builder.heading("Project values", "The largest contracted projects across CRM and other clients.");
  tableSection(builder, {
    title: "Top projects by contracted value",
    columns: [
      { header: "Client", width: 1.5, maxLines: 2 },
      { header: "Type", width: 1 },
      { header: "Project", width: 1.5, maxLines: 2 },
      { header: "Contracted", width: 1, align: "right" },
      { header: "Received", width: 0.9, align: "right" },
      { header: "Status", width: 1, maxLines: 2 },
    ],
    rows: [...a.clientGroups]
      .flatMap((group) => group.deals.map((view) => ({ group, view })))
      .sort((left, right) => right.view.contracted - left.view.contracted)
      .slice(0, 25)
      .map(({ group, view }) => [
        group.clientName,
        group.type,
        view.projectName,
        inr(view.contracted),
        inr(view.received),
        `${view.paymentStatus} · ${view.deal.status.replace(/_/g, " ")}`,
      ]),
    emptyMessage: "No projects recorded.",
  });

  builder.heading("Sales momentum", "Contracted value, collections and lead inflow by month (IST).");
  builder.table({
    columns: [
      { header: "Month", width: 1.1 },
      { header: "Leads created", width: 0.9, align: "right" },
      { header: "Projects created", width: 0.9, align: "right" },
      { header: "Contracted value", width: 1.15, align: "right" },
      { header: "Payments received", width: 1.15, align: "right" },
      { header: "Payments", width: 0.7, align: "right" },
    ],
    rows: monthlyRows(a),
    emptyMessage: "No dated records available.",
  });
  builder.barList(
    a.monthly.deals.map((point) => ({ label: point.label, value: point.amount, display: inr(point.amount) })),
    { tone: "positive", maxItems: 12, labelWidth: 110, emptyMessage: "No monthly contracted value recorded." }
  );

  builder.heading("Open opportunities", "Active pipeline opportunities ranked by expected value.");
  tableSection(builder, {
    title: "Opportunities in progress",
    columns: [
      { header: "Client", width: 1.5, maxLines: 2 },
      { header: "Business", width: 1.3, maxLines: 2 },
      { header: "Phone", width: 1 },
      { header: "Stage", width: 0.9 },
      { header: "Quoted", width: 0.9, align: "right" },
      { header: "Project value", width: 0.9, align: "right" },
      { header: "Opportunity value", width: 1, align: "right" },
      { header: "Created (IST)", width: 1 },
    ],
    rows: a.opportunities.map((opportunity) => [
      opportunity.name,
      dash(opportunity.business),
      dash(opportunity.phone),
      leadStatusLabel(opportunity.status),
      opportunity.quotedAmount !== null ? inr(opportunity.quotedAmount) : "—",
      opportunity.dealValue !== null ? inr(opportunity.dealValue) : "—",
      inr(opportunity.opportunityValue),
      dateIst(opportunity.createdAt),
    ]),
    totals: [
      "Open pipeline",
      "",
      "",
      count(a.opportunities.length),
      "",
      "",
      inr(a.deals.openPipelineValue),
      "",
    ],
    emptyMessage: "No open opportunities in the pipeline.",
    fullDataSetFile: "Raw Data/leads.csv",
  });

  builder.addCallout(
    "How these figures are calculated",
    [
      "Open pipeline value prefers a project's contracted value and falls back to the lead's quoted amount; won, lost, waste, archived and merged leads are excluded.",
      `Opportunity values are snapshotted at export time (${dateTimeIst(ctx.file.generatedAtUtc)} IST) and never modify the underlying client records.`,
    ],
    "info"
  );
}