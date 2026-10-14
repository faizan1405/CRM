"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { WinLossData } from "../types";
import { AnalyticsCard, CardHead, ClientOnlyChart } from "./kit";

export function WinLossCard({ data }: { data: WinLossData }) {
  const total = data.won + data.lost;
  const chartData = [
    { name: "Won", value: data.won, color: "var(--primary)" },
    { name: "Lost", value: data.lost, color: "var(--destructive)" },
  ];

  return (
    <AnalyticsCard>
      <CardHead
        title="Win vs lost"
        subtitle="Outcome mix for closed opportunities"
      />
      {total === 0 ? (
        <div className="grid min-h-48 place-items-center rounded-xl bg-muted/40 text-center">
          <div>
            <p className="font-medium text-foreground">No closed deals yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Win rate will appear after an outcome is recorded.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-3">
          <div className="space-y-3">
            <div>
              <p className="text-3xl font-extrabold tracking-tight text-foreground leading-none">
                {data.winRate.toFixed(1)}%
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                Win rate
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-0.5">
              <div className="rounded-xl border border-success-soft bg-success-soft/30 p-2.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <span className="size-2 rounded-full bg-primary" />
                  Won
                </span>
                <span className="mt-0.5 block text-lg font-bold text-foreground leading-tight">
                  {data.won}
                </span>
              </div>
              <div className="rounded-xl border border-danger-soft bg-danger-soft/30 p-2.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                  <span className="size-2 rounded-full bg-destructive" />
                  Lost
                </span>
                <span className="mt-0.5 block text-lg font-bold text-foreground leading-tight">
                  {data.lost}
                </span>
              </div>
            </div>
          </div>
          <ClientOnlyChart className="h-32">
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
                  formatter={(value) => [
                    Number(value).toLocaleString("en-IN"),
                    "Deals",
                  ]}
                  contentStyle={{
                    borderRadius: "12px",
                    borderColor: "var(--border)",
                    backgroundColor: "var(--popover)",
                    color: "var(--popover-foreground)",
                    boxShadow: "var(--shadow-float)",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ClientOnlyChart>
        </div>
      )}
    </AnalyticsCard>
  );
}
