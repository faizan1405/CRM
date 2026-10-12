import { canonicalFinanceNote, count, dateIst, dateTimeIst, inr, pct, paymentNoteCell, tableSection, type ReportContext } from "./shared";
import type { ReportBuilder } from "../report-builder";

/**
 * 03 — Finance Report: every eligible deal, every payment transaction, receivable ageing and the
 * canonical financial summaries. Money received is always the sum of real payment transactions.
 */
export function renderFinance(builder: ReportBuilder, ctx: ReportContext): void {
  const { analytics: a, dataset } = ctx;
  const today = a.todayIst;

  builder.heading("Financial summary", "Contracted value, collections and receivables for every eligible project.");
  builder.kpiCards(
    [
      { label: "Contracted deal value", value: inr(a.deals.contracted), hint: `${count(a.deals.total)} projects & deals` },
      { label: "Money received", value: inr(a.deals.received), hint: `${count(a.payments.total)} payment transactions`, tone: "positive" },
      { label: "Outstanding balance", value: inr(a.deals.outstanding), hint: `${count(a.receivables.dealsWithBalance)} projects with a balance`, tone: "warning" },
      { label: "Overdue balance", value: inr(a.receivables.overdueAmount), hint: `${count(a.receivables.overdueDealCount)} overdue projects`, tone: "critical" },
      { label: "Collection rate", value: pct(a.deals.collectionRate), hint: "Received ÷ contracted value", tone: "info" },
      { label: "Won deal value", value: inr(a.deals.wonDealValue), hint: "Canonical won CRM deal value", tone: "positive" },
      { label: "Average payment", value: inr(a.payments.averagePayment), hint: `Across ${count(a.payments.total)} payments` },
      { label: "Collected this month", value: inr(a.payments.thisMonthAmount), hint: "Current calendar month (IST)", tone: "positive" },
      { label: "Next payment due", value: a.receivables.nextDueDate ? dateIst(a.receivables.nextDueDate) : "—", hint: "Earliest open due date", tone: "info" },
    ],
    3
  );

  builder.keyValueRows(
    [
      { label: "Fully paid projects", value: count(a.deals.paidDeals) },
      { label: "Partially paid projects", value: count(a.deals.partiallyPaidDeals) },
      { label: "Unpaid projects", value: count(a.deals.unpaidDeals) },
      { label: "Overdue projects", value: count(a.deals.overdueDeals) },
      { label: "CRM client projects", value: count(a.deals.crmClientDeals) },
      { label: "Other client projects", value: count(a.deals.otherClientDeals) },
      { label: "Clients with multiple projects", value: count(a.clientsWithMultipleDeals.length) },
      { label: "Finance report date (IST)", value: today },
    ],
    2
  );

  builder.heading("CRM clients vs other clients", "Both populations compared using the same canonical formulas.");
  const crmGroups = a.clientGroups.filter((group) => group.type !== "Other Client");
  const otherGroups = a.clientGroups.filter((group) => group.type === "Other Client");
  const sum = (groups: typeof a.clientGroups, selector: (group: (typeof a.clientGroups)[number]) => number): number =>
    Math.round(groups.reduce((total, group) => total + selector(group), 0) * 100) / 100;

  builder.table({
    columns: [
      { header: "Client population", width: 1.4 },
      { header: "Clients", width: 0.7, align: "right" },
      { header: "Projects", width: 0.7, align: "right" },
      { header: "Contracted", width: 1.1, align: "right" },
      { header: "Received", width: 1.1, align: "right" },
      { header: "Outstanding", width: 1.1, align: "right" },
      { header: "Collection rate", width: 0.9, align: "right" },
    ],
    rows: [
      [
        "CRM clients",
        count(crmGroups.length),
        count(a.deals.crmClientDeals),
        inr(sum(crmGroups, (group) => group.contracted)),
        inr(sum(crmGroups, (group) => group.received)),
        inr(sum(crmGroups, (group) => group.outstanding)),
        pct(a.deals.contracted > 0 ? (sum(crmGroups, (group) => group.received) / Math.max(1, sum(crmGroups, (group) => group.contracted))) * 100 : 0),
      ],
      [
        "Other clients",
        count(otherGroups.length),
        count(a.deals.otherClientDeals),
        inr(sum(otherGroups, (group) => group.contracted)),
        inr(sum(otherGroups, (group) => group.received)),
        inr(sum(otherGroups, (group) => group.outstanding)),
        pct(sum(otherGroups, (group) => group.contracted) > 0 ? (sum(otherGroups, (group) => group.received) / sum(otherGroups, (group) => group.contracted)) * 100 : 0),
      ],
    ],
    totals: [
      "All clients",
      count(a.clientGroups.length),
      count(a.deals.total),
      inr(a.deals.contracted),
      inr(a.deals.received),
      inr(a.deals.outstanding),
      pct(a.deals.collectionRate),
    ],
    emptyMessage: "No clients with projects recorded.",
  });

  builder.heading("Deal ledger", "Every eligible project and deal, with its own received and outstanding figures.");
  const allDeals = [...a.clientGroups]
    .flatMap((group) => group.deals.map((view) => ({ group, view })))
    .sort(
      (left, right) =>
        new Date(left.view.deal.createdAt).getTime() - new Date(right.view.deal.createdAt).getTime()
    );

  tableSection(builder, {
    title: "All projects & deals (all time)",
    description: "No date filter is applied: every deal in the database is listed, whether open, won, lost or historical.",
    columns: [
      { header: "#", width: 0.35, align: "right", maxLines: 1 },
      { header: "Client", width: 1.5, maxLines: 2 },
      { header: "Client type", width: 0.95, maxLines: 2 },
      { header: "Project", width: 1.4, maxLines: 2 },
      { header: "Contracted", width: 1, align: "right" },
      { header: "Received", width: 0.95, align: "right" },
      { header: "Outstanding", width: 0.95, align: "right" },
      { header: "Next due (IST)", width: 0.85 },
      { header: "Payment status", width: 0.85, maxLines: 2 },
      { header: "Deal status", width: 0.85, maxLines: 2 },
    ],
    rows: allDeals.map(({ group, view }, index) => [
      String(index + 1),
      group.clientName,
      group.type,
      view.projectName,
      inr(view.contracted),
      inr(view.received),
      inr(view.outstanding),
      view.deal.nextPaymentDueDate ? dateIst(view.deal.nextPaymentDueDate) : "—",
      view.paymentStatus,
      view.deal.status.replace(/_/g, " "),
    ]),
    totals: [
      "",
      count(a.clientGroups.length) + " clients",
      "",
      count(a.deals.total) + " projects",
      inr(a.deals.contracted),
      inr(a.deals.received),
      inr(a.deals.outstanding),
      "",
      "",
      "",
    ],
    emptyMessage: "No deals recorded.",
    fullDataSetFile: "Raw Data/deals.csv",
  });

  builder.heading(
    "Payment transactions",
    "Each individual payment with its date, mode, reference and note. Payments are never aggregated away."
  );

  const paymentsWithContext = dataset.payments
    .map((payment) => {
      const view = a.dealsById.get(payment.dealId);
      return { payment, view };
    })
    .sort((left, right) => new Date(left.payment.paymentDate).getTime() - new Date(right.payment.paymentDate).getTime());

  tableSection(builder, {
    title: "All payment transactions (all time)",
    columns: [
      { header: "#", width: 0.35, align: "right", maxLines: 1 },
      { header: "Date (IST)", width: 0.85 },
      { header: "Client", width: 1.4, maxLines: 2 },
      { header: "Project", width: 1.3, maxLines: 2 },
      { header: "Amount", width: 0.95, align: "right" },
      { header: "Type", width: 0.8, maxLines: 2 },
      { header: "Mode", width: 0.85, maxLines: 2 },
      { header: "Reference / note", width: 1.7, maxLines: 3 },
      { header: "Recorded (IST)", width: 0.9 },
    ],
    rows: paymentsWithContext.map(({ payment, view }, index) => [
      String(index + 1),
      dateIst(payment.paymentDate),
      view?.clientName ?? "—",
      view?.projectName ?? "—",
      inr(Number(payment.amount)),
      payment.customType ? `${payment.type} (${payment.customType})` : payment.type,
      payment.method.replace(/_/g, " "),
      paymentNoteCell(payment),
      dateIst(payment.createdAt),
    ]),
    totals: [
      "",
      "",
      "",
      count(a.payments.total) + " payments",
      inr(a.payments.amount),
      "",
      "",
      "",
      "",
    ],
    emptyMessage: "No payment transactions recorded.",
    fullDataSetFile: "Raw Data/payments.csv",
  });

  builder.heading("Collections analysis");
  builder.table({
    columns: [
      { header: "Payment mode", width: 1.4 },
      { header: "Payments", width: 0.7, align: "right" },
      { header: "Amount received", width: 1.1, align: "right" },
      { header: "Share of collections", width: 1, align: "right" },
    ],
    rows: a.payments.byMethod.map((bucket) => [
      bucket.key,
      count(bucket.count),
      inr(bucket.amount),
      pct(a.payments.amount > 0 ? (bucket.amount / a.payments.amount) * 100 : 0),
    ]),
    totals: ["All modes", count(a.payments.total), inr(a.payments.amount), pct(100)],
    emptyMessage: "No payments recorded.",
  });

  builder.table({
    caption: "Payment types",
    columns: [
      { header: "Payment type", width: 1.4 },
      { header: "Payments", width: 0.7, align: "right" },
      { header: "Amount received", width: 1.1, align: "right" },
      { header: "Share of collections", width: 1, align: "right" },
    ],
    rows: a.payments.byType.map((bucket) => [
      bucket.key,
      count(bucket.count),
      inr(bucket.amount),
      pct(a.payments.amount > 0 ? (bucket.amount / a.payments.amount) * 100 : 0),
    ]),
    totals: ["All types", count(a.payments.total), inr(a.payments.amount), pct(100)],
    emptyMessage: "No payments recorded.",
  });

  builder.barList(
    a.monthly.payments.map((point) => ({ label: point.label, value: point.amount, display: inr(point.amount) })),
    { tone: "positive", maxItems: 14, labelWidth: 110, emptyMessage: "No monthly collections recorded." }
  );

  builder.heading("Receivables", "Outstanding balances with due dates and ageing.");
  const outstandingDeals = a.clientGroups
    .flatMap((group) => group.deals.map((view) => ({ group, view })))
    .filter(({ view }) => view.outstanding > 0)
    .sort((left, right) => right.view.outstanding - left.view.outstanding);

  const ageing = [
    { label: "Not yet due", min: -1, max: 0 },
    { label: "1 – 30 days overdue", min: 1, max: 30 },
    { label: "31 – 60 days overdue", min: 31, max: 60 },
    { label: "61 – 90 days overdue", min: 61, max: 90 },
    { label: "90+ days overdue", min: 91, max: Number.MAX_SAFE_INTEGER },
  ];

  builder.table({
    columns: [
      { header: "Ageing bucket", width: 1.4 },
      { header: "Projects", width: 0.7, align: "right" },
      { header: "Outstanding", width: 1.2, align: "right" },
      { header: "Share of outstanding", width: 1.1, align: "right" },
    ],
    rows: ageing.map((bucket) => {
      const matching = outstandingDeals.filter(
        ({ view }) => view.daysOverdue >= bucket.min && view.daysOverdue <= bucket.max
      );
      const total = matching.reduce((sumAmount, { view }) => sumAmount + view.outstanding, 0);
      return [
        bucket.label,
        count(matching.length),
        inr(total),
        pct(a.deals.outstanding > 0 ? (total / a.deals.outstanding) * 100 : 0),
      ];
    }),
    totals: ["Total outstanding", count(outstandingDeals.length), inr(a.deals.outstanding), pct(100)],
    emptyMessage: "No outstanding balances — every project is fully collected.",
  });

  tableSection(builder, {
    title: "Projects with an outstanding balance",
    columns: [
      { header: "Client", width: 1.5, maxLines: 2 },
      { header: "Project", width: 1.4, maxLines: 2 },
      { header: "Contracted", width: 1, align: "right" },
      { header: "Received", width: 0.95, align: "right" },
      { header: "Outstanding", width: 1, align: "right" },
      { header: "Next due (IST)", width: 0.85 },
      { header: "Days overdue", width: 0.7, align: "right" },
      { header: "Status", width: 0.85, maxLines: 2 },
    ],
    rows: outstandingDeals.map(({ group, view }) => [
      group.clientName,
      view.projectName,
      inr(view.contracted),
      inr(view.received),
      inr(view.outstanding),
      view.deal.nextPaymentDueDate ? dateIst(view.deal.nextPaymentDueDate) : "—",
      view.daysOverdue > 0 ? String(view.daysOverdue) : "—",
      view.paymentStatus,
    ]),
    totals: ["", "", "", "", inr(a.deals.outstanding), "", "", ""],
    emptyMessage: "No outstanding balances — every project is fully collected.",
  });

  if (a.clientsWithMultipleDeals.length > 0) {
    builder.heading(
      "Clients with multiple projects",
      "Each project is reported separately; client totals are the sum of their own projects only, so nothing is double counted."
    );
    tableSection(builder, {
      title: "Multi-project clients",
      columns: [
        { header: "Client", width: 1.6, maxLines: 2 },
        { header: "Projects", width: 0.6, align: "right" },
        { header: "Project names", width: 2.2, maxLines: 3 },
        { header: "Contracted", width: 1, align: "right" },
        { header: "Received", width: 0.95, align: "right" },
        { header: "Outstanding", width: 0.95, align: "right" },
      ],
      rows: a.clientsWithMultipleDeals.map((group) => [
        group.clientName,
        count(group.dealCount),
        group.deals.map((view) => view.projectName).join("; "),
        inr(group.contracted),
        inr(group.received),
        inr(group.outstanding),
      ]),
      emptyMessage: "No client currently holds more than one project.",
      fullDataSetFile: "Raw Data/deals.csv",
    });
  }

  builder.addCallout(
    "Financial reconciliation",
    [
      ...canonicalFinanceNote(a),
      `This report was generated from a read-only snapshot at ${dateTimeIst(ctx.file.generatedAtUtc)} IST. No deal, payment or balance was created, updated or deleted by the export${
        a.deals.orphanDeals > 0 ? ` (${count(a.deals.orphanDeals)} deal(s) reference a lead that no longer exists; they are preserved and reported here)` : ""
      }.`,
    ],
    "positive"
  );
}