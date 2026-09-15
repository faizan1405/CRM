"use client";

import type { Activity } from "./types";

const iconMap: Record<string, { bg: string; text: string; label: string }> = {
  LEAD_CREATED: { bg: "bg-blue-50", text: "text-blue-600", label: "Lead created" },
  LEAD_UPDATED: { bg: "bg-slate-50", text: "text-slate-600", label: "Lead updated" },
  NOTE_ADDED: { bg: "bg-emerald-50", text: "text-emerald-600", label: "Note added" },
  NOTE_EDITED: { bg: "bg-emerald-50", text: "text-emerald-600", label: "Note edited" },
  NOTE_DELETED: { bg: "bg-red-50", text: "text-red-600", label: "Note deleted" },
  STATUS_CHANGED: { bg: "bg-amber-50", text: "text-amber-600", label: "Status changed" },
  FOLLOWUP_CREATED: { bg: "bg-violet-50", text: "text-violet-600", label: "Follow-up created" },
  FOLLOWUP_RESCHEDULED: { bg: "bg-orange-50", text: "text-orange-600", label: "Follow-up rescheduled" },
  FOLLOWUP_COMPLETED: { bg: "bg-emerald-50", text: "text-emerald-600", label: "Follow-up completed" },
  FOLLOWUP_CANCELLED: { bg: "bg-red-50", text: "text-red-600", label: "Follow-up cancelled" },
};

function NoteIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function StatusIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function FollowUpIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function LeadIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function getIcon(type: string) {
  if (type.startsWith("NOTE")) return <NoteIcon />;
  if (type === "STATUS_CHANGED") return <StatusIcon />;
  if (type.startsWith("FOLLOWUP")) return <FollowUpIcon />;
  return <LeadIcon />;
}

type ActivityIconProps = { activity: Activity };

export function ActivityIcon({ activity }: ActivityIconProps) {
  const info = iconMap[activity.type] ?? { bg: "bg-slate-50", text: "text-slate-600", label: "Activity" };

  return (
    <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full transition-all duration-150 hover:scale-110 ${info.bg} ${info.text}`} aria-hidden="true">
      {getIcon(activity.type)}
    </span>
  );
}
