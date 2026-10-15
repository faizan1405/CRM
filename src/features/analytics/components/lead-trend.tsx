"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LeadTrendPoint } from "../types";
import { AnalyticsCard, ChartEmpty } from "./shared";

export function LeadTrend({ data }: { data: LeadTrendPoint[] }) {
  const total = data.reduce((sum, point) => sum + point.count, 0);
  const peak = data.reduce<LeadTrendPoint | null>((best, point) => !best || point.count > best.count ? point : best, null);
  return <AnalyticsCard title="New lead trend" description="Lead volume entering the pipeline.">
    {data.length === 0 || total === 0 ? <ChartEmpty label="new leads" /> : <>
      <div className="h-64 w-full" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 4, left: -28, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} minTickGap={24} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} width={38} />
        <Tooltip formatter={(value) => [Number(value).toLocaleString("en-IN"), "New leads"]} contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,.1)" }} cursor={{ fill: "#eff6ff" }} />
        <Bar dataKey="count" fill="#2563eb" radius={[5, 5, 0, 0]} maxBarSize={34} isAnimationActive={false} />
      </BarChart></ResponsiveContainer></div>
      <p className="sr-only">{total} new leads across {data.length} periods. {peak ? `Highest period was ${peak.label} with ${peak.count} leads.` : ""}</p>
    </>}
  </AnalyticsCard>;
}
