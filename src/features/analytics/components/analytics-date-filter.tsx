"use client";

import type { DateRange } from "@/features/analytics/types";
import { BarChart2 } from "lucide-react";

type Props = {
  value: DateRange;
  onChange: (range: DateRange) => void;
};

const RANGES: { label: string; value: DateRange }[] = [
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "90 Days", value: "90d" },
  { label: "All Time", value: "all" },
];

export function AnalyticsDateFilter({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Select date range"
      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
    >
      {RANGES.map((r) => {
        const isActive = r.value === value;
        return (
          <button
            key={r.value}
            type="button"
            onClick={() => onChange(r.value)}
            aria-pressed={isActive}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
              isActive
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

type HeaderProps = {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
};

export function AnalyticsPageHeader({ dateRange, onDateRangeChange }: HeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
          <BarChart2 aria-hidden="true" size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Sales Analytics
          </h1>
          <p className="text-sm text-slate-500">
            Performance diagnosis &amp; insights
          </p>
        </div>
      </div>
      <AnalyticsDateFilter value={dateRange} onChange={onDateRangeChange} />
    </div>
  );
}
