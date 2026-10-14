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

function Ring({
  value,
  color = "var(--primary)",
}: {
  value: number;
  color?: string;
}) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const val = Math.min(1, Math.max(0, value));

  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90 shrink-0" aria-hidden>
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
        stroke={color}
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
  completionRate,
}: {
  data: CoreMetrics;
  revenueTrend?: TrendPoint[];
  leadTrend?: LeadTrendPoint[];
  completionRate?: number;
}) {
  const k = data;
  const scope = "Selected range";

  // Use canonical completion rate passed from followUpPerformance
  const canonicalCompletionRate =
    completionRate ?? (k.followUpsCompleted / Math.max(k.followUpsCreated, 1));

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
          "Total finalized contract value of WON deals (Deal.finalAmount). Quoted amount is not used for won deals.",
        formula: "Σ Deal.finalAmount of WON leads in range (₹0 if no deal)",
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
      )} all-time outstanding`,
      info: {
        meaning:
          "Actual cash payment transactions recorded in the CRM within the selected date range.",
        formula: "Σ Payment.amount where paymentDate in range (active payments)",
        scope,
        kind: "Period metric",
      },
      // Genuine non-temporal visual: animated collection rate progress ring (no fake time series)
      visual: (
        <Ring
          value={k.collectionRate ? Math.min(1, Math.max(0, k.collectionRate / 100)) : 0}
          color="var(--chart-2)"
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
          "Share of closed leads created in range that were won. Active/open leads are excluded.",
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
        meaning: "Leads created within the selected range (waste excluded).",
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
            meaning: "Leads created in range that are currently in New stage.",
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
            meaning: "Leads created in range currently in Qualified stage.",
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
            meaning: "Leads created in range that reached Won stage.",
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
            formula: "Won ÷ total leads in cohort × 100",
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
              "Current unpaid balance across all active deals in the CRM. Not restricted to date range.",
            formula: "Σ max(Deal.finalAmount − payments, 0) across all active deals",
            scope: "Current all-time snapshot",
            kind: "Current snapshot",
          },
        },
        {
          label: "Open Pipeline",
          value: k.openPipelineValue,
          format: fmtInr,
          info: {
            meaning:
              "Estimated value of opportunities currently in active sales stages (New, Contacted, Qualified, Proposal Sent).",
            formula: "Σ (Deal.finalAmount || Lead.quotedAmount) for active leads",
            scope: "Current all-time snapshot",
            kind: "Current snapshot",
          },
        },
        {
          label: "Avg Won Deal",
          value: k.avgWonDeal,
          format: fmtInr,
          info: {
            meaning: "Average finalized contract value per won deal with an amount in this period.",
            formula: "Won Deal Value ÷ count(Won deals with finalAmount > 0)",
            scope,
            kind: "Period metric",
          },
        },
        {
          label: "Collection Rate",
          value: k.collectionRate ?? 0,
          format: fmtPct(1),
          info: {
            meaning: "Share of contracted deal value received as payments.",
            formula: "Money Received ÷ Total Contracted Deal Value × 100",
            scope: "Collections vs active deals",
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
            meaning: "All follow-ups scheduled on currently active leads.",
            formula: "count(FollowUp) on active leads",
            scope: "Current active leads",
            kind: "Current snapshot",
          },
        },
        {
          label: "Completed",
          value: k.followUpsCompleted,
          format: fmtInt,
          info: {
            meaning: "Follow-ups marked completed on currently active leads.",
            formula: "count(status = COMPLETED) on active leads",
            scope: "Current active leads",
            kind: "Current snapshot",
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
            scope: "Current snapshot",
            kind: "Current snapshot",
          },
        },
        {
          label: "Completion Rate",
          value: canonicalCompletionRate * 100,
          format: fmtPct(1),
          info: {
            meaning:
              "Share of active follow-ups completed without abandoning. Cancelled follow-ups are excluded.",
            formula: "Completed ÷ (Completed + Pending), Cancelled excluded",
            scope: "Current active leads",
            kind: "Current snapshot",
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
                {(p.key === "win" || p.key === "recv") && p.visual}
              </div>
              <p className="mt-1 line-clamp-2 text-[11.5px] text-muted-foreground sm:text-[12px]">
                {p.sub}
              </p>
              {p.key !== "win" && p.key !== "recv" && (
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
