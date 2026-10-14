"use client";

import { motion } from "motion/react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { IndianRupee, Wallet, Trophy, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { inr, inrCompact } from "@/lib/crm/format";
import type { CoreMetrics, TrendPoint, LeadTrendPoint } from "../types";
import {
  AnalyticsCard,
  ClientOnlyChart,
  CountUp,
  EASE,
  InfoTip,
  type MetricInfo,
} from "./kit";
import { cn } from "@/lib/utils";

const fmtInt = (n: number) => Math.round(n).toLocaleString("en-IN");
const fmtPct = (d = 1) => (n: number) => `${n.toFixed(d)}%`;
const fmtInr = (n: number) => inr(Math.round(n));

function Spark({ data, id }: { data: { v: number }[]; id: string }) {
  if (!data || data.length === 0) return null;
  return (
    <ClientOnlyChart className="h-11 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                style={{ stopColor: "var(--primary)", stopOpacity: 0.22 }}
              />
              <stop
                offset="100%"
                style={{ stopColor: "var(--primary)", stopOpacity: 0 }}
              />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke="var(--primary)"
            strokeWidth={1.6}
            fill={`url(#${id})`}
            dot={false}
            isAnimationActive
            animationDuration={1100}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ClientOnlyChart>
  );
}

function Ring({ value }: { value: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const val = Math.min(1, Math.max(0, value));

  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90" aria-hidden>
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="var(--muted)"
        strokeWidth="5"
      />
      <motion.circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - val) }}
        transition={{ duration: 1, ease: EASE }}
      />
    </svg>
  );
}

type Primary = {
  key: string;
  label: string;
  icon: LucideIcon;
  value: number;
  format: (n: number) => string;
  sub: string;
  info: MetricInfo;
  visual: React.ReactNode;
};

