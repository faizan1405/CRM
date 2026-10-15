"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RevenueTrendPoint } from "../types";
import { AnalyticsCard, ChartEmpty, compactNumber, currency } from "./shared";

export function RevenueTrend({ data }: { data: RevenueTrendPoint[] }) {
  const total = data.reduce((sum, point) => sum + point.revenue, 0);
  const peak = data.reduce<RevenueTrendPoint | null>((best, point) => !best || point.revenue > best.revenue ? point : best, null);
  return <AnalyticsCard title="Won Deal Value Trend" description="Finalized contract value recognized from closed-won deals." action={<span className="hidden rounded-lg bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 sm:block">{compactNumber.format(total)} total</span>} className="xl:col-span-2">
    {data.length === 0 || data.every((point) => point.revenue === 0) ? <ChartEmpty label="won deal value" /> : <>
      <div className="h-64 w-full" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
        <defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16a34a" stopOpacity={0.22} /><stop offset="100%" stopColor="#16a34a" stopOpacity={0.01} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} minTickGap={24} /><YAxis tickFormatter={(value) => compactNumber.format(value)} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} width={48} />
        <Tooltip formatter={(value) => [currency.format(Number(value)), "Won Deal Value"]} labelFormatter={(label) => `Period: ${label}`} contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,.1)" }} />
        <Area type="monotone" dataKey="revenue" stroke="#15803d" strokeWidth={2.5} fill="url(#revenueFill)" activeDot={{ r: 5 }} isAnimationActive={false} />
      </AreaChart></ResponsiveContainer></div>
      <p className="sr-only">Won deal value totals {currency.format(total)} across {data.length} periods. {peak ? `Highest period was ${peak.label} at ${currency.format(peak.revenue)}.` : ""}</p>
      {data.some((point) => point.isEstimated) ? <p className="mt-2 text-xs text-slate-500">Dotted or estimated periods may use fallback close dates.</p> : null}
    </>}
  </AnalyticsCard>;
}
