"use client";

import { Pin, Trash2, Edit3, Clock } from "lucide-react";
import type { PersonalNote } from "../types";

interface NoteCardProps {
  note: PersonalNote;
  isSelected?: boolean;
  onOpen: (note: PersonalNote) => void;
  onEdit: (note: PersonalNote) => void;
  onTogglePin: (note: PersonalNote) => void;
  onDeleteRequest: (note: PersonalNote) => void;
  className?: string;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

export function NoteCard({
  note,
  isSelected = false,
  onOpen,
  onEdit,
  onTogglePin,
  onDeleteRequest,
  className = "",
}: NoteCardProps) {
  const displayTitle = note.title.trim() || note.content.split("\n")[0]?.slice(0, 40) || "Untitled Note";

  return (
    <article
      onClick={() => onOpen(note)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen(note);
        }
      }}
      aria-label={`Personal note: ${displayTitle}`}
      className={`group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-colors duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
        isSelected
          ? "border-blue-600 bg-blue-50/40 shadow-sm ring-2 ring-blue-500/20"
          : note.pinned
          ? "border-amber-200/90 bg-amber-50/20 shadow-xs hover:border-amber-300 hover:shadow-md"
          : "border-slate-200 bg-white shadow-xs hover:border-slate-300 hover:shadow-md"
      } ${className}`}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {note.pinned && (
              <span
                className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900 border border-amber-200"
                title="Pinned Note"
              >
                <Pin size={10} className="fill-amber-700 text-amber-700" aria-hidden="true" />
                Pinned
              </span>
            )}
            <h3 className="truncate text-sm font-bold text-slate-950">
              {displayTitle}
            </h3>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          className="flex shrink-0 items-center gap-1"
          onClick={(e) => e.stopPropagation()} // Prevent triggering onOpen
        >
          {/* Pin / Unpin Button */}
          <button
            type="button"
            onClick={() => onTogglePin(note)}
            className={`grid size-8 place-items-center rounded-lg transition-colors ${
              note.pinned
                ? "text-amber-600 hover:bg-amber-100"
                : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            }`}
            title={note.pinned ? "Unpin note" : "Pin note"}
            aria-label={note.pinned ? `Unpin ${displayTitle}` : `Pin ${displayTitle}`}
          >
            <Pin
              size={15}
              className={note.pinned ? "fill-amber-600 text-amber-600" : ""}
              aria-hidden="true"
            />
          </button>

          {/* Edit Button */}
          <button
            type="button"
            onClick={() => onEdit(note)}
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title="Edit note"
            aria-label={`Edit ${displayTitle}`}
          >
            <Edit3 size={15} aria-hidden="true" />
          </button>

          {/* Delete Button */}
          <button
            type="button"
            onClick={() => onDeleteRequest(note)}
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
            title="Delete note"
            aria-label={`Delete ${displayTitle}`}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Note Content Preview */}
      <p className="mt-2.5 line-clamp-3 text-xs text-slate-600 leading-relaxed break-words whitespace-pre-wrap">
        {note.content}
      </p>

      {/* Tags and Timestamps */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100/80 pt-2.5 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <Clock size={12} aria-hidden="true" />
          <span>Updated {formatRelativeTime(note.updatedAt || note.createdAt)}</span>
        </span>

        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {note.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600 text-[10px]"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