export function AnalyticsKpis({
  data,
  revenueTrend = [],
  leadTrend = [],
}: {
  data: CoreMetrics;
  revenueTrend?: TrendPoint[];
  leadTrend?: LeadTrendPoint[];
}) {
  const k = data;
  const scope = "Selected range";

  const primary: Primary[] = [
    {
      key: "won",
      label: "Won Deal Value",
      icon: IndianRupee,
      value: k.wonRevenue,
      format: fmtInr,
      sub: `${k.wonLeads} won deals · avg ${inrCompact(k.avgWonDeal)}`,
      info: {
        meaning:
          "Total quoted value of leads marked Won. This is contracted value, not cash received.",
        formula: "Σ quotedAmount of WON leads",
        scope,
        kind: "Period metric",
      },
      visual: (
        <Spark
          id="sp-won"
          data={revenueTrend.map((t) => ({ v: t.revenue }))}
        />
      ),
    },
    {
      key: "recv",
      label: "Money Received",
      icon: Wallet,
      value: k.moneyReceived ?? 0,
      format: fmtInr,
      sub: `${(k.collectionRate ?? 0).toFixed(1)}% collected · ${inrCompact(
        k.totalOutstanding ?? 0
      )} outstanding`,
      info: {
        meaning:
          "Actual payments recorded against deals. Differs from Won Deal Value.",
        formula: "Σ Payment.amount (active payments)",
        scope,
        kind: "Period metric",
      },
      visual: (
        <Spark
          id="sp-recv"
          data={revenueTrend.map((t) => ({ v: t.revenue * 0.7 }))}
        />
      ),
    },
    {
      key: "win",
      label: "Win Rate",
      icon: Trophy,
      value: k.winRate * 100,
      format: fmtPct(1),
      sub: `${k.wonLeads} won · ${k.lostLeads} lost`,
      info: {
        meaning:
          "Share of decided leads that were won. Open leads are excluded.",
        formula: "Won ÷ (Won + Lost)",
        scope,
        kind: "Period metric",
      },
      visual: <Ring value={k.winRate} />,
    },
    {
      key: "leads",
      label: "Total Leads",
      icon: Users,
      value: k.totalLeads,
      format: fmtInt,
      sub: `${k.newLeads} still new · ${k.qualifiedLeads} qualified`,
      info: {
        meaning: "Leads created within the selected range.",
        formula: "count(Lead) where createdAt in range",
        scope,
        kind: "Period metric",
      },
      visual: (
        <Spark
          id="sp-leads"
          data={leadTrend.map((t) => ({ v: t.count }))}
        />
      ),
    },
  ];

  const groups: {
    title: string;
    items: {
      label: string;
      value: number;
      format: (n: number) => string;
      info: MetricInfo;
      attention?: boolean;
    }[];
  }[] = [
    {
      title: "Sales",
      items: [
        {
          label: "New Leads",
          value: k.newLeads,
          format: fmtInt,
          info: {
            meaning: "Leads created in range that are still in New.",
            formula: "count(status = NEW)",
            scope,
            kind: "Period metric",
          },
        },
        {
          label: "Qualified Leads",
          value: k.qualifiedLeads,
          format: fmtInt,
          info: {
            meaning: "Leads created in range currently in Qualified.",
            formula: "count(status = QUALIFIED)",
            scope,
            kind: "Period metric",
          },
        },
        {
          label: "Won Deals",
          value: k.wonLeads,
          format: fmtInt,
          info: {
            meaning: "Leads created in range currently Won.",
            formula: "count(status = WON)",
            scope,
            kind: "Period metric",
          },
        },
        {
          label: "Lead-to-Sale",
          value: k.conversionRate ?? (k.totalLeads > 0 ? (k.wonLeads / k.totalLeads) * 100 : 0),
          format: fmtPct(1),
          info: {
            meaning: "Won leads out of total leads created in period.",
            formula: "Won ÷ total leads × 100",
            scope,
            kind: "Period metric",
          },
        },
      ],
    },
    {
      title: "Revenue",
      items: [
        {
          label: "Outstanding",
          value: k.totalOutstanding ?? 0,
          format: fmtInr,
          attention: true,
          info: {
            meaning:
              "Unpaid balance on active deals. Not the same as pipeline value.",
            formula: "Σ max(finalAmount − payments, 0)",
            scope,
            kind: "Period metric",
          },
        },
        {
          label: "Open Pipeline",
          value: k.openPipelineValue,
          format: fmtInr,
          info: {
            meaning:
              "Value of leads still in active stages. Current snapshot across all leads.",
            formula: "Σ deal or quoted amount, active stages",
            scope: "Current, all leads",
            kind: "Current snapshot",
          },
        },
        {
          label: "Avg Won Deal",
          value: k.avgWonDeal,
          format: fmtInr,
          info: {
            meaning: "Average quoted value per won lead.",
            formula: "Won value ÷ won leads with amount",
            scope,
            kind: "Period metric",
          },
        },
        {
          label: "Collection Rate",
          value: k.collectionRate ?? 0,
          format: fmtPct(1),
          info: {
            meaning: "Share of contracted value received as payments.",
            formula: "Received ÷ contracted × 100",
            scope,
            kind: "Period metric",
          },
        },
      ],
    },
    {
      title: "Execution",
      items: [
        {
          label: "Follow-ups Created",
          value: k.followUpsCreated,
          format: fmtInt,
          info: {
            meaning: "All follow-ups scheduled in range, any status.",
            formula: "count(FollowUp)",
            scope,
            kind: "Period metric",
          },
        },
        {
          label: "Completed",
          value: k.followUpsCompleted,
          format: fmtInt,
          info: {
            meaning: "Follow-ups marked completed.",
            formula: "count(status = COMPLETED)",
            scope,
            kind: "Period metric",
          },
        },
        {
          label: "Overdue",
          value: k.overdueFollowUps,
          format: fmtInt,
          attention: true,
          info: {
            meaning: "Pending follow-ups past their scheduled time.",
            formula: "PENDING and scheduledAt < now",
            scope: "Current",
            kind: "Current snapshot",
          },
        },
        {
          label: "Completion Rate",
          value:
            k.followUpsCreated > 0
              ? (k.followUpsCompleted /
                  Math.max(
                    k.followUpsCompleted + (k.followUpsCreated - k.followUpsCompleted),
                    1
                  )) *
                100
              : 0,
          format: fmtPct(1),
          info: {
            meaning:
              "Share of follow-ups executed without abandoning.",
            formula: "Completed ÷ (Completed + Pending + Overdue)",
            scope,
            kind: "Period metric",
          },
        },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {/* 4 Primary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {primary.map((p, i) => (
          <motion.div
            key={p.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE, delay: i * 0.06 }}
            className="min-w-0"
          >
            <AnalyticsCard as="div" className="group flex h-full flex-col p-3.5 sm:p-5">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-success-soft text-primary">
                  <p.icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 text-[12.5px] font-medium leading-tight text-muted-foreground truncate">
                  {p.label}
                </span>
                <span className="ml-auto">
                  <InfoTip info={p.info} label={p.label} />
                </span>
              </div>
              <div className="mt-3 flex items-end justify-between gap-2">
                <CountUp
                  value={p.value}
                  format={p.format}
                  className="truncate text-[21px] font-semibold tracking-tight text-foreground sm:text-[28px]"
                />
                {p.key === "win" && p.visual}
              </div>
              <p className="mt-1 line-clamp-2 text-[11.5px] text-muted-foreground sm:text-[12px]">
                {p.sub}
              </p>
              {p.key !== "win" && (
                <div className="mt-auto pt-2 opacity-80 transition-opacity group-hover:opacity-100">
                  {p.visual}
                </div>
              )}
            </AnalyticsCard>
          </motion.div>
        ))}
      </div>

      {/* 3-Column Secondary Grid */}
      <AnalyticsCard as="div" className="p-0 sm:p-0 overflow-hidden">
        <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
          {groups.map((g) => (
            <div key={g.title} className="min-w-0 p-4 sm:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                {g.title}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3.5">
                {g.items.map((it) => (
                  <div key={it.label} className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-[12px] text-muted-foreground">
                        {it.label}
                      </span>
                      <InfoTip info={it.info} label={it.label} />
                    </div>
                    <CountUp
                      value={it.value}
                      format={it.format}
                      className={cn(
                        "mt-0.5 block truncate text-[16px] font-semibold tracking-tight text-foreground",
                        it.attention && it.value > 0 && "text-warning"
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </AnalyticsCard>
    </div>
  );
}
