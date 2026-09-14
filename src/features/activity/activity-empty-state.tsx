"use client";

import type { ActivityFilter } from "./types";

type ActivityEmptyStateProps = {
  filter: ActivityFilter;
  hasNotes?: boolean;
};

const FILTER_MESSAGES: Record<ActivityFilter, { title: string; description: string }> = {
  all: {
    title: "No activity yet.",
    description: "Add the first note to start tracking this lead.",
  },
  notes: {
    title: "No notes yet.",
    description: "Add the first note to start tracking this lead.",
  },
  status: {
    title: "No status changes.",
    description: "Status changes will appear here.",
  },
  followups: {
    title: "No follow-ups.",
    description: "Follow-up activity will appear here.",
  },
};

export function ActivityEmptyState({ filter }: ActivityEmptyStateProps) {
  const { title, description } = FILTER_MESSAGES[filter] ?? FILTER_MESSAGES.all;

  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 max-w-[200px] text-xs text-slate-500">{description}</p>
    </div>
  );
}
