"use client";

import React from "react";
import {
  TrendingDown,
  Sparkles,
  Award,
  DollarSign,
  PhoneOff,
  Clock,
  Users,
  ShieldAlert,
  UserX,
  RefreshCw,
  Hourglass,
  HelpCircle,
  BarChart3,
  Bot,
} from "lucide-react";
import type {
  PrismaLeadLossReason,
  LostReasonsAnalyticsProps,
} from "./types";
import { LOST_REASON_DETAILS } from "./types";

function getReasonIcon(reason: PrismaLeadLossReason) {
  const meta = LOST_REASON_DETAILS[reason];
  if (!meta) return <HelpCircle className="size-4 shrink-0 text-slate-500" aria-hidden="true" />;

  switch (meta.iconName) {
    case "DollarSign":
      return <DollarSign className="size-4 shrink-0 text-rose-600" aria-hidden="true" />;
    case "PhoneOff":
      return <PhoneOff className="size-4 shrink-0 text-amber-600" aria-hidden="true" />;
    case "Clock":
      return <Clock className="size-4 shrink-0 text-blue-600" aria-hidden="true" />;
    case "Users":
      return <Users className="size-4 shrink-0 text-purple-600" aria-hidden="true" />;
    case "ShieldAlert":
      return <ShieldAlert className="size-4 shrink-0 text-orange-600" aria-hidden="true" />;
    case "UserX":
      return <UserX className="size-4 shrink-0 text-red-600" aria-hidden="true" />;
    case "RefreshCw":
      return <RefreshCw className="size-4 shrink-0 text-indigo-600" aria-hidden="true" />;
    case "Hourglass":
      return <Hourglass className="size-4 shrink-0 text-cyan-600" aria-hidden="true" />;
    case "HelpCircle":
    default:
      return <HelpCircle className="size-4 shrink-0 text-slate-600" aria-hidden="true" />;
  }
}

export function LostReasonsAnalytics({
  data,
  period,
  className = "",
}: LostReasonsAnalyticsProps) {
  const totalLost = data?.totalLost ?? 0;
  const breakdown = data?.breakdown ?? [];
  const topReason = data?.topReason ?? null;
  const displayPeriod = period ?? data?.period ?? "All Time";
  const aiInsight = data?.aiInsight;

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all sm:p-6 ${className}`}
      aria-labelledby="lost-reasons-analytics-title"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded-lg bg-rose-50 text-rose-600">
              <BarChart3 className="size-4" aria-hidden="true" />
            </div>
            <h3
              id="lost-reasons-analytics-title"
              className="text-base font-bold tracking-tight text-slate-900 sm:text-lg"
            >
              Lost Reasons Analytics
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            Root-cause breakdown of unclosed opportunities
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
          <span className="size-1.5 rounded-full bg-rose-500" aria-hidden="true" />
          <span>{displayPeriod}</span>
        </div>
      </div>

      {totalLost === 0 ? (
        <div className="grid min-h-48 place-items-center rounded-xl bg-slate-50/70 p-6 text-center">
          <div>
            <TrendingDown className="mx-auto size-8 text-slate-300" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-slate-700">No lost lead records yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Once leads are marked as lost with reasons, breakdown analytics will populate here.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Total Lost Card */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 transition-all hover:bg-slate-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Lost Leads
                </span>
                <span className="grid size-7 place-items-center rounded-md bg-white text-slate-600 shadow-2xs">
                  <TrendingDown className="size-4" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                  {totalLost}
                </p>
                <span className="text-xs font-medium text-slate-500">leads lost</span>
              </div>
            </div>

            {/* Top Lost Reason Card */}
            <div className="rounded-xl border border-rose-200/80 bg-gradient-to-br from-rose-50/40 to-white p-4 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-800">
                  Top Lost Reason
                </span>
                <span className="grid size-7 place-items-center rounded-md bg-rose-100 text-rose-600 shadow-2xs">
                  <Award className="size-4" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                {topReason ? (
                  <>
                    <p className="text-xl font-black tracking-tight text-rose-950 sm:text-2xl">
                      {topReason.reason} — {topReason.percentage}%
                    </p>
                    <span className="text-xs font-semibold text-rose-700">
                      {topReason.count} leads
                    </span>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">None recorded</p>
                )}
              </div>
            </div>
          </div>

          {/* AI Insight Placeholder Section */}
          <div
            className="relative overflow-hidden rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-white p-4 shadow-2xs"
            role="region"
            aria-label="AI Loss Insight"
          >
            <div className="flex items-start gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white shadow-xs">
                <Sparkles className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950">
                    AI Insight Placeholder
                  </h4>
                  <span className="inline-flex items-center gap-1 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                    <Bot className="size-2.5" aria-hidden="true" />
                    Groq Ready
                  </span>
                </div>

                {aiInsight ? (
                  <p className="mt-1.5 text-sm font-semibold leading-relaxed text-indigo-950 sm:text-base">
                    &ldquo;{aiInsight}&rdquo;
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-indigo-900/70">
                    AI pattern analysis will automatically highlight high-impact loss trends once
                    connected to the Groq backend.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Breakdown by Reason List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Breakdown by Reason
            </h4>

            <div className="space-y-2.5" role="list">
              {breakdown.map((item) => {
                const meta = LOST_REASON_DETAILS[item.reason];
                const isTop = topReason?.reason === item.reason;

                return (
                  <div
                    key={item.reason}
                    role="listitem"
                    className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 transition-all hover:bg-slate-50/90"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="grid size-6 place-items-center rounded-md bg-white shadow-2xs">
                          {getReasonIcon(item.reason)}
                        </div>
                        <span className="font-semibold text-slate-900 truncate">
                          {item.reason} — {item.percentage}%
                        </span>
                        {meta && (
                          <span
                            className="hidden xs:inline rounded border border-slate-200 bg-white px-1 py-0.2 text-[9px] font-bold text-slate-500 uppercase"
                            aria-hidden="true"
                          >
                            {meta.shortCode}
                          </span>
                        )}
                        {isTop && (
                          <span className="rounded bg-rose-100 px-1.5 py-0.2 text-[10px] font-bold text-rose-700">
                            Top
                          </span>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="text-xs font-bold text-slate-700">
                          {item.count}{" "}
                          <span className="font-normal text-slate-400">
                            ({item.percentage}%)
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Accessible Progress Meter */}
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isTop
                            ? "bg-rose-600"
                            : "bg-slate-700"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }}
                        role="progressbar"
                        aria-valuenow={item.percentage}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${item.reason}: ${item.percentage}% of lost leads (${item.count} leads)`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
