import { count, dateIst, dateTimeIst, leadStatusLabel, pct, tableSection, type ReportContext } from "./shared";
import type { ReportBuilder } from "../report-builder";

interface FollowUpRow {
  id: string;
  client: string;
  phone: string;
  leadStatus: string;
  type: string;
  scheduledAt: Date;
  scheduledIst: string;
  timing: string;
  status: string;
  completedAt: Date | null;
  note: string;
  daysOverdue: number;
}

function istDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function daysBetween(fromIst: string, toIst: string): number {
  const from = new Date(`${fromIst}T00:00:00Z`).getTime();
  const to = new Date(`${toIst}T00:00:00Z`).getTime();
  return Math.max(0, Math.floor((to - from) / (1000 * 60 * 60 * 24)));
}

/**
 * 06 — Follow-ups Report: every follow-up on record (pending, completed, cancelled, overdue and
 * historical) with its dates, status, client and notes.
 */
export function renderFollowUps(builder: ReportBuilder, ctx: ReportContext): void {
  const { analytics: a, dataset } = ctx;
  const leadsById = new Map(dataset.leads.map((lead) => [lead.id, lead]));
  const todayIst = a.todayIst;

  builder.heading("Follow-up health", "Operational follow-up load, including completed and cancelled history.");
  builder.kpiCards(
    [
      { label: "Total follow-ups", value: count(a.followUps.total), hint: "Complete history" },
      { label: "Pending", value: count(a.followUps.pending), hint: `${count(a.followUps.leadsWithPending)} clients with an open follow-up` },
      { label: "Overdue", value: count(a.followUps.overdue), hint: "Scheduled before today", tone: a.followUps.overdue > 0 ? "critical" : "positive" },
      { label: "Due today", value: count(a.followUps.dueToday), hint: "Scheduled for today (IST)", tone: "warning" },
      { label: "Upcoming", value: count(a.followUps.upcoming), hint: "Scheduled after today", tone: "info" },
      { label: "Completed", value: count(a.followUps.completed), hint: "Closed as done", tone: "positive" },
      { label: "Cancelled", value: count(a.followUps.cancelled), hint: "Cancelled follow-ups" },
      { label: "Completion rate", value: pct(a.followUps.completionRate), hint: "Completed ÷ all follow-ups", tone: "info" },
      { label: "Latest scheduled", value: a.followUps.latestScheduledAt ? dateIst(a.followUps.latestScheduledAt) : "—", hint: "Most future-dated entry" },
    ],
    3
  );

  const rows: FollowUpRow[] = dataset.followUps.map((followUp) => {
    const lead = leadsById.get(followUp.leadId);
    const scheduledAt = new Date(followUp.scheduledAt);
    const scheduledIst = istDay(scheduledAt);

    let timing: string;
    let daysOverdue = 0;
    if (followUp.status === "COMPLETED") {
      timing = "Completed";
    } else if (followUp.status === "CANCELLED") {
      timing = "Cancelled";
    } else if (scheduledIst < todayIst) {
      timing = "Overdue";
      daysOverdue = daysBetween(scheduledIst, todayIst);
    } else if (scheduledIst === todayIst) {
      timing = "Due today";
    } else {
      timing = "Upcoming";
    }

    return {
      id: followUp.id,
      client: lead?.name ?? "Deleted client",
      phone: lead?.phone ?? "—",
      leadStatus: lead ? leadStatusLabel(lead.status) : "—",
      type: followUp.type.replace(/_/g, " "),
      scheduledAt,
      scheduledIst,
      timing,
      status: followUp.status.replace(/_/g, " "),
      completedAt: followUp.completedAt ? new Date(followUp.completedAt) : null,
      note: followUp.note ?? "—",
      daysOverdue,
    };
  });

  const bySchedule = [...rows].sort(
    (left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime()
  );

  tableSection(builder, {
    title: "Complete follow-up register",
    description: "Every follow-up ever recorded, ordered by scheduled date, with its client, status and note.",
    columns: [
      { header: "#", width: 0.32, align: "right", maxLines: 1, fontSize: 7.2 },
      { header: "Client", width: 1.4, maxLines: 2 },
      { header: "Phone", width: 0.95 },
      { header: "Lead status", width: 0.8, maxLines: 1 },
      { header: "Channel", width: 0.75, maxLines: 1 },
      { header: "Scheduled (IST)", width: 1.15, maxLines: 1 },
      { header: "Timing", width: 0.75, maxLines: 1 },
      { header: "Status", width: 0.75, maxLines: 1 },
      { header: "Completed (IST)", width: 0.95 },
      { header: "Note", width: 1.9, maxLines: 3 },
    ],
    rows: bySchedule.map((row, index) => [
      String(index + 1),
      row.client,
      row.phone,
      row.leadStatus,
      row.type,
      dateTimeIst(row.scheduledAt),
      row.timing,
      row.status,
      row.completedAt ? dateTimeIst(row.completedAt) : "—",
      row.note,
    ]),
    totals: [
      "",
      count(a.followUps.leadsWithPending) + " clients pending",
      "",
      "",
      count(a.followUps.total) + " follow-ups",
      "",
      count(a.followUps.overdue) + " overdue",
      count(a.followUps.pending) + " pending",
      "",
      "",
    ],
    emptyMessage: "No follow-ups have been recorded yet.",
    fullDataSetFile: "Raw Data/followups.csv",
  });

  const overdueRows = bySchedule.filter((row) => row.timing === "Overdue");
  tableSection(builder, {
    title: "Overdue follow-ups",
    description: "Open follow-ups whose scheduled date has already passed (IST).",
    columns: [
      { header: "Client", width: 1.4, maxLines: 2 },
      { header: "Phone", width: 0.95 },
      { header: "Lead status", width: 0.85, maxLines: 1 },
      { header: "Scheduled (IST)", width: 1.15 },
      { header: "Days overdue", width: 0.75, align: "right" },
      { header: "Channel", width: 0.75, maxLines: 1 },
      { header: "Note", width: 2.1, maxLines: 3 },
    ],
    rows: overdueRows.map((row) => [
      row.client,
      row.phone,
      row.leadStatus,
      dateTimeIst(row.scheduledAt),
      String(row.daysOverdue),
      row.type,
      row.note,
    ]),
    totals: [count(overdueRows.length) + " overdue", "", "", "", "", "", ""],
    emptyMessage: "No overdue follow-ups — the follow-up queue is clear.",
    fullDataSetFile: "Raw Data/followups.csv",
  });

  const closedRows = bySchedule.filter((row) => row.status === "Completed" || row.status === "Cancelled");
  tableSection(builder, {
    title: "Historical follow-ups (completed & cancelled)",
    columns: [
      { header: "Client", width: 1.4, maxLines: 2 },
      { header: "Channel", width: 0.75, maxLines: 1 },
      { header: "Scheduled (IST)", width: 1.15, maxLines: 1 },
      { header: "Status", width: 0.8, maxLines: 1 },
      { header: "Completed (IST)", width: 1, maxLines: 1 },
      { header: "Note", width: 2.2, maxLines: 3 },
    ],
    rows: closedRows.map((row) => [
      row.client,
      row.type,
      dateTimeIst(row.scheduledAt),
      row.status,
      row.completedAt ? dateTimeIst(row.completedAt) : "—",
      row.note,
    ]),
    totals: [
      count(a.followUps.completed) + " completed",
      "",
      "",
      count(a.followUps.cancelled) + " cancelled",
      "",
      "",
    ],
    emptyMessage: "No completed or cancelled follow-ups recorded.",
    fullDataSetFile: "Raw Data/followups.csv",
  });

  builder.heading("Follow-up breakdown");
  builder.table({
    columns: [
      { header: "Channel", width: 1.4 },
      { header: "Follow-ups", width: 0.7, align: "right" },
      { header: "Share", width: 0.7, align: "right" },
    ],
    rows: a.followUps.byType.map((bucket) => [
      bucket.key,
      count(bucket.count),
      pct(a.followUps.total > 0 ? (bucket.count / a.followUps.total) * 100 : 0),
    ]),
    totals: ["All channels", count(a.followUps.total), pct(100)],
    emptyMessage: "No follow-ups recorded.",
  });

  builder.barList(
    [
      { label: "Overdue", value: a.followUps.overdue, display: count(a.followUps.overdue) },
      { label: "Due today", value: a.followUps.dueToday, display: count(a.followUps.dueToday) },
      { label: "Upcoming", value: a.followUps.upcoming, display: count(a.followUps.upcoming) },
      { label: "Completed", value: a.followUps.completed, display: count(a.followUps.completed) },
      { label: "Cancelled", value: a.followUps.cancelled, display: count(a.followUps.cancelled) },
    ],
    { tone: "info", labelWidth: 130 }
  );

  builder.addCallout(
    "Follow-up data note",
    [
      "Timing states are evaluated against today's date in Indian Standard Time (IST / Asia/Kolkata) at the moment of export.",
      `All ${count(a.followUps.total)} follow-up records are included, including those belonging to archived or deleted leads where the record still exists. Full text of every note is exported in Raw Data/followups.csv.`,
    ],
    "info"
  );
}