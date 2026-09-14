"use client";

import { useState } from "react";
import type { AiBriefingData } from "../types";
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, Bot } from "lucide-react";

export type AiBriefingBannerProps = {
  data?: AiBriefingData;
  isLoading?: boolean;
  onRefresh?: () => void;
  className?: string;
};

export function AiBriefingBanner({
  data,
  isLoading = false,
  onRefresh,
  className = "",
}: AiBriefingBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!data && !isLoading) return null;

  return (
    <section
      aria-label="AI Sales Briefing"
      className={`relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/50 p-4 shadow-xs sm:p-5 ${className}`}
    >
      {/* Decorative subtle accent bar */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-indigo-500 to-blue-600"
      />

      <div className="flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100/90 px-2.5 py-1 text-xs font-semibold text-indigo-800">
              <Sparkles size={13} className="text-indigo-600" />
              AI Daily Intelligence
            </span>
            {data?.generatedAt && (
              <span className="text-[11px] font-medium text-slate-500">
                {data.generatedAt}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                aria-label="Refresh AI briefing"
                title="Regenerate summary (UI callback only)"
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200/80 bg-white/80 px-2.5 py-1.5 text-xs font-medium text-indigo-700 shadow-2xs hover:bg-white hover:text-indigo-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
              >
                <RefreshCw
                  size={12}
                  className={isLoading ? "animate-spin" : ""}
                />
                <span className="hidden xs:inline">
                  {isLoading ? "Analyzing..." : "Refresh"}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Narrative summary text */}
        <div className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className="hidden sm:grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white shadow-xs"
          >
            <Bot size={18} />
          </div>
          <div className="flex-1 text-sm sm:text-base">
            <p className="font-semibold leading-snug text-slate-900">
              {data?.summary}
            </p>

            {data?.recommendation && (
              <p className="mt-1.5 text-xs sm:text-sm text-indigo-950/80">
                <strong className="font-semibold text-indigo-900">
                  Recommended action:
                </strong>{" "}
                {data.recommendation}
              </p>
            )}
          </div>
        </div>

        {/* Expandable Key Points */}
        {data?.keyPoints && data.keyPoints.length > 0 && (
          <div className="border-t border-indigo-100/70 pt-2.5">
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              aria-expanded={isExpanded}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 hover:text-indigo-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
            >
              <span>{isExpanded ? "Hide key signals" : "Why these 3 leads?"}</span>
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {isExpanded && (
              <ul className="mt-2 space-y-1.5 pl-2 text-xs text-slate-700">
                {data.keyPoints.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-1 block size-1.5 shrink-0 rounded-full bg-indigo-500" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
