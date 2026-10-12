import { count, dash, dateIst, inr, pct, tableSection, type ReportContext } from "./shared";
import type { ReportBuilder } from "../report-builder";

/**
 * 05 — Projects & Deals: every project listed separately under its CRM client or Other client,
 * with independent payment summaries, outstanding values and relationships.
 */
export function renderProjects(builder: ReportBuilder, ctx: ReportContext): void {
  const { analytics: a } = ctx;

  const crmGroups = a.clientGroups.filter((group) => group.type !== "Other Client");
  const otherGroups = a.clientGroups.filter((group) => group.type === "Other Client");
  const total = (groups: typeof a.clientGroups, selector: (group: (typeof a.clientGroups)[number]) => number): number =>
    Math.round(groups.reduce((sum, group) => sum + selector(group), 0) * 100) / 100;

  builder.heading("Projects & deals overview", "Each project is an independent contract with its own payment ledger.");
  builder.kpiCards(
    [
      { label: "Total projects & deals", value: count(a.deals.total), hint: `${count(a.clientGroups.length)} distinct clients` },
      { label: "CRM client projects", value: count(a.deals.crmClientDeals), hint: `${count(crmGroups.length)} CRM clients`, tone: "info" },
      { label: "Other client projects", value: count(a.deals.otherClientDeals), hint: `${count(otherGroups.length)} other clients`, tone: "info" },
      { label: "Contracted value", value: inr(a.deals.contracted), hint: "Sum of every project value" },
      { label: "Received", value: inr(a.deals.received), hint: `${count(a.payments.total)} payments`, tone: "positive" },
      { label: "Outstanding", value: inr(a.deals.outstanding), hint: `${count(a.receivables.dealsWithBalance)} projects with a balance`, tone: "warning" },
      { label: "Clients with multiple projects", value: count(a.clientsWithMultipleDeals.length), hint: "Reported separately, never merged", tone: "neutral" },
      { label: "Collection rate", value: pct(a.deals.collectionRate), hint: "Received ÷ contracted", tone: "info" },
      { label: "Overdue projects", value: count(a.deals.overdueDeals), hint: inr(a.receivables.overdueAmount) + " overdue", tone: "critical" },
    ],
    3
  );

  builder.addCallout(
    "How projects are grouped",
    [
      `A CRM client is a lead that owns one or more projects; an other client is a standalone project without a CRM lead. Every project keeps its own contracted value, payment history and outstanding balance.`,
      `Client totals are the sum of that client's own projects only — with ${count(a.clientsWithMultipleDeals.length)} multi-project client(s) in this workspace, nothing is double counted.`,
    ],
    "info"
  );

  if (crmGroups.length > 0) {
    builder.heading("CRM clients", "Leads that currently hold at least one project, with consolidated totals.");
    tableSection(builder, {
      title: "CRM client summary",
      columns: [
        { header: "Client", width: 1.5, maxLines: 2 },
        { header: "Business", width: 1.3, maxLines: 2 },
        { header: "Phone", width: 1 },
        { header: "Projects", width: 0.6, align: "right" },
        { header: "Contracted", width: 1, align: "right" },
        { header: "Received", width: 0.95, align: "right" },
        { header: "Outstanding", width: 0.95, align: "right" },
        { header: "Project names", width: 2, maxLines: 3 },
      ],
      rows: crmGroups.map((group) => [
        group.clientName,
        dash(group.company),
        dash(group.phone),
        count(group.dealCount),
        inr(group.contracted),
        inr(group.received),
        inr(group.outstanding),
        group.deals.map((view) => view.projectName).join("; "),
      ]),
      totals: [
        count(crmGroups.length) + " CRM clients",
        "",
        "",
        count(a.deals.crmClientDeals),
        inr(total(crmGroups, (group) => group.contracted)),
        inr(total(crmGroups, (group) => group.received)),
        inr(total(crmGroups, (group) => group.outstanding)),
        "",
      ],
      emptyMessage: "No CRM client currently holds a project.",
      fullDataSetFile: "Raw Data/deals.csv",
    });

    tableSection(builder, {
      title: "CRM client project ledger",
      description: "Every project of every CRM client, listed separately in creation order.",
      columns: [
        { header: "Client", width: 1.5, maxLines: 2 },
        { header: "Project", width: 1.5, maxLines: 2 },
        { header: "Contracted", width: 1, align: "right" },
        { header: "Received", width: 0.95, align: "right" },
        { header: "Outstanding", width: 0.95, align: "right" },
        { header: "Payments", width: 0.6, align: "right" },
        { header: "Status", width: 0.95, maxLines: 2 },
        { header: "Next due (IST)", width: 0.85 },
        { header: "Created (IST)", width: 0.85 },
      ],
      rows: crmGroups
        .flatMap((group) => group.deals.map((view) => ({ group, view })))
        .map(({ group, view }) => [
          group.clientName,
          view.projectName,
          inr(view.contracted),
          inr(view.received),
          inr(view.outstanding),
          count(view.payments.length),
          `${view.deal.status.replace(/_/g, " ")}\n${view.paymentStatus}`,
          view.deal.nextPaymentDueDate ? dateIst(view.deal.nextPaymentDueDate) : "—",
          dateIst(view.deal.createdAt),
        ]),
      totals: ["", count(a.deals.crmClientDeals) + " projects", inr(total(crmGroups, (g) => g.contracted)), inr(total(crmGroups, (g) => g.received)), inr(total(crmGroups, (g) => g.outstanding)), "", "", "", ""],
      emptyMessage: "No CRM client projects recorded.",
      fullDataSetFile: "Raw Data/deals.csv",
    });
  }

  if (otherGroups.length > 0) {
    builder.heading("Other clients", "Standalone projects that are not attached to a CRM lead.");
    tableSection(builder, {
      title: "Other client projects",
      columns: [
        { header: "Client", width: 1.5, maxLines: 2 },
        { header: "Business", width: 1.2, maxLines: 2 },
        { header: "Phone", width: 0.95 },
        { header: "Project", width: 1.4, maxLines: 2 },
        { header: "Contracted", width: 1, align: "right" },
        { header: "Received", width: 0.95, align: "right" },
        { header: "Outstanding", width: 0.95, align: "right" },
        { header: "Status", width: 0.95, maxLines: 2 },
      ],
      rows: otherGroups
        .flatMap((group) => group.deals.map((view) => ({ group, view })))
        .map(({ group, view }) => [
          group.clientName,
          dash(group.company),
          dash(group.phone),
          view.projectName,
          inr(view.contracted),
          inr(view.received),
          inr(view.outstanding),
          `${view.deal.status.replace(/_/g, " ")}\n${view.paymentStatus}`,
        ]),
      totals: ["", "", "", count(a.deals.otherClientDeals) + " projects", inr(total(otherGroups, (g) => g.contracted)), inr(total(otherGroups, (g) => g.received)), inr(total(otherGroups, (g) => g.outstanding)), ""],
      emptyMessage: "No other client projects recorded.",
      fullDataSetFile: "Raw Data/deals.csv",
    });
  }

  if (a.clientsWithMultipleDeals.length > 0) {
    builder.heading(
      "Clients with multiple projects",
      "One client, several independent contracts — reported without merging their ledgers."
    );
    tableSection(builder, {
      title: "Multi-project client detail",
      columns: [
        { header: "Client", width: 1.4, maxLines: 2 },
        { header: "Project", width: 1.5, maxLines: 2 },
        { header: "Contracted", width: 1, align: "right" },
        { header: "Received", width: 0.95, align: "right" },
        { header: "Outstanding", width: 0.95, align: "right" },
        { header: "Payments", width: 0.6, align: "right" },
        { header: "Payment status", width: 0.9, maxLines: 2 },
      ],
      rows: a.clientsWithMultipleDeals
        .flatMap((group) => group.deals.map((view) => ({ group, view })))
        .map(({ group, view }) => [
          group.clientName,
          view.projectName,
          inr(view.contracted),
          inr(view.received),
          inr(view.outstanding),
          count(view.payments.length),
          view.paymentStatus,
        ]),
      totals: ["", "", "", "", "", "", ""],
      emptyMessage: "No client currently holds more than one project.",
      fullDataSetFile: "Raw Data/deals.csv",
    });
  }

  builder.heading("Project payment summaries", "Each project's own collection position, sorted by outstanding balance.");
  tableSection(builder, {
    title: "Outstanding project balances",
    columns: [
      { header: "Client", width: 1.5, maxLines: 2 },
      { header: "Project", width: 1.5, maxLines: 2 },
      { header: "Contracted", width: 1, align: "right" },
      { header: "Received", width: 0.95, align: "right" },
      { header: "Outstanding", width: 1, align: "right" },
      { header: "Due (IST)", width: 0.85 },
      { header: "Days overdue", width: 0.7, align: "right" },
    ],
    rows: a.clientGroups
      .flatMap((group) => group.deals.map((view) => ({ group, view })))
      .filter(({ view }) => view.outstanding > 0)
      .sort((left, right) => right.view.outstanding - left.view.outstanding)
      .map(({ group, view }) => [
        group.clientName,
        view.projectName,
        inr(view.contracted),
        inr(view.received),
        inr(view.outstanding),
        view.deal.nextPaymentDueDate ? dateIst(view.deal.nextPaymentDueDate) : "—",
        view.daysOverdue > 0 ? String(view.daysOverdue) : "—",
      ]),
    totals: ["", "", "", "", inr(a.deals.outstanding), "", ""],
    emptyMessage: "Every project is fully collected.",
  });

  builder.heading("Project notes", "Free-text notes recorded against each project.");
  const dealsWithNotes = ctx.dataset.deals.filter((deal) => Boolean(deal.notes && deal.notes.trim()));
  tableSection(builder, {
    title: "Projects with notes",
    columns: [
      { header: "Client", width: 1.4, maxLines: 2 },
      { header: "Project", width: 1.4, maxLines: 2 },
      { header: "Contracted", width: 0.95, align: "right" },
      { header: "Status", width: 0.9, maxLines: 2 },
      { header: "Note", width: 3.2, maxLines: 4 },
    ],
    rows: dealsWithNotes.map((deal) => {
      const view = a.dealsById.get(deal.id);
      return [
        view?.clientName ?? "—",
        deal.projectName || "General project",
        inr(Number(deal.finalAmount)),
        `${deal.status.replace(/_/g, " ")}\n${view?.paymentStatus ?? ""}`,
        deal.notes ?? "",
      ];
    }),
    emptyMessage: "No project notes recorded.",
    fullDataSetFile: "Raw Data/deals.csv",
  });
}