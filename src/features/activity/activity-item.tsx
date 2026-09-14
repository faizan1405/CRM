"use client";

import type { Activity, NoteAddedActivity, NoteEditedActivity, StatusChangedActivity, FollowUpCreatedActivity, FollowUpRescheduledActivity, FollowUpCompletedActivity, FollowUpCancelledActivity, LeadCreatedActivity, LeadUpdatedActivity } from "./types";
import { ActivityIcon } from "./activity-icon";
import { formatActivityTimestamp, formatFollowUpDateShort } from "./formatters";

function renderNoteText(text: string): string {
  if (text.length <= 120) return text;
  return text.slice(0, 120) + "...";
}

function ActivityNoteAdded({ activity }: { activity: NoteAddedActivity }) {
  return (
    <div>
      <p className="text-sm leading-relaxed text-slate-700">
        {renderNoteText(activity.noteText)}
      </p>
      {activity.noteText.length > 120 && (
        <button type="button" className="mt-1 text-xs font-medium text-blue-600 hover:text-blue-700">
          Show more
        </button>
      )}
    </div>
  );
}

function ActivityNoteEdited({ activity }: { activity: NoteEditedActivity }) {
  return (
    <div>
      <p className="text-sm leading-relaxed text-slate-700">
        {renderNoteText(activity.noteText)}
      </p>
      {activity.previousText && (
        <p className="mt-1 text-xs text-slate-400 line-through">
          {renderNoteText(activity.previousText)}
        </p>
      )}
    </div>
  );
}

function ActivityNoteDeleted({ activity }: { activity: { id: string; type: "NOTE_DELETED"; createdAt: string; actor: { id: string; name: string } | null; noteId: string } }) {
  return (
    <p className="text-sm text-slate-500 italic">A note was removed</p>
  );
}

function ActivityStatusChanged({ activity }: { activity: StatusChangedActivity }) {
  return (
    <div className="flex items-center gap-2">
      <StatusPill status={activity.previousStatus} />
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 shrink-0">
        <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
      </svg>
      <StatusPill status={activity.newStatus} />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    "New": "bg-slate-100 text-slate-700 ring-slate-200",
    "Contacted": "bg-blue-50 text-blue-700 ring-blue-200",
    "Qualified": "bg-amber-50 text-amber-700 ring-amber-200",
    "Proposal Sent": "bg-violet-50 text-violet-700 ring-violet-200",
    "Won": "bg-emerald-50 text-emerald-700 ring-emerald-200",
    "Lost": "bg-red-50 text-red-700 ring-red-200",
  };
  const cls = colors[status] ?? "bg-slate-100 text-slate-600 ring-slate-200";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>
      {status}
    </span>
  );
}

function ActivityFollowUpCreated({ activity }: { activity: FollowUpCreatedActivity }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="font-medium text-slate-700">{activity.followUpType}</span>
      <span className="text-slate-400">&middot;</span>
      <span className="text-slate-600">{formatFollowUpDateShort(activity.scheduledDate)}</span>
    </div>
  );
}

function ActivityFollowUpRescheduled({ activity }: { activity: FollowUpRescheduledActivity }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-slate-700">{activity.followUpType} rescheduled</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>{formatFollowUpDateShort(activity.previousDate)}</span>
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
          <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
        </svg>
        <span className="font-medium text-slate-700">{formatFollowUpDateShort(activity.newDate)}</span>
      </div>
    </div>
  );
}

function ActivityFollowUpCompleted({ activity }: { activity: FollowUpCompletedActivity }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="inline-flex items-center gap-1 text-emerald-700">
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span className="font-medium">{activity.followUpType} completed</span>
      </span>
    </div>
  );
}

function ActivityFollowUpCancelled({ activity }: { activity: FollowUpCancelledActivity }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="inline-flex items-center gap-1 text-red-700">
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        <span className="font-medium">{activity.followUpType} cancelled</span>
      </span>
    </div>
  );
}

