"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { inr, inrCompact } from "@/lib/crm/format";
import type { RevenueTrendPoint, CoreMetrics } from "../types";
import {
  AnalyticsCard,
  CardHead,
  ClientOnlyChart,
  EASE,
  TipShell,
  axisProps,
} from "./kit";
import { cn } from "@/lib/utils";

type RevRow = RevenueTrendPoint;

function RevenueChart({
  data,
  height,
}: {
  data: RevenueTrendPoint[];
  height: string;
}) {
  return (
    <ClientOnlyChart className={height}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 6, bottom: 0, left: -8 }}
          accessibilityLayer
        >
          <defs>
            <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                style={{ stopColor: "var(--primary)", stopOpacity: 0.24 }}
              />
              <stop
                offset="100%"
                style={{ stopColor: "var(--primary)", stopOpacity: 0 }}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeOpacity={0.8}
          />
          <XAxis dataKey="label" {...axisProps} minTickGap={24} tickMargin={8} />
          <YAxis
            {...axisProps}
            width={52}
            tickFormatter={(v: number) => inrCompact(v)}
          />
          <Tooltip
            cursor={{
              stroke: "var(--foreground)",
              strokeOpacity: 0.18,
              strokeDasharray: "3 3",
            }}
            content={({ active, payload }) => {
              const row = active
                ? (payload?.[0]?.payload as RevRow | undefined)
                : undefined;
              if (!row) return null;
              return (
                <TipShell
                  title={row.label}
                  rows={[
                    {
                      label: "Won value",
                      value: inr(row.revenue),
                      color: "var(--primary)",
                    },
                    { label: "Deals won", value: row.leadCount },
                  ]}
                  foot={
                    row.isEstimated
                      ? "Estimated timestamp (legacy lead, no status history)"
                      : undefined
                  }
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="var(--primary)"
            strokeWidth={2}
            fill="url(#rev-fill)"
            animationDuration={1100}
            animationEasing="ease-out"
            dot={false}
            activeDot={{
              r: 5,
              strokeWidth: 2.5,
              stroke: "var(--card)",
              fill: "var(--primary)",
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ClientOnlyChart>
  );
}

function RevenueBreakdown({ k }: { k: CoreMetrics }) {
  const [hl, setHl] = useState<number | null>(null);
  const rows = [
    {
      label: "Won deal value",
      v: k.wonRevenue,
      note: "Finalized contract value of leads won in range (Period)",
      color: "var(--primary)",
    },
    {
      label: "Money received",
      v: k.moneyReceived ?? 0,
      note: "Cash collected in selected period (Period)",
      color: "var(--chart-2)",
    },
    {
      label: "Open pipeline",
      v: k.openPipelineValue,
      note: "Current snapshot of active stages (Current snapshot)",
      color: "var(--chart-4)",
    },
    {
      label: "Outstanding balance",
      v: k.totalOutstanding ?? 0,
      note: "Current unpaid balance across active deals (Current snapshot)",
      color: "var(--chart-5)",
    },
  ];
  const max = Math.max(...rows.map((r) => r.v), 1);

  return (
    <AnalyticsCard>
      <CardHead
        title="Revenue breakdown"
        subtitle="Distinct measures across period and current scopes. They don't add up."
      />
      <div className="space-y-3">
        {rows.map((r, i) => (
          <button
            key={r.label}
            type="button"
            onMouseEnter={() => setHl(i)}
            onMouseLeave={() => setHl(null)}
            onFocus={() => setHl(i)}
            onBlur={() => setHl(null)}
            onClick={() => setHl(hl === i ? null : i)}
            className={cn(
              "block w-full rounded-lg text-left transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
              hl !== null && hl !== i && "opacity-45"
            )}
          >
            <div className="flex items-baseline justify-between text-[12.5px]">
              <span className="font-medium text-foreground">{r.label}</span>
              <span className="tabular font-semibold text-foreground" title={inr(r.v)}>
                {inrCompact(r.v)}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full"
                style={{ background: r.color }}
                initial={{ width: 0 }}
                animate={{ width: `${(r.v / max) * 100}%` }}
                transition={{ duration: 0.8, ease: EASE, delay: i * 0.08 }}
              />
            </div>
            <p
              className={cn(
                "mt-1 text-[11px] text-muted-foreground transition-all",
                hl === i ? "opacity-100" : "opacity-70"
              )}
            >
              {hl === i ? `${inr(r.v)} · ${r.note}` : r.note}
            </p>
          </button>
        ))}
      </div>
    </AnalyticsCard>
  );
}

export function RevenueTrend({
  data,
  kpis,
}: {
  data: RevenueTrendPoint[];
  kpis?: CoreMetrics;
}) {
  const [open, setOpen] = useState(false);
  const total = data.reduce((sum, point) => sum + point.revenue, 0);
  const totalDeals = data.reduce((sum, point) => sum + point.leadCount, 0);
  const est = data.filter((p) => p.isEstimated).length;

  // All-time collection metrics for active deals (matching deal populations)
  const totalContracted = kpis?.totalContractedDealValue ?? 0;
  const totalCollected = kpis?.totalReceivedAllTime ?? 0;
  const outstanding = kpis?.totalOutstanding ?? Math.max(0, totalContracted - totalCollected);
  const hasContracted = totalContracted > 0;
  const collectionRate = kpis?.collectionRate ?? (hasContracted ? (totalCollected / totalContracted) * 100 : 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <AnalyticsCard className="lg:col-span-2">
        <CardHead
          title="Won deal value"
          subtitle={
            <>
              Total{" "}
              <span className="tabular font-medium text-foreground">
                {inr(kpis?.wonRevenue ?? total)}
              </span>{" "}
              from {kpis?.wonLeads ?? totalDeals} won deals
            </>
          }
          action={
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Expand chart"
              className="press grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          }
        />
        <RevenueChart data={data} height="h-[240px] sm:h-[280px]" />
        {est > 0 && (
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            {est} won deals use an estimated timestamp from legacy data.
          </p>
        )}
      </AnalyticsCard>

      <div className="grid grid-cols-1 gap-4">
        <AnalyticsCard>
          <CardHead
            title="Collection overview"
            subtitle="Overall collections across active deals"
          />
          <div className="flex items-baseline justify-between">
            <span className="tabular text-[26px] font-semibold tracking-tight text-foreground">
              {hasContracted ? `${collectionRate.toFixed(1)}%` : "—"}
            </span>
            <span className="text-[12px] text-muted-foreground">
              {hasContracted ? "overall collected" : "no active deals"}
            </span>
          </div>
          <div
            className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-warning-soft"
            role="img"
            aria-label={`${inr(totalCollected)} received of ${inr(totalContracted)}`}
          >
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${hasContracted ? Math.min(100, collectionRate) : 0}%` }}
              transition={{ duration: 0.9, ease: EASE }}
            />
          </div>
          <dl className="mt-3.5 space-y-1.5 text-[12.5px]">
            {[
              ["Total contracted", totalContracted, "bg-foreground/70"],
              ["Total collected", totalCollected, "bg-primary"],
              ["Outstanding balance", outstanding, "bg-warning"],
            ].map(([l, v, cls]) => (
              <div
                key={l as string}
                className="flex items-center justify-between"
              >
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <span className={cn("h-2 w-2 rounded-full", cls as string)} />
                  {l}
                </dt>
                <dd
                  className="tabular font-medium text-foreground"
                  title={inr(v as number)}
                >
                  {inr(v as number)}
                </dd>
              </div>
            ))}
          </dl>
        </AnalyticsCard>

        {kpis && <RevenueBreakdown k={kpis} />}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Won deal value</DialogTitle>
            <DialogDescription>Detailed view with per-period values.</DialogDescription>
          </DialogHeader>
          <RevenueChart data={data} height="h-[320px]" />
          <div className="max-h-56 overflow-auto rounded-lg border border-border">
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 text-right font-medium">Deals</th>
                  <th className="px-3 py-2 text-right font-medium">Won value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((r) => (
                  <tr key={r.label} className="hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-1.5 text-foreground">
                      {r.label}
                      {r.isEstimated && (
                        <span className="ml-1.5 text-[11px] text-subtle">est.</span>
                      )}
                    </td>
                    <td className="tabular px-3 py-1.5 text-right text-muted-foreground">
                      {r.leadCount}
                    </td>
                    <td className="tabular px-3 py-1.5 text-right font-medium text-foreground">
                      {inr(r.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
