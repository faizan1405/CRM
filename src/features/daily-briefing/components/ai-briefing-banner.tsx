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
      aria-label="AI Daily Intelligence"
      className={`relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-border/80 bg-white dark:bg-card p-4 sm:p-5 shadow-xs transition-all ${className}`}
    >
      {/* Subtle emerald left accent rail */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 bg-emerald-500 rounded-l"
      />

      <div className="flex flex-col gap-3.5 pl-1.5 sm:pl-2">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border dark:border-emerald-800/40">
              <Sparkles size={13} className="text-emerald-500 shrink-0" />
              <span>AI Daily Intelligence</span>
            </span>
            {data?.generatedAt && (
              <span className="text-[11px] font-medium text-muted-foreground">
                Generated {new Date(data.generatedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}
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
                title="Regenerate intelligence summary"
                className="press inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-border/80 bg-white dark:bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-slate-50 dark:hover:bg-muted cursor-pointer disabled:opacity-50 transition-colors shadow-2xs"
              >
                <RefreshCw
                  size={12}
                  className={isLoading ? "animate-spin text-emerald-500" : "text-muted-foreground"}
                />
                <span className="hidden xs:inline">
                  {isLoading ? "Analyzing..." : "Refresh"}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Narrative summary text with Bot avatar */}
        <div className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className="hidden sm:grid size-8 shrink-0 place-items-center rounded-xl bg-slate-900 text-white shadow-xs"
          >
            <Bot size={17} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm sm:text-[15px] font-semibold leading-snug text-foreground">
              {data?.summary}
            </p>

            {data?.recommendation && (
              <div className="mt-2.5 rounded-lg bg-slate-50 dark:bg-muted/40 border border-slate-100 dark:border-border/60 px-3 py-2 text-xs sm:text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  Recommended action:
                </span>{" "}
                <span>{data.recommendation}</span>
              </div>
            )}
          </div>
        </div>

        {/* Expandable Key Points */}
        {data?.keyPoints && data.keyPoints.length > 0 && (
          <div className="border-t border-slate-100 dark:border-border/60 pt-2.5">
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              aria-expanded={isExpanded}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded cursor-pointer transition-colors"
            >
              <span>{isExpanded ? "Hide key signals" : "Why these 3 leads?"}</span>
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {isExpanded && (
              <ul className="mt-2.5 space-y-1.5 pl-1 text-xs text-muted-foreground">
                {data.keyPoints.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-1.5 block size-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span className="leading-relaxed">{point}</span>
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