function ActivityLeadCreated() {
  return (
    <p className="text-sm text-slate-600">Lead was created</p>
  );
}

function ActivityLeadUpdated({ activity }: { activity: LeadUpdatedActivity }) {
  return (
    <div className="text-sm text-slate-600">
      {activity.changes.length > 0 ? (
        <span>Updated: {activity.changes.join(", ").toLowerCase()}</span>
      ) : (
        <span>Lead details were updated</span>
      )}
    </div>
  );
}

type ActivityItemProps = {
  activity: Activity;
  onEditNote?: (activity: { id: string; noteId: string; noteText: string }) => void;
  onDeleteNote?: (activity: { id: string; noteId: string }) => void;
};

export function ActivityItem({ activity, onEditNote, onDeleteNote }: ActivityItemProps) {
  const timestamp = formatActivityTimestamp(activity.createdAt);
  const isNote = activity.type === "NOTE_ADDED" || activity.type === "NOTE_EDITED";

  return (
    <li className="relative flex gap-3">
      <div className="flex flex-col items-center">
        <ActivityIcon activity={activity} />
        <div className="mt-1.5 w-px flex-1 bg-slate-200 min-h-[16px]" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1 pb-5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500">
            {activity.type === "NOTE_ADDED" && "Note added"}
            {activity.type === "NOTE_EDITED" && "Note edited"}
            {activity.type === "NOTE_DELETED" && "Note deleted"}
            {activity.type === "STATUS_CHANGED" && "Status changed"}
            {activity.type === "FOLLOWUP_CREATED" && "Follow-up created"}
            {activity.type === "FOLLOWUP_RESCHEDULED" && "Follow-up rescheduled"}
            {activity.type === "FOLLOWUP_COMPLETED" && "Follow-up completed"}
            {activity.type === "FOLLOWUP_CANCELLED" && "Follow-up cancelled"}
            {activity.type === "LEAD_CREATED" && "Lead created"}
            {activity.type === "LEAD_UPDATED" && "Lead updated"}
          </span>
          <time dateTime={activity.createdAt} className="shrink-0 text-xs text-slate-400">
            {timestamp}
          </time>
        </div>

        <div className="mt-1.5">
          {activity.type === "NOTE_ADDED" && <ActivityNoteAdded activity={activity} />}
          {activity.type === "NOTE_EDITED" && <ActivityNoteEdited activity={activity} />}
          {activity.type === "NOTE_DELETED" && <ActivityNoteDeleted activity={activity} />}
          {activity.type === "STATUS_CHANGED" && <ActivityStatusChanged activity={activity} />}
          {activity.type === "FOLLOWUP_CREATED" && <ActivityFollowUpCreated activity={activity} />}
          {activity.type === "FOLLOWUP_RESCHEDULED" && <ActivityFollowUpRescheduled activity={activity} />}
          {activity.type === "FOLLOWUP_COMPLETED" && <ActivityFollowUpCompleted activity={activity} />}
          {activity.type === "FOLLOWUP_CANCELLED" && <ActivityFollowUpCancelled activity={activity} />}
          {activity.type === "LEAD_CREATED" && <ActivityLeadCreated />}
          {activity.type === "LEAD_UPDATED" && <ActivityLeadUpdated activity={activity} />}
        </div>

        {isNote && (onEditNote || onDeleteNote) && (
          <div className="mt-2 flex items-center gap-2">
            {onEditNote && (
              <button
                type="button"
                onClick={() => onEditNote({ id: activity.id, noteId: (activity as NoteAddedActivity | NoteEditedActivity).noteId, noteText: (activity as NoteAddedActivity | NoteEditedActivity).noteText })}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                aria-label="Edit note"
              >
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
                Edit
              </button>
            )}
            {onDeleteNote && (
              <button
                type="button"
                onClick={() => onDeleteNote({ id: activity.id, noteId: (activity as NoteAddedActivity | NoteEditedActivity).noteId })}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                aria-label="Delete note"
              >
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
