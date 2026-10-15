"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { WinLossData } from "../types";
import { AnalyticsCard } from "./shared";

export function WinLossCard({ data }: { data: WinLossData }) {
  const total = data.won + data.lost;
  const chartData = [
    { name: "Won", value: data.won, color: "#10b981" },
    { name: "Lost", value: data.lost, color: "#f43f5e" }
  ];
  return (
    <AnalyticsCard title="Win vs lost" description="Outcome mix for closed opportunities.">
      {total === 0 ? (
        <div className="grid min-h-56 place-items-center rounded-xl bg-slate-50 text-center">
          <div>
            <p className="font-medium text-slate-700">No closed deals yet</p>
            <p className="mt-1 text-sm text-slate-500">Win rate will appear after an outcome is recorded.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-3">
          <div className="space-y-3">
            <div>
              <p className="text-3xl font-extrabold tracking-tight text-slate-900 leading-none">
                {data.winRate.toFixed(1)}%
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mt-1">
                Win rate
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-0.5">
              <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-2.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  Won
                </span>
                <span className="mt-0.5 block text-lg font-bold text-emerald-950 leading-tight">{data.won}</span>
              </div>
              <div className="rounded-xl border border-rose-200/70 bg-rose-50/50 p-2.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-800">
                  <span className="size-2 rounded-full bg-rose-500" />
                  Lost
                </span>
                <span className="mt-0.5 block text-lg font-bold text-rose-950 leading-tight">{data.lost}</span>
              </div>
            </div>
          </div>
          <div className="h-32" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={38}
                  outerRadius={56}
                  paddingAngle={4}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [Number(value).toLocaleString("en-IN"), "Deals"]}
                  contentStyle={{
                    borderRadius: "12px",
                    borderColor: "#e2e8f0",
                    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.08)",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="sr-only">
            {data.won} deals won and {data.lost} deals lost. Win rate {data.winRate.toFixed(1)} percent.
          </p>
        </div>
      )}
    </AnalyticsCard>
  );
}
