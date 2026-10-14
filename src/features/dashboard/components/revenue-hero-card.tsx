"use client";

import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ChartFrame, chartTooltip } from "@/components/crm/primitives";
import { inr, inrCompact } from "@/lib/crm/format";

export type RevenueHeroCardProps = {
  wonRevenue: number;
  openPipeline: number;
  avgWonDeal: number;
  monthName: string;
  revenueTrend?: Array<{
    month: string;
    revenue: number;
  }>;
};

export function RevenueHeroCard({
  wonRevenue,
  openPipeline,
  avgWonDeal,
  monthName,
  revenueTrend = [],
}: RevenueHeroCardProps) {
  const totalVolume = wonRevenue + openPipeline;
  const convertedRatio = totalVolume > 0 ? Math.min(100, Math.round((wonRevenue / totalVolume) * 100)) : 0;
  const hasTrendData = revenueTrend.some((d) => d.revenue > 0) || wonRevenue > 0;

  return (
    <div className="card-surface rise flex flex-col justify-between overflow-hidden rounded-[var(--radius-xl)] border border-border/60 bg-card p-5 sm:p-6 shadow-[var(--shadow-card)]">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-4 pb-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="eyebrow">Revenue · {monthName}</span>
              <Link
                href="/analytics"
                className="text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Analytics &rarr;
              </Link>
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[32px] font-semibold leading-none tracking-[-0.035em] tabular text-foreground sm:text-[40px]">
                {inr(wonRevenue)}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-md bg-success-soft px-1.5 py-0.5 text-[11.5px] font-medium text-success tabular">
                Won Revenue
              </span>
            </div>
          </div>

          <div className="w-full sm:w-56">
            <div className="flex justify-between text-[12px]">
              <span className="text-muted-foreground">Open Pipeline</span>
              <span className="font-semibold tabular text-foreground">{inrCompact(openPipeline)}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="grow-x h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${convertedRatio}%` }}
                title={`${convertedRatio}% converted vs total pipeline`}
              />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-subtle">
              <span>{convertedRatio}% of total</span>
              <span>Avg deal {inrCompact(avgWonDeal)}</span>
            </div>
          </div>
        </div>

        {hasTrendData && revenueTrend.length > 0 ? (
          <ChartFrame className="mt-4 h-44 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ left: 0, right: 0, top: 12, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="var(--subtle)"
                  padding={{ left: 20, right: 20 }}
                />
                <Tooltip
                  formatter={(value: unknown) => [inr(Number(value) || 0), "Won Revenue"]}
                  {...chartTooltip}
                  cursor={{ stroke: "var(--border)" }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--chart-1)"
                  fill="url(#rev)"
                  strokeWidth={2}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                  animationDuration={600}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartFrame>
        ) : (
          <div className="mt-6 flex h-36 flex-col items-center justify-center rounded-xl border border-dashed border-border/70 p-4 text-center">
            <p className="text-[13px] font-medium text-foreground">No historical won revenue recorded</p>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              As deals are marked Won, your monthly revenue trend will appear here automatically.
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-[12px] text-muted-foreground">
        <span>Total Pipeline: <strong className="font-semibold text-foreground">{inr(totalVolume)}</strong></span>
        <Link href="/analytics" className="font-medium text-primary hover:underline">
          View full financial analytics &rarr;
        </Link>
      </div>
    </div>
  );
}
