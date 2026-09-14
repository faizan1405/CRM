import Link from "next/link";
import type { AnalyticsDateRange } from "../types";

const ranges: { value: AnalyticsDateRange; label: string }[] = [
  { value: "7d", label: "7 Days" }, { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" }, { value: "all", label: "All Time" },
];

export function AnalyticsDateFilter({ selected }: { selected: AnalyticsDateRange }) {
  return (
    <nav aria-label="Analytics date range" className="grid w-full min-w-0 grid-cols-4 rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:flex sm:w-auto">
      {ranges.map((range) => (
        <Link key={range.value} href={`/analytics?range=${range.value}`} aria-current={selected === range.value ? "page" : undefined}
          className={`flex min-h-10 min-w-0 items-center justify-center whitespace-nowrap rounded-lg px-1 text-xs font-semibold transition-colors sm:flex-none sm:px-3 sm:text-sm ${selected === range.value ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}>
          {range.label}
        </Link>
      ))}
    </nav>
  );
}
