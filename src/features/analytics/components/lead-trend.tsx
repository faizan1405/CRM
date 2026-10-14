"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LeadTrendPoint, CoreMetrics } from "../types";
import { pct } from "../derive";
import {
  AnalyticsCard,
  CardHead,
  ClientOnlyChart,
  STAGE_COLOR,
  TipShell,
  axisProps,
} from "./kit";
import { cn } from "@/lib/utils";

function StatusDonut({ k }: { k: CoreMetrics }) {
  const rows = [
    { key: "NEW", label: "New", v: k.newLeads },
    { key: "CONTACTED", label: "Contacted", v: k.contactedLeads ?? 0 },
    { key: "QUALIFIED", label: "Qualified", v: k.qualifiedLeads },
    { key: "PROPOSAL_SENT", label: "Proposal Sent", v: k.proposalSent },
    { key: "WON", label: "Won", v: k.wonLeads },
    { key: "LOST", label: "Lost", v: k.lostLeads },
  ];
  const total = rows.reduce((a, r) => a + r.v, 0) || 1;
  const [act, setAct] = useState<number | null>(null);
  const cur = act === null ? null : rows[act]!;

  return (
    <AnalyticsCard>
      <CardHead
        title="Lead status"
        subtitle="Current status of leads created in range"
      />
      <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-1 xl:grid-cols-[170px_minmax(0,1fr)]">
        <ClientOnlyChart className="relative mx-auto h-[170px] w-[170px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="v"
                nameKey="label"
                innerRadius={56}
                outerRadius={80}
                paddingAngle={2}
                cornerRadius={4}
                stroke="none"
                onMouseEnter={(_, i) => setAct(i)}
                onMouseLeave={() => setAct(null)}
                onClick={(_, i) => setAct(act === i ? null : i)}
                animationDuration={900}
              >
                {rows.map((r, i) => (
                  <Cell
                    key={r.key}
                    fill={STAGE_COLOR[r.key] || "var(--muted)"}
                    fillOpacity={act === null || act === i ? 1 : 0.25}
                    style={{ transition: "fill-opacity .2s", outline: "none" }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={cur?.key ?? "all"}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.16 }}
              >
                <p className="tabular text-[22px] font-semibold leading-none text-foreground">
                  {cur ? cur.v : total}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {cur ? `${cur.label} · ${pct(cur.v / total, 1)}` : "total leads"}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </ClientOnlyChart>
        <ul className="grid grid-cols-2 gap-1 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-1">
          {rows.map((r, i) => (
            <li key={r.key}>
              <button
                type="button"
                onMouseEnter={() => setAct(i)}
                onMouseLeave={() => setAct(null)}
                onFocus={() => setAct(i)}
                onBlur={() => setAct(null)}
                onClick={() => setAct(act === i ? null : i)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1 text-[12.5px] transition-opacity hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
                  act !== null && act !== i && "opacity-45"
                )}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: STAGE_COLOR[r.key] || "var(--muted)" }}
                />
                <span className="truncate text-foreground">{r.label}</span>
                <span className="tabular ml-auto font-medium text-muted-foreground">
                  {r.v}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </AnalyticsCard>
  );
}

export function LeadTrend({
  data,
  kpis,
}: {
  data: LeadTrendPoint[];
  kpis?: CoreMetrics;
}) {
  const pts = data;
  const peak = pts.reduce(
    (a, b) => (b.count > a.count ? b : a),
    pts[0] || { count: 0, label: "None" }
  );
  const total = pts.reduce((sum, p) => sum + p.count, 0);
  const avg = total / (pts.length || 1);

  const mainCard = (
    <AnalyticsCard className={kpis ? "lg:col-span-2" : "xl:col-span-2"}>
      <CardHead
        title="Leads over time"
        subtitle={
          <>
            Peak{" "}
            <span className="font-medium text-foreground">{peak.count}</span> in{" "}
            {peak.label} · avg {avg.toFixed(1)} per period
          </>
        }
      />
      <ClientOnlyChart className="h-[230px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={pts}
            margin={{ top: 8, right: 6, bottom: 0, left: -20 }}
            accessibilityLayer
          >
            <defs>
              <linearGradient id="lead-fill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  style={{ stopColor: "var(--info)", stopOpacity: 0.2 }}
                />
                <stop
                  offset="100%"
                  style={{ stopColor: "var(--info)", stopOpacity: 0 }}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeOpacity={0.8}
            />
            <XAxis
              dataKey="label"
              {...axisProps}
              minTickGap={24}
              tickMargin={8}
            />
            <YAxis {...axisProps} width={40} allowDecimals={false} />
            <Tooltip
              cursor={{
                stroke: "var(--foreground)",
                strokeOpacity: 0.18,
                strokeDasharray: "3 3",
              }}
              content={({ active, payload }) => {
                const r = active
                  ? (payload?.[0]?.payload as (typeof pts)[number] | undefined)
                  : undefined;
                return r ? (
                  <TipShell
                    title={r.label}
                    rows={[
                      {
                        label: "New leads",
                        value: r.count,
                        color: "var(--info)",
                      },
                      {
                        label: "vs period avg",
                        value: `${r.count >= avg ? "+" : ""}${(
                          r.count - avg
                        ).toFixed(1)}`,
                      },
                    ]}
                  />
                ) : null;
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="var(--info)"
              strokeWidth={2}
              fill="url(#lead-fill)"
              dot={false}
              animationDuration={1100}
              activeDot={{
                r: 5,
                strokeWidth: 2.5,
                stroke: "var(--card)",
                fill: "var(--info)",
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ClientOnlyChart>
    </AnalyticsCard>
  );

  if (!kpis) return mainCard;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      {mainCard}
      <StatusDonut k={kpis} />
    </div>
  );
}
