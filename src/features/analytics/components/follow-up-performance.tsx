"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { followUpTypeLabel } from "@/lib/crm/labels";
import type { FollowUpPerformanceData } from "../types";
import { pct } from "../derive";
import {
  AnalyticsCard,
  CardHead,
  ClientOnlyChart,
  EASE,
  TipShell,
  axisProps,
} from "./kit";
import { cn } from "@/lib/utils";

const SERIES = [
  { key: "completed", label: "Completed", color: "var(--primary)" },
  { key: "pendingNotOverdue", label: "Pending (on time)", color: "var(--chart-2)" },
  { key: "overdue", label: "Overdue", color: "var(--warning)" },
] as const;

type SKey = (typeof SERIES)[number]["key"];

export function FollowUpPerformance({
  data,
}: {
  data: FollowUpPerformanceData;
}) {
  const [hidden, setHidden] = useState<SKey[]>([]);

  // Canonical rule: Overdue follow-ups are a subset of pending follow-ups.
  // To avoid double-counting in stacked charts and share bars, categories must be mutually exclusive:
  // - Completed: completed
  // - Pending (on time): pending - overdue
  // - Overdue: overdue
  // Total evaluated = completed + pendingNotOverdue + overdue = completed + pending
  const pendingNotOverdue = Math.max(0, data.pending - data.overdue);
  const activeTotal = data.completed + data.pending;

  const chartData = data.byType.map((t) => {
    const pNotOverdue = Math.max(0, t.pending - t.overdue);
    const totalActive = t.completed + t.pending;
    return {
      ...t,
      name: (followUpTypeLabel as Record<string, string>)[t.type] || t.type,
      completed: t.completed,
      pendingNotOverdue: pNotOverdue,
      overdue: t.overdue,
      totalActive,
    };
  });

  const r = 52;
  const c = 2 * Math.PI * r;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      {/* Left: Follow-up Discipline */}
      <AnalyticsCard>
        <CardHead
          title="Follow-up discipline"
          info={{
            meaning:
              "Execution rate across active leads. Cancelled follow-ups are excluded because they were abandoned, not outstanding.",
            formula: "Completed ÷ (Completed + Pending)",
            scope: "Current active leads",
            kind: "Current snapshot",
          }}
        />
        <div className="flex items-center gap-5">
          <div className="relative h-[128px] w-[128px] shrink-0">
            <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
              <circle
                cx="64"
                cy="64"
                r={r}
                fill="none"
                stroke="var(--muted)"
                strokeWidth="11"
              />
              <motion.circle
                cx="64"
                cy="64"
                r={r}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="11"
                strokeLinecap="round"
                strokeDasharray={c}
                initial={{ strokeDashoffset: c }}
                animate={{
                  strokeDashoffset: c * (1 - (data.completionRate || 0)),
                }}
                transition={{ duration: 1, ease: EASE }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="tabular text-[22px] font-semibold leading-none text-foreground">
                  {pct(data.completionRate || 0, 1)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  completion
                </p>
              </div>
            </div>
          </div>

          <dl className="min-w-0 flex-1 space-y-2 text-[12.5px]">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Created</dt>
              <dd className="tabular font-semibold text-foreground">
                {data.created}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: "var(--primary)" }}
                />
                Completed
              </dt>
              <dd className="tabular font-semibold text-foreground">
                {data.completed}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: "var(--chart-2)" }}
                />
                Pending (on time)
              </dt>
              <dd className="tabular font-semibold text-foreground">
                {pendingNotOverdue}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: "var(--warning)" }}
                />
                Overdue
              </dt>
              <dd
                className={cn(
                  "tabular font-semibold text-foreground",
                  data.overdue > 0 && "text-warning"
                )}
              >
                {data.overdue}
              </dd>
            </div>
          </dl>
        </div>

        {/* Mutually Exclusive Share Bar */}
        <div
          className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label="Completed, pending on-time, and overdue share"
        >
          <motion.div
            title={`Completed: ${data.completed}`}
            className="h-full border-r border-card last:border-0"
            style={{ background: "var(--primary)" }}
            initial={{ width: 0 }}
            animate={{
              width: `${(data.completed / (activeTotal || 1)) * 100}%`,
            }}
            transition={{ duration: 0.8, ease: EASE }}
          />
          <motion.div
            title={`Pending (on time): ${pendingNotOverdue}`}
            className="h-full border-r border-card last:border-0"
            style={{ background: "var(--chart-2)" }}
            initial={{ width: 0 }}
            animate={{
              width: `${(pendingNotOverdue / (activeTotal || 1)) * 100}%`,
            }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.05 }}
          />
          <motion.div
            title={`Overdue: ${data.overdue}`}
            className="h-full border-r border-card last:border-0"
            style={{ background: "var(--warning)" }}
            initial={{ width: 0 }}
            animate={{
              width: `${(data.overdue / (activeTotal || 1)) * 100}%`,
            }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
          />
        </div>
      </AnalyticsCard>

      {/* Right: By Follow-up Type with Mutually Exclusive Stacked Bars */}
      <AnalyticsCard>
        <CardHead
          title="By follow-up type"
          subtitle="Mutually exclusive breakdown · tap legend to filter series"
          action={
            <div className="flex flex-wrap gap-1">
              {SERIES.map((s) => {
                const off = hidden.includes(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={!off}
                    onClick={() =>
                      setHidden(
                        off
                          ? hidden.filter((h) => h !== s.key)
                          : [...hidden, s.key]
                      )
                    }
                    className={cn(
                      "press flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[11.5px] font-medium transition-opacity cursor-pointer",
                      off ? "opacity-35 text-muted-foreground" : "text-foreground"
                    )}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: s.color }}
                    />
                    {s.label}
                  </button>
                );
              })}
            </div>
          }
        />
        <ClientOnlyChart className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
              barCategoryGap="28%"
              accessibilityLayer
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeOpacity={0.8}
              />
              <XAxis dataKey="name" {...axisProps} tickMargin={8} />
              <YAxis {...axisProps} width={40} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                content={({ active: isHovered, payload }) => {
                  const row = isHovered
                    ? (payload?.[0]?.payload as (typeof chartData)[number] | undefined)
                    : undefined;
                  if (!row) return null;
                  const den = row.totalActive || 1;
                  return (
                    <TipShell
                      title={row.name}
                      rows={[
                        {
                          label: "Completed",
                          value: `${row.completed} · ${pct(row.completed / den)}`,
                          color: "var(--primary)",
                        },
                        {
                          label: "Pending (on time)",
                          value: `${row.pendingNotOverdue} · ${pct(row.pendingNotOverdue / den)}`,
                          color: "var(--chart-2)",
                        },
                        {
                          label: "Overdue",
                          value: `${row.overdue} · ${pct(row.overdue / den)}`,
                          color: "var(--warning)",
                        },
                      ]}
                      foot={`${row.totalActive} active · ${pct(
                        row.completed / den,
                        1
                      )} completion`}
                    />
                  );
                }}
              />
              {SERIES.map(
                (s, i) =>
                  !hidden.includes(s.key) && (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      stackId="a"
                      fill={s.color}
                      maxBarSize={56}
                      animationDuration={800}
                      radius={
                        i === SERIES.length - 1 ||
                        SERIES.slice(i + 1).every((x) => hidden.includes(x.key))
                          ? [5, 5, 0, 0]
                          : [0, 0, 0, 0]
                      }
                    />
                  )
              )}
            </BarChart>
          </ResponsiveContainer>
        </ClientOnlyChart>
      </AnalyticsCard>
    </div>
  );
}
