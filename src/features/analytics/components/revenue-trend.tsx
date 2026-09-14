"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TrendPoint } from "@/features/analytics/types";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(val);

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: TrendPoint }>;
  label?: string;
};

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg"
    >
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-emerald-700">
        {formatCurrency(point.revenue)}
      </p>
      {point.leadCount > 0 && (
        <p className="text-[11px] text-slate-400">
          {point.leadCount} deal{point.leadCount !== 1 ? "s" : ""}
          {point.isEstimated ? " · estimated timestamp" : ""}
        </p>
      )}
    </div>
  );
}

type Props = { data: TrendPoint[] };

export function RevenueTrend({ data }: Props) {
  const isEmpty = data.length === 0 || data.every((p) => p.revenue === 0);
  const total = data.reduce((sum, p) => sum + p.revenue, 0);
  const hasEstimated = data.some((p) => p.isEstimated);

  return (
    <section
      aria-label="Won revenue over time"
      className="rounded-2xl border bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">Revenue Trend</h2>
          <p className="mt-0.5 text-xs text-slate-500">Won revenue over time</p>
        </div>
        {!isEmpty && (
          <span
            className="rounded-lg bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-700"
            aria-label={`Total won revenue: ${formatCurrency(total)}`}
          >
            {formatCurrency(total)}
          </span>
        )}
      </div>

      {hasEstimated && !isEmpty && (
        <p className="mt-2 text-[11px] text-slate-400 italic">
          * Some revenue timestamps are estimated (based on lead updated date)
        </p>
      )}

      {isEmpty ? (
        <div className="mt-6 flex h-36 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-400">No won revenue in this period</p>
        </div>
      ) : (
        <>
          <div
            className="mt-4 h-48 sm:h-56"
            aria-label={`Revenue trend chart. ${data.map((p) => `${p.label}: ${formatCurrency(p.revenue)}`).join(", ")}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                  tickFormatter={(v: number) => formatCurrency(v)}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#revenueGrad)"
                  dot={false}
                  activeDot={{ r: 5, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <p className="sr-only">
            Revenue data points:{" "}
            {data.map((p) => `${p.label} ${formatCurrency(p.revenue)}`).join(", ")}
          </p>
        </>
      )}
    </section>
  );
}
