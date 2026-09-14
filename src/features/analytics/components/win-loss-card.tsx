"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { WinLossData } from "../types";
import { AnalyticsCard } from "./shared";

export function WinLossCard({ data }: { data: WinLossData }) {
  const total = data.won + data.lost;
  const chartData = [{ name: "Won", value: data.won, color: "#16a34a" }, { name: "Lost", value: data.lost, color: "#dc2626" }];
  return <AnalyticsCard title="Win vs lost" description="Outcome mix for closed opportunities.">
    {total === 0 ? <div className="grid min-h-56 place-items-center rounded-xl bg-slate-50 text-center"><div><p className="font-medium text-slate-700">No closed deals yet</p><p className="mt-1 text-sm text-slate-500">Win rate will appear after an outcome is recorded.</p></div></div> : <div className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3">
      <div className="space-y-4"><div><p className="text-3xl font-bold tracking-tight text-slate-950">{data.winRate.toFixed(1)}%</p><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Win rate</p></div>
        <dl className="grid grid-cols-2 gap-3"><div><dt className="flex items-center gap-1.5 text-xs text-slate-500"><span className="size-2 rounded-full bg-green-600" />Won</dt><dd className="mt-1 text-lg font-bold text-slate-900">{data.won}</dd></div><div><dt className="flex items-center gap-1.5 text-xs text-slate-500"><span className="size-2 rounded-full bg-red-600" />Lost</dt><dd className="mt-1 text-lg font-bold text-slate-900">{data.lost}</dd></div></dl>
      </div>
      <div className="h-32" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={57} paddingAngle={3} stroke="none" isAnimationActive={false}>{chartData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip formatter={(value) => [Number(value).toLocaleString("en-IN"), "Deals"]} /></PieChart></ResponsiveContainer></div>
      <p className="sr-only">{data.won} deals won and {data.lost} deals lost. Win rate {data.winRate.toFixed(1)} percent.</p>
    </div>}
  </AnalyticsCard>;
}
