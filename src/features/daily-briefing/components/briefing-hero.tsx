"use client";

import type { BriefingHeroProps } from "../types";
import { RotateCcw } from "lucide-react";

function formatBriefingDate(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      day: "numeric",
      month: "short",
    })
      .format(date)
      .toUpperCase();
  } catch {
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).toUpperCase();
  }
}

export function BriefingHero({
  stats,
  onResetActions,
  className = "",
}: BriefingHeroProps) {
  const currentDateFormatted = formatBriefingDate();

  return (
    <section
      aria-label="Daily Briefing Hero"
      className={`rise relative overflow-hidden rounded-[18px] sm:rounded-2xl bg-ink p-5 sm:p-8 text-ink-foreground shadow-lg border border-ink-line/40 ${className}`}
    >
      {/* Background dot-matrix texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(var(--ink-foreground)_1px,transparent_1px)] [background-size:18px_18px]"
      />

      <div className="relative">
        {/* Top row: Emerald Tag + Reset Action */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-400">
            DAILY BRIEFING &middot; {currentDateFormatted}
          </div>
          {onResetActions && (
            <button
              type="button"
              onClick={onResetActions}
              aria-label="Reset checklist"
              className="press inline-flex h-7 items-center gap-1.5 rounded-lg border border-ink-line bg-ink-muted/10 px-2.5 text-[11px] font-medium text-ink-muted hover:text-ink-foreground hover:bg-ink-muted/20 transition-colors cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Large Headline */}
        <h1 className="mt-3.5 max-w-2xl text-[22px] font-bold leading-[1.25] tracking-tight text-white sm:text-[30px]">
          {stats.hotLeadsCount} hot leads, {stats.followUpsTodayCount} follow-ups due,{" "}
          {stats.activeOpportunityValueFormatted} in pipeline.
        </h1>

        {/* Subtitle */}
        <p className="mt-2.5 max-w-xl text-[13.5px] leading-relaxed text-ink-muted">
          Start with the critical items below &mdash; they have the highest impact on closing deals today.
        </p>

        {/* 3 compact metrics separated by thin vertical dividers */}
        <dl className="mt-6 grid max-w-lg grid-cols-3 border-t border-ink-line pt-4">
          <div>
            <dt className="text-[11.5px] font-medium text-ink-muted">Follow-ups</dt>
            <dd className="mt-0.5 text-[22px] font-bold tabular text-white sm:text-[26px]">
              {stats.followUpsTodayCount}
            </dd>
          </div>
          <div className="border-l border-ink-line pl-4 sm:pl-6">
            <dt className="text-[11.5px] font-medium text-ink-muted">Overdue</dt>
            <dd
              className={`mt-0.5 text-[22px] font-bold tabular sm:text-[26px] ${
                stats.overdueFollowUpsCount > 0 ? "text-rose-400" : "text-white"
              }`}
            >
              {stats.overdueFollowUpsCount}
            </dd>
          </div>
          <div className="border-l border-ink-line pl-4 sm:pl-6">
            <dt className="text-[11.5px] font-medium text-ink-muted">Hot Leads</dt>
            <dd
              className={`mt-0.5 text-[22px] font-bold tabular sm:text-[26px] ${
                stats.hotLeadsCount > 0 ? "text-emerald-400" : "text-white"
              }`}
            >
              {stats.hotLeadsCount}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
