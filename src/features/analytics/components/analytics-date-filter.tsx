import Link from "next/link";
import type { AnalyticsDateRange } from "../types";

const ranges: { value: AnalyticsDateRange; label: string }[] = [
  { value: "7d", label: "7 Days" }, { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" }, { value: "all", label: "All Time" },
];

export function AnalyticsDateFilter({ selected }: { selected: AnalyticsDateRange }) {
  return (
    <nav aria-label="Analytics date range" className="flex items-center gap-1 rounded-[10px] bg-muted p-1 w-full sm:w-auto">
      {ranges.map((range) => {
        const active = selected === range.value;
        return (
          <Link
            key={range.value}
            href={`/analytics?range=${range.value}`}
            aria-current={active ? "page" : undefined}
            className={`press flex-1 sm:flex-none inline-flex h-8 items-center justify-center rounded-lg px-3 text-[13px] font-medium transition-all duration-200 ${
              active
                ? "bg-card text-foreground shadow-[var(--shadow-card)] font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {range.label}
          </Link>
        );
      })}
    </nav>
  );
}
