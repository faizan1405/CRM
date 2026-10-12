import { count, dash, dateIst, dateTimeIst, tableSection, type ReportContext } from "./shared";
import type { ReportBuilder } from "../report-builder";

function monthKeyIst(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short", year: "numeric" }).format(
    new Date(Date.UTC(year, (month || 1) - 1, 1))
  );
}

/**
 * 07 — Activities & Notes: the client activity trail (including call outcomes recorded as
 * activities), lead notes and personal notes, all with IST timestamps and owning records.
 */
export function renderActivities(builder: ReportBuilder, ctx: ReportContext): void {
  const { analytics: a, dataset } = ctx;
  const leadsById = new Map(dataset.leads.map((lead) => [lead.id, lead]));
  const usersById = new Map(dataset.users.map((user) => [user.id, user]));

  builder.heading("Activity & notes summary", "Everything logged against client records and personal note-keeping.");
  builder.kpiCards(
    [
      { label: "Activity entries", value: count(a.activities.total), hint: "Complete activity trail" },
      { label: "Notes added", value: count(a.activities.noteActivities), hint: "NOTE_ADDED activities" },
      { label: "Status changes", value: count(a.activities.statusChangeActivities), hint: "Pipeline stage transitions" },
      { label: "Last 30 days", value: count(a.activities.last30Days), hint: "Recent activity volume", tone: "info" },
      { label: "Personal notes", value: count(a.notes.personalNotes), hint: `${count(a.notes.pinnedPersonalNotes)} pinned` },
      { label: "Leads with notes", value: count(a.notes.leadsWithNotes), hint: `${count(a.notes.leadNotesCharacters)} characters` },
    ],
    3
  );

  const activities = [...dataset.activities].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );

  tableSection(builder, {
    title: "Client activity trail",
    description: "Every activity record in chronological order, including call and follow-up outcomes captured by the CRM.",
    columns: [
      { header: "#", width: 0.32, align: "right", maxLines: 1, fontSize: 7.2 },
      { header: "When (IST)", width: 1.05, maxLines: 1 },
      { header: "Client", width: 1.35, maxLines: 2 },
      { header: "Activity", width: 1, maxLines: 2 },
      { header: "Details", width: 3.2, maxLines: 4 },
      { header: "Recorded by", width: 1.05, maxLines: 2 },
    ],
    rows: activities.map((activity, index) => [
      String(index + 1),
      dateTimeIst(activity.createdAt),
      leadsById.get(activity.leadId)?.name ?? "Deleted client",
      activity.type.replace(/_/g, " "),
      activity.message,
      activity.createdByUserId
        ? usersById.get(activity.createdByUserId)?.name ?? activity.createdByUserId
        : "System / automation",
    ]),
    totals: [count(activities.length) + " activities", "", "", "", "", ""],
    emptyMessage: "No activities have been logged yet.",
    fullDataSetFile: "Raw Data/activities.csv",
  });

  builder.heading("Activity analysis");
  builder.table({
    columns: [
      { header: "Activity type", width: 1.8 },
      { header: "Entries", width: 0.7, align: "right" },
      { header: "Share", width: 0.7, align: "right" },
    ],
    rows: a.activities.byType.map((bucket) => [
      bucket.key,
      count(bucket.count),
      `${a.activities.total > 0 ? ((bucket.count / a.activities.total) * 100).toFixed(2) : "0.00"}%`,
    ]),
    totals: ["All activity types", count(a.activities.total), "100.00%"],
    emptyMessage: "No activities recorded.",
  });

  builder.barList(
    a.activities.byType
      .slice(0, 10)
      .map((bucket) => ({ label: bucket.key, value: bucket.count, display: count(bucket.count) })),
    { tone: "info", maxItems: 10, labelWidth: 150, emptyMessage: "No activities recorded." }
  );

  const monthly = new Map<string, number>();
  for (const activity of activities) {
    const key = monthKeyIst(new Date(activity.createdAt));
    monthly.set(key, (monthly.get(key) ?? 0) + 1);
  }
  builder.table({
    caption: "Activity volume by month (IST)",
    columns: [
      { header: "Month", width: 1.6 },
      { header: "Activities", width: 0.8, align: "right" },
    ],
    rows: [...monthly.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([key, value]) => [monthLabel(key), count(value)]),
    emptyMessage: "No dated activities available.",
  });

  builder.heading("Personal notes", "Notes kept by CRM users, including pinned favourites.");
  tableSection(builder, {
    title: "Personal notes register",
    columns: [
      { header: "#", width: 0.32, align: "right", maxLines: 1, fontSize: 7.2 },
      { header: "Title", width: 1.5, maxLines: 2 },
      { header: "Owner", width: 1.2, maxLines: 2 },
      { header: "Pinned", width: 0.5, align: "center", maxLines: 1 },
      { header: "Created (IST)", width: 0.95, maxLines: 1 },
      { header: "Updated (IST)", width: 0.95, maxLines: 1 },
      { header: "Content", width: 3.2, maxLines: 5 },
    ],
    rows: [...dataset.personalNotes]
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .map((note, index) => [
        String(index + 1),
        dash(note.title) || "Untitled note",
        usersById.get(note.userId)?.name ?? note.userId,
        note.isPinned ? "Yes" : "No",
        dateIst(note.createdAt),
        dateIst(note.updatedAt),
        note.content,
      ]),
    totals: [count(dataset.personalNotes.length) + " notes", "", "", "", "", "", ""],
    emptyMessage: "No personal notes recorded.",
    fullDataSetFile: "Raw Data/notes.csv",
  });

  const leadsWithNotes = dataset.leads.filter((lead) => Boolean(lead.notes && lead.notes.trim()));
  tableSection(builder, {
    title: "Lead notes",
    description: "Free-text notes stored directly on client (lead) records.",
    columns: [
      { header: "Client", width: 1.4, maxLines: 2 },
      { header: "Business", width: 1.2, maxLines: 2 },
      { header: "Status", width: 0.85, maxLines: 1 },
      { header: "Updated (IST)", width: 0.95, maxLines: 1 },
      { header: "Note", width: 3.2, maxLines: 6 },
    ],
    rows: leadsWithNotes.map((lead) => [
      lead.name,
      dash(lead.business),
      lead.status.replace(/_/g, " "),
      dateIst(lead.updatedAt),
      lead.notes ?? "",
    ]),
    totals: [count(leadsWithNotes.length) + " leads with notes", "", "", "", ""],
    emptyMessage: "No lead notes recorded.",
    fullDataSetFile: "Raw Data/notes.csv",
  });

  builder.addCallout(
    "Where the full text lives",
    [
      "Long note and activity text is wrapped in full inside the tables above (up to the stated line limit per row); any row that exceeds the line limit is truncated with an ellipsis for layout only.",
      "The verbatim, unlimited text of every activity and note is exported in Raw Data/activities.csv, Raw Data/notes.csv and Raw Data/complete_crm_export.json.",
      `AI insight commentary associated with leads is listed in report 08 (Other CRM Records) and in Raw Data/ai_insights.csv.`,
    ],
    "info"
  );
}