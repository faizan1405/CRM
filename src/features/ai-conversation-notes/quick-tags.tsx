"use client";

import { Check, Tag } from "lucide-react";
import type { QuickTag } from "./types";
import { DEFAULT_QUICK_TAGS } from "./mock-data";

interface QuickTagsProps {
  selectedTags: QuickTag[];
  onChange: (tags: QuickTag[]) => void;
  availableTags?: QuickTag[];
  disabled?: boolean;
}

const TAG_STYLES: Record<string, { active: string; inactive: string }> = {
  Interested: {
    active: "bg-emerald-100 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/30",
    inactive: "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50",
  },
  "Price Concern": {
    active: "bg-amber-100 text-amber-900 border-amber-300 ring-1 ring-amber-400/30",
    inactive: "bg-white text-amber-800 border-amber-200 hover:bg-amber-50",
  },
  "Follow-up Required": {
    active: "bg-blue-100 text-blue-800 border-blue-300 ring-1 ring-blue-400/30",
    inactive: "bg-white text-blue-700 border-blue-200 hover:bg-blue-50",
  },
  "Decision Maker": {
    active: "bg-purple-100 text-purple-800 border-purple-300 ring-1 ring-purple-400/30",
    inactive: "bg-white text-purple-700 border-purple-200 hover:bg-purple-50",
  },
  "No Response": {
    active: "bg-slate-200 text-slate-800 border-slate-400 ring-1 ring-slate-400/30",
    inactive: "bg-white text-slate-700 border-slate-200 hover:bg-slate-100",
  },
};

export function QuickTags({
  selectedTags,
  onChange,
  availableTags = DEFAULT_QUICK_TAGS,
  disabled = false,
}: QuickTagsProps) {
  const toggleTag = (tag: QuickTag) => {
    if (disabled) return;
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter((t) => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <Tag className="size-3.5" aria-hidden="true" />
        <span>Quick Tags</span>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Conversation tags">
        {availableTags.map((tag) => {
          const isSelected = selectedTags.includes(tag);
          const style = TAG_STYLES[tag] || {
            active: "bg-blue-100 text-blue-800 border-blue-300 ring-1 ring-blue-400/30",
            inactive: "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
          };

          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                isSelected ? style.active : style.inactive
              }`}
            >
              {isSelected ? (
                <Check className="size-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <span className="size-1.5 rounded-full bg-slate-300" aria-hidden="true" />
              )}
              <span>{tag}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
