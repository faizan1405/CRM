"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { LeadTrendPoint } from "@/features/analytics/types";

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
};

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg"
    >
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-blue-700">
        {payload[0].value} new lead{payload[0].value !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

type Props = { data: LeadTrendPoint[] };

export function LeadTrend({ data }: Props) {
  const isEmpty = data.length === 0;
  const total = data.reduce((sum, p) => sum + p.count, 0);

  return (
    <section
      aria-label="New leads over time"
      className="rounded-2xl border bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">Lead Trend</h2>
          <p className="mt-0.5 text-xs text-slate-500">New leads over time</p>
        </div>
        {!isEmpty && (
          <span
            className="rounded-lg bg-blue-50 px-2.5 py-1 text-sm font-semibold text-blue-700"
            aria-label={`Total new leads: ${total}`}
          >
            {total} total
          </span>
        )}
      </div>

      {isEmpty ? (
        <div className="mt-6 flex h-36 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-400">No leads in this period</p>
        </div>
      ) : (
        <>
          <div
            className="mt-4 h-48 sm:h-56"
            aria-label={`Lead trend chart. ${data.map((p) => `${p.label}: ${p.count} leads`).join(", ")}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
                <Bar
                  dataKey="count"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <p className="sr-only">
            Lead trend data:{" "}
            {data.map((p) => `${p.label} ${p.count} leads`).join(", ")}
          </p>
        </>
      )}
    </section>
  );
}
