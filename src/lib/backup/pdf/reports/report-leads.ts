import { count, contactCell, dash, dateIst, inr, leadFlags, leadNoteSnippet, leadStatusLabel, pct, tableSection, type ReportContext } from "./shared";
import type { ReportBuilder } from "../report-builder";

/**
 * 04 — All Leads: the complete lead register, including waste, lost, archived (soft-deleted) and
 * merged rows, with an explicit current vs historical split.
 */
export function renderLeads(builder: ReportBuilder, ctx: ReportContext): void {
  const { analytics: a, dataset } = ctx;

  builder.heading("Lead register overview", "Every lead in the database — nothing is filtered out by date or status.");
  builder.kpiCards(
    [
      { label: "Total leads", value: count(a.leads.total), hint: "Including historical rows" },
      { label: "Current leads", value: count(a.leads.current), hint: "Not waste, archived or merged", tone: "positive" },
      { label: "Historical leads", value: count(a.leads.historical), hint: "Waste, archived or merged", tone: "warning" },
      { label: "Waste leads", value: count(a.leads.waste), hint: "Marked as waste" },
      { label: "Archived (deleted)", value: count(a.leads.archivedDeleted), hint: "Soft-deleted, recoverable" },
      { label: "Merged away", value: count(a.leads.merged), hint: "Merged into another lead" },
      { label: "Pinned leads", value: count(a.leads.pinned), hint: "Flagged as important" },
      { label: "With quotes", value: count(a.leads.withQuotes), hint: `Quoted value ${inr(a.leads.quotedValue)}` },
      { label: "Created (last 30 days)", value: count(a.leads.createdLast30Days), hint: "Recent intake", tone: "info" },
    ],
    3
  );

  builder.addCallout(
    "Current vs historical records",
    [
      `A lead is "current" when it is not waste, not soft-deleted and not merged into another record (${count(a.leads.current)} leads).`,
      `Historical rows are still exported in full: ${count(a.leads.waste)} waste, ${count(a.leads.archivedDeleted)} archived (soft-deleted) and ${count(a.leads.merged)} merged records are included below and in Raw Data/leads.csv.`,
    ],
    "info"
  );

  const leadsById = new Map(dataset.leads.map((lead) => [lead.id, lead]));
  const projectStatsByLead = new Map<string, { projectCount: number; contracted: number; received: number }>();
  for (const group of a.clientGroups) {
    if (!group.key.startsWith("lead:")) continue;
    projectStatsByLead.set(group.key.slice("lead:".length), {
      projectCount: group.dealCount,
      contracted: group.contracted,
      received: group.received,
    });
  }

  const registerRows = dataset.leads.map((lead, index) => {
    const projects = projectStatsByLead.get(lead.id);
    return [
      String(index + 1),
      lead.business ? `${lead.name}\n${lead.business}` : lead.name,
      contactCell(lead),
      leadStatusLabel(lead.status),
      leadFlags(lead),
      lead.quotedAmount !== null
        ? `${inr(Number(lead.quotedAmount))}${lead.budget !== null ? `\nBudget ${inr(Number(lead.budget))}` : ""}`
        : "—",
      projects ? `${count(projects.projectCount)}\n${inr(projects.contracted)}` : "—",
      lead.lastContactDate ? dateIst(lead.lastContactDate) : "—",
      dateIst(lead.createdAt),
      leadNoteSnippet(lead.notes),
    ];
  });

  tableSection(builder, {
    title: "Complete lead register",
    description: "Lead details, contact information, status, commercial figures, linked projects and notes.",
    columns: [
      { header: "#", width: 0.32, align: "right", maxLines: 1, fontSize: 7.2 },
      { header: "Client / business", width: 1.7, maxLines: 3 },
      { header: "Contact", width: 1.3, maxLines: 3 },
      { header: "Status", width: 0.8, maxLines: 2 },
      { header: "Record state", width: 1.05, maxLines: 3 },
      { header: "Quote / budget", width: 1, maxLines: 3 },
      { header: "Projects", width: 0.85, maxLines: 3 },
      { header: "Last contact", width: 0.8, maxLines: 2 },
      { header: "Created (IST)", width: 0.85, maxLines: 2 },
      { header: "Notes", width: 1.7, maxLines: 4 },
    ],
    rows: registerRows,
    totals: [
      "",
      count(dataset.leads.length) + " leads",
      "",
      "",
      count(a.leads.current) + " current · " + count(a.leads.historical) + " historical",
      inr(a.leads.quotedValue),
      count(a.deals.total) + " projects",
      "",
      "",
      "",
    ],
    emptyMessage: "No leads recorded in this workspace.",
    fullDataSetFile: "Raw Data/leads.csv",
  });

  const archivedLeads = dataset.leads.filter((lead) => lead.deletedAt || lead.mergedIntoLeadId || lead.isWaste);
  if (archivedLeads.length > 0) {
    tableSection(builder, {
      title: "Archived, waste and merged leads",
      description: "Preserved historical records with their archival or merge references.",
      columns: [
        { header: "Client", width: 1.5, maxLines: 2 },
        { header: "Phone", width: 0.95 },
        { header: "Status", width: 0.8, maxLines: 1 },
        { header: "Waste", width: 0.5, align: "center", maxLines: 1 },
        { header: "Archived at (IST)", width: 0.95 },
        { header: "Merged into", width: 1.5, maxLines: 2 },
        { header: "Merged at (IST)", width: 0.95 },
      ],
      rows: archivedLeads.map((lead) => [
        lead.name,
        lead.phone || "—",
        leadStatusLabel(lead.status),
        lead.isWaste ? "Yes" : "No",
        lead.deletedAt ? dateIst(lead.deletedAt) : "—",
        lead.mergedIntoLeadId
          ? `${leadsById.get(lead.mergedIntoLeadId)?.name ?? "Unknown lead"}\n(${lead.mergedIntoLeadId})`
          : "—",
        lead.mergedAt ? dateIst(lead.mergedAt) : "—",
      ]),
      emptyMessage: "No archived, waste or merged leads recorded.",
      fullDataSetFile: "Raw Data/leads.csv",
    });
  }

  builder.heading("Lead distribution", "Sources, industries and status mix across the complete register.");
  builder.barList(
    a.leads.byStatus.map((bucket) => ({ label: bucket.key, value: bucket.count, display: count(bucket.count) })),
    { tone: "info", maxItems: 8, labelWidth: 130 }
  );

  const totalLeads = a.leads.total || 1;
  builder.table({
    caption: "Lead sources",
    columns: [
      { header: "Source", width: 2 },
      { header: "Leads", width: 0.7, align: "right" },
      { header: "Share", width: 0.7, align: "right" },
    ],
    rows: a.leads.bySource
      .slice(0, 15)
      .map((bucket) => [bucket.key, count(bucket.count), pct((bucket.count / totalLeads) * 100)]),
    totals: ["All sources", count(a.leads.total), pct(100)],
    emptyMessage: "No lead sources recorded.",
  });

  builder.table({
    caption: "Industries",
    columns: [
      { header: "Industry", width: 2 },
      { header: "Leads", width: 0.7, align: "right" },
      { header: "Share", width: 0.7, align: "right" },
    ],
    rows: a.leads.byIndustry
      .slice(0, 15)
      .map((bucket) => [bucket.key, count(bucket.count), pct((bucket.count / totalLeads) * 100)]),
    totals: ["All industries", count(a.leads.total), pct(100)],
    emptyMessage: "No industry information recorded.",
  });

  const leadsWithProjects = [...projectStatsByLead.entries()]
    .map(([leadId, stats]) => ({ lead: leadsById.get(leadId), stats }))
    .filter((entry) => Boolean(entry.lead) && entry.stats.projectCount > 0)
    .sort((left, right) => right.stats.contracted - left.stats.contracted);

  if (leadsWithProjects.length > 0) {
    tableSection(builder, {
      title: "Leads linked to projects",
      description: "Leads that have one or more projects/deals attached, with the value of each relationship.",
      columns: [
        { header: "Client", width: 1.6, maxLines: 2 },
        { header: "Business", width: 1.4, maxLines: 2 },
        { header: "Status", width: 0.85, maxLines: 1 },
        { header: "Projects", width: 0.65, align: "right" },
        { header: "Contracted", width: 1, align: "right" },
        { header: "Received", width: 1, align: "right" },
        { header: "Outstanding", width: 1, align: "right" },
      ],
      rows: leadsWithProjects.map(({ lead, stats }) => [
        lead?.name ?? "—",
        dash(lead?.business),
        lead ? leadStatusLabel(lead.status) : "—",
        count(stats.projectCount),
        inr(stats.contracted),
        inr(stats.received),
        inr(stats.contracted - stats.received > 0 ? stats.contracted - stats.received : 0),
      ]),
      totals: [
        count(leadsWithProjects.length) + " clients",
        "",
        "",
        count(leadsWithProjects.reduce((sum, entry) => sum + entry.stats.projectCount, 0)),
        inr(leadsWithProjects.reduce((sum, entry) => sum + entry.stats.contracted, 0)),
        inr(leadsWithProjects.reduce((sum, entry) => sum + entry.stats.received, 0)),
        "",
      ],
      emptyMessage: "No lead currently has a project attached.",
      fullDataSetFile: "Raw Data/deals.csv",
    });
  }

  builder.addCallout(
    "Note on notes",
    [
      `Lead notes are printed in summary form (up to ~240 characters per row) so the register stays readable; the complete note text is exported verbatim in Raw Data/leads.csv and in Raw Data/notes.csv (${count(a.notes.leadsWithNotes)} leads carry notes).`,
      "Activities and follow-ups that belong to these leads are listed in reports 06 and 07 of this backup.",
    ],
    "info"
  );
}