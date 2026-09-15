"use client";

import { Plus } from "lucide-react";
import { SUPPORTED_PLACEHOLDERS } from "../placeholders";

interface PlaceholderChipsProps {
  onInsert: (placeholderKey: string) => void;
  className?: string;
}

export function PlaceholderChips({ onInsert, className = "" }: PlaceholderChipsProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Insert Dynamic Placeholder
        </span>
        <span className="text-[10px] text-slate-400">Click to insert into message</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SUPPORTED_PLACEHOLDERS.filter(item => item.key !== "{budget}").map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onInsert(item.key)}
            title={`Insert ${item.label} (${item.key}) - e.g. "${item.sampleValue}"`}
            aria-label={`Insert placeholder ${item.label}`}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 active:bg-emerald-100 transition-colors"
          >
            <Plus size={12} className="text-slate-400 shrink-0" aria-hidden="true" />
            <code className="text-emerald-700 font-mono text-[11px]">{item.key}</code>
            <span className="text-[10px] text-slate-500 font-normal">({item.label})</span>
          </button>
        ))}
      </div>
    </div>
  );
}
