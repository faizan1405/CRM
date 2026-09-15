"use client";

import type { Activity, ActivityFilter } from "./types";
import { ActivityItem } from "./activity-item";
import { ActivityEmptyState } from "./activity-empty-state";

type LeadActivityTimelineProps = {
  activities: Activity[];
  filter: ActivityFilter;
  onFilterChange: (filter: ActivityFilter) => void;
  onEditNote?: (data: { id: string; noteId: string; noteText: string }) => void;
  onDeleteNote?: (data: { id: string; noteId: string }) => void;
  noteComposer?: React.ReactNode;
};

const FILTERS: { key: ActivityFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "notes", label: "Notes" },
  { key: "status", label: "Status" },
  { key: "followups", label: "Follow-ups" },
];

function matchesFilter(activity: Activity, filter: ActivityFilter): boolean {
  if (filter === "all") return true;
  if (filter === "notes") return activity.type.startsWith("NOTE");
  if (filter === "status") return activity.type === "STATUS_CHANGED";
  if (filter === "followups") return activity.type.startsWith("FOLLOWUP");
  return true;
}

export function LeadActivityTimeline({
  activities,
  filter,
  onFilterChange,
  onEditNote,
  onDeleteNote,
  noteComposer,
}: LeadActivityTimelineProps) {
  const filtered = activities.filter((a) => matchesFilter(a, filter));
  const filterCounts = {
    all: activities.length,
    notes: activities.filter((a) => a.type.startsWith("NOTE")).length,
    status: activities.filter((a) => a.type === "STATUS_CHANGED").length,
    followups: activities.filter((a) => a.type.startsWith("FOLLOWUP")).length,
  };

  return (
    <div className="flex min-w-0 flex-col">
      {/* Filter tabs */}
      <div
        className="sticky top-0 z-10 min-w-0 shrink-0 overflow-x-auto rounded-t-xl border-b border-slate-200 bg-white"
        role="tablist"
        aria-label="Activity filters"
      >
        <div className="flex min-w-max">
          {FILTERS.map((f) => {
            const isActive = filter === f.key;
            const count = filterCounts[f.key];
            return (
              <button
                key={f.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => onFilterChange(f.key)}
                className={`relative flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "text-blue-700"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                {f.label}
                {count > 0 && (
                  <span className={`inline-flex h-4.5 min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
                    isActive ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                  }`}>
                    {count}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Activity list */}
      <div className="min-w-0">
        {filtered.length === 0 ? (
          <ActivityEmptyState filter={filter} hasNotes={activities.some((a) => a.type.startsWith("NOTE"))} />
        ) : (
          <ol className="px-4 py-3 sm:px-6" aria-label="Activity timeline">
            {filtered.map((activity) => (
              <ActivityItem
                key={activity.id}
                activity={activity}
                onEditNote={onEditNote}
                onDeleteNote={onDeleteNote}
              />
            ))}
          </ol>
        )}
      </div>

      {/* Note composer at bottom */}
      {noteComposer && (
        <div className="shrink-0 border-t border-slate-200 bg-white p-3 sm:p-4">
          {noteComposer}
        </div>
      )}
    </div>
  );
}
