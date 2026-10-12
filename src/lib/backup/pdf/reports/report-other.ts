import { EXCLUDED_CATEGORIES } from "../../constants";
import { count, dash, dateIst, dateTimeIst, inr, tableSection, type ReportContext } from "./shared";
import type { ReportBuilder } from "../report-builder";

function countBy<T>(rows: T[], getKey: (row: T) => string): Array<{ key: string; count: number }> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = getKey(row).replace(/_/g, " ");
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, value]) => ({ key, count: value }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

/**
 * 08 — Other CRM Records: supporting business data that does not belong to the lead/deal/finance
 * core — sales assets, loss events, notifications, briefings, AI insights, recovery history,
 * operational alert logs and the (credential-free) user directory.
 */
export function renderOtherRecords(builder: ReportBuilder, ctx: ReportContext): void {
  const { dataset, analytics: a } = ctx;
  const leadsById = new Map(dataset.leads.map((lead) => [lead.id, lead]));
  const usersById = new Map(dataset.users.map((user) => [user.id, user]));

  builder.heading("Supporting records in this backup", "Operational and commercial reference data held by the CRM.");
  builder.kpiCards(
    [
      { label: "Website packages", value: count(dataset.packages.length), hint: "Commercial packages" },
      { label: "Website samples", value: count(dataset.samples.length), hint: "Portfolio samples" },
      { label: "WhatsApp templates", value: count(dataset.templates.length), hint: "Outreach templates" },
      { label: "Loss events", value: count(dataset.lossEvents.length), hint: "Recorded loss reasons" },
      { label: "Sales notifications", value: count(dataset.notifications.length), hint: "Alert history" },
      { label: "AI insights", value: count(dataset.aiInsights.length), hint: "Lead scoring snapshots" },
      { label: "Daily briefings", value: count(dataset.briefings.length), hint: "Generated briefings" },
      { label: "Undo history", value: count(dataset.undoActions.length), hint: "Recoverable operations" },
      { label: "CRM users", value: count(dataset.users.length), hint: "Directory (no credentials)" },
    ],
    3
  );

  builder.heading("Sales assets", "Packages, portfolio samples and WhatsApp templates used by the sales team.");
  tableSection(builder, {
    title: "Website packages",
    columns: [
      { header: "Package", width: 1.5, maxLines: 2 },
      { header: "Price", width: 1, align: "right" },
      { header: "Starting price?", width: 0.8, maxLines: 1 },
      { header: "Hosting", width: 1.2, maxLines: 2 },
      { header: "Domain", width: 1.2, maxLines: 2 },
      { header: "Active", width: 0.5, align: "center", maxLines: 1 },
      { header: "Inclusions", width: 2.6, maxLines: 4 },
    ],
    rows: dataset.packages.map((pkg) => [
      pkg.name,
      inr(Number(pkg.price)),
      pkg.isStartingPrice ? "Yes" : "No",
      dash(pkg.hosting),
      dash(pkg.domain),
      pkg.isActive ? "Yes" : "No",
      pkg.inclusions,
    ]),
    totals: [count(dataset.packages.length) + " packages", "", "", "", "", "", ""],
    emptyMessage: "No website packages configured.",
    fullDataSetFile: "Raw Data/sales_assets.csv",
  });

  tableSection(builder, {
    title: "Website samples",
    columns: [
      { header: "Sample", width: 1.5, maxLines: 2 },
      { header: "Category", width: 1 },
      { header: "Type", width: 0.7, maxLines: 1 },
      { header: "Active", width: 0.5, align: "center", maxLines: 1 },
      { header: "URL", width: 3.2, maxLines: 3 },
      { header: "Added (IST)", width: 0.9, maxLines: 1 },
    ],
    rows: dataset.samples.map((sample) => [
      dash(sample.label) || "Untitled sample",
      sample.category,
      sample.type,
      sample.isActive ? "Yes" : "No",
      sample.url,
      dateIst(sample.createdAt),
    ]),
    totals: [count(dataset.samples.length) + " samples", "", "", "", "", ""],
    emptyMessage: "No website samples configured.",
    fullDataSetFile: "Raw Data/sales_assets.csv",
  });

  tableSection(builder, {
    title: "WhatsApp templates",
    columns: [
      { header: "Title", width: 1.4, maxLines: 2 },
      { header: "Category", width: 1.2, maxLines: 2 },
      { header: "Active", width: 0.5, align: "center", maxLines: 1 },
      { header: "Created by", width: 1.1, maxLines: 2 },
      { header: "Message", width: 3.2, maxLines: 5 },
    ],
    rows: dataset.templates.map((template) => [
      template.title,
      template.category.replace(/_/g, " "),
      template.isActive ? "Yes" : "No",
      template.createdByUserId
        ? usersById.get(template.createdByUserId)?.name ?? template.createdByUserId
        : "System",
      template.message,
    ]),
    totals: [count(dataset.templates.length) + " templates", "", "", "", ""],
    emptyMessage: "No WhatsApp templates configured.",
    fullDataSetFile: "Raw Data/sales_assets.csv",
  });

  builder.heading("Loss events", "Structured reasons recorded when opportunities were lost.");
  tableSection(builder, {
    title: "Recorded loss events",
    columns: [
      { header: "Client", width: 1.4, maxLines: 2 },
      { header: "Reason", width: 1.1, maxLines: 2 },
      { header: "Lost at (IST)", width: 1, maxLines: 1 },
      { header: "Recorded by", width: 1.1, maxLines: 2 },
      { header: "Note", width: 2.6, maxLines: 3 },
    ],
    rows: [...dataset.lossEvents]
      .sort((left, right) => new Date(right.lostAt).getTime() - new Date(left.lostAt).getTime())
      .map((event) => [
        leadsById.get(event.leadId)?.name ?? "Deleted client",
        event.reason.replace(/_/g, " "),
        dateIst(event.lostAt),
        event.createdByUserId ? usersById.get(event.createdByUserId)?.name ?? event.createdByUserId : "System",
        dash(event.note),
      ]),
    totals: [count(dataset.lossEvents.length) + " loss events", "", "", "", ""],
    emptyMessage: "No loss events recorded.",
    fullDataSetFile: "Raw Data/loss_events.csv",
  });

  builder.heading("Sales notifications", "In-app alert history generated by the CRM attention engine.");
  builder.table({
    columns: [
      { header: "Notification", width: 2.2 },
      { header: "Count", width: 0.7, align: "right" },
    ],
    rows: countBy(dataset.notifications, (notification) => notification.type).map((bucket) => [
      bucket.key,
      count(bucket.count),
    ]),
    totals: ["All notification types", count(dataset.notifications.length)],
    emptyMessage: "No sales notifications recorded.",
  });
  builder.table({
    caption: "Notification status and priority",
    columns: [
      { header: "Dimension", width: 1.6 },
      { header: "Value", width: 1.4 },
      { header: "Count", width: 0.7, align: "right" },
    ],
    rows: [
      ...countBy(dataset.notifications, (notification) => notification.status).map((bucket) => [
        "Status",
        bucket.key,
        count(bucket.count),
      ]),
      ...countBy(dataset.notifications, (notification) => notification.priority).map((bucket) => [
        "Priority",
        bucket.key,
        count(bucket.count),
      ]),
    ],
    emptyMessage: "No sales notifications recorded.",
  });

  tableSection(builder, {
    title: "Recent notifications",
    columns: [
      { header: "Created (IST)", width: 1, maxLines: 1 },
      { header: "Client", width: 1.3, maxLines: 2 },
      { header: "Priority", width: 0.7, maxLines: 1 },
      { header: "Status", width: 0.75, maxLines: 1 },
      { header: "Title", width: 1.6, maxLines: 2 },
      { header: "Recommendation", width: 2.4, maxLines: 3 },
    ],
    rows: [...dataset.notifications]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .map((notification) => [
        dateTimeIst(notification.createdAt),
        notification.leadId ? leadsById.get(notification.leadId)?.name ?? "Deleted client" : "Workspace",
        notification.priority,
        notification.status,
        notification.title,
        notification.recommendedAction,
      ]),
    totals: [count(dataset.notifications.length) + " notifications", "", "", "", "", ""],
    emptyMessage: "No sales notifications recorded.",
    fullDataSetFile: "Raw Data/notifications.csv",
  });

  builder.heading("Daily briefings", "Generated management briefings with their structured metadata.");
  tableSection(builder, {
    title: "Daily briefing history",
    columns: [
      { header: "Briefing date", width: 0.9 },
      { header: "Owner", width: 1.2, maxLines: 2 },
      { header: "Generated (IST)", width: 1, maxLines: 1 },
      { header: "Summary", width: 3.8, maxLines: 5 },
    ],
    rows: [...dataset.briefings]
      .sort((left, right) => right.briefingDate.localeCompare(left.briefingDate))
      .map((briefing) => [
        briefing.briefingDate,
        usersById.get(briefing.userId)?.name ?? briefing.userId,
        dateIst(briefing.generatedAt),
        briefing.summary,
      ]),
    totals: [count(dataset.briefings.length) + " briefings", "", "", ""],
    emptyMessage: "No daily briefings generated.",
    fullDataSetFile: "Raw Data/daily_briefings.csv",
  });

  builder.heading("AI insights", "Lead scoring snapshots produced by the AI attention engine.");
  tableSection(builder, {
    title: "Lead insight records",
    columns: [
      { header: "Client", width: 1.3, maxLines: 2 },
      { header: "Score", width: 0.5, align: "right", maxLines: 1 },
      { header: "Priority", width: 0.75, maxLines: 1 },
      { header: "Last analysed (IST)", width: 1, maxLines: 1 },
      { header: "Score reason", width: 2.1, maxLines: 4 },
      { header: "Recommended action", width: 2.1, maxLines: 4 },
    ],
    rows: [...dataset.aiInsights]
      .sort((left, right) => right.score - left.score)
      .map((insight) => [
        leadsById.get(insight.leadId)?.name ?? "Deleted client",
        String(insight.score),
        insight.priority,
        dateIst(insight.lastAnalyzedAt),
        insight.scoreReason,
        insight.recommendedAction,
      ]),
    totals: [count(dataset.aiInsights.length) + " insights", "", "", "", "", ""],
    emptyMessage: "No AI insights recorded.",
    fullDataSetFile: "Raw Data/ai_insights.csv",
  });

  builder.heading("Recovery & operational history", "Undo history and the mobile alert dispatch log.");
  tableSection(builder, {
    title: "Undo history",
    description: "Recoverable operations recorded by the CRM undo engine (snapshots retained for restoration).",
    columns: [
      { header: "Created (IST)", width: 0.95, maxLines: 1 },
      { header: "Action", width: 1.1, maxLines: 2 },
      { header: "Entity", width: 0.9, maxLines: 2 },
      { header: "Description", width: 2.2, maxLines: 3 },
      { header: "Performed by", width: 1.1, maxLines: 2 },
      { header: "Undone (IST)", width: 0.9, maxLines: 1 },
      { header: "Expires (IST)", width: 0.9, maxLines: 1 },
    ],
    rows: [...dataset.undoActions]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .map((action) => [
        dateTimeIst(action.createdAt),
        action.actionType.replace(/_/g, " "),
        action.entityType.replace(/_/g, " "),
        action.description,
        action.createdByUserId ? usersById.get(action.createdByUserId)?.name ?? action.createdByUserId : "System",
        action.undoneAt ? dateTimeIst(action.undoneAt) : "—",
        dateIst(action.expiresAt),
      ]),
    totals: [count(dataset.undoActions.length) + " entries", "", "", "", "", "", ""],
    emptyMessage: "No undo history recorded.",
    fullDataSetFile: "Raw Data/undo_actions.csv",
  });

  tableSection(builder, {
    title: "Mobile alert dispatch log",
    columns: [
      { header: "Dispatched (IST)", width: 1, maxLines: 1 },
      { header: "Category", width: 0.9, maxLines: 1 },
      { header: "Client", width: 1.2, maxLines: 2 },
      { header: "Title", width: 1.6, maxLines: 2 },
      { header: "Delivered", width: 0.7, maxLines: 1 },
    ],
    rows: [...dataset.mobileAlerts]
      .sort((left, right) => new Date(right.dispatchedAt).getTime() - new Date(left.dispatchedAt).getTime())
      .map((alert) => [
        dateTimeIst(alert.dispatchedAt),
        alert.category.replace(/_/g, " "),
        alert.leadId ? leadsById.get(alert.leadId)?.name ?? "Deleted client" : "Workspace",
        alert.title,
        alert.success ? "Yes" : "No",
      ]),
    totals: [count(dataset.mobileAlerts.length) + " alerts", "", "", "", ""],
    emptyMessage: "No mobile alerts dispatched.",
    fullDataSetFile: "Raw Data/mobile_alert_log.csv",
  });

  builder.heading("CRM user directory", "Workspace members, included so activity authorship remains restorable.");
  tableSection(builder, {
    title: "Users",
    columns: [
      { header: "Name", width: 1.4, maxLines: 2 },
      { header: "Email", width: 1.8, maxLines: 2 },
      { header: "Role", width: 0.7, maxLines: 1 },
      { header: "Created (IST)", width: 1, maxLines: 1 },
      { header: "User id", width: 2.2, maxLines: 1, fontSize: 6.8 },
    ],
    rows: dataset.users.map((user) => [
      user.name,
      user.email,
      user.role,
      dateIst(user.createdAt),
      user.id,
    ]),
    totals: [count(dataset.users.length) + " users", "", "", "", ""],
    emptyMessage: "No users found.",
    fullDataSetFile: "Raw Data/users.csv",
  });

  builder.addCallout(
    "Deliberately excluded data",
    [
      ...EXCLUDED_CATEGORIES.map((category) => `${category.label}: ${category.reason}`),
      "No authentication secret, API key, session token, password hash or push subscription key is present anywhere in this backup archive.",
    ],
    "warning"
  );

  builder.addCallout(
    "Record coverage for this report",
    [
      `Personal notes: ${count(a.notes.personalNotes)} · Activities: ${count(a.activities.total)} · Lead notes: ${count(a.notes.leadsWithNotes)} leads.`,
      "Every category in this report is also exported as a machine-readable CSV plus the complete JSON document for potential future restoration.",
    ],
    "info"
  );
}