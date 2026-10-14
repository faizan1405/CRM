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
      className={`relative overflow-hidden rounded-2xl border border-border bg-card p-4 card-surface sm:p-5 ${className}`}
    >
      {/* Decorative emerald accent rail */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 bg-primary"
      />

      <div className="flex flex-col gap-3 pl-1.5">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
              <Sparkles size={13} className="text-primary" />
              AI Daily Intelligence
            </span>
            {data?.generatedAt && (
              <span className="text-[11px] font-medium text-muted-foreground">
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
                className="press inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted cursor-pointer disabled:opacity-50"
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
            className="hidden sm:grid size-8 shrink-0 place-items-center rounded-lg bg-ink text-ink-foreground shadow-xs"
          >
            <Bot size={18} />
          </div>
          <div className="flex-1 text-sm sm:text-base">
            <p className="font-semibold leading-snug text-foreground">
              {data?.summary}
            </p>

            {data?.recommendation && (
              <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">
                <strong className="font-semibold text-foreground">
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
