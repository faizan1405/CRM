import Link from "next/link";
import { compactCurrency } from "../compact-currency";
import {
  CalendarClock,
  Coins,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, Delta } from "@/components/crm/primitives";
import { inrCompact } from "@/lib/crm/format";

export type KPICardData = {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  wonClients: number;
  followUpsToday: number;
  wonRevenue: number;
  pinnedLeads?: number;
  staleLeads?: number;
  activeLeads?: number;
  winRate?: number;
  lostLeads?: number;
  collectedRevenue?: number;
  outstandingRevenue?: number;
  overdueDealsCount?: number;
};

type SecondaryKPICardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  supportText?: string;
  href?: string;
  fullValue?: string;
};

function SecondaryKPICard({
  label,
  value,
  icon: Icon,
  supportText,
  href,
  fullValue,
}: SecondaryKPICardProps) {
  const content = (
    <div className="card-surface card-hover flex h-full flex-col justify-between p-3.5 sm:p-4 transition-all duration-200">
      <div className="flex items-center justify-between gap-2">
        <span title={label} className="eyebrow truncate">
          {label}
        </span>
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-3 w-3" strokeWidth={2} />
        </span>
      </div>
      <div className="mt-2">
        <div
          title={fullValue}
          aria-label={fullValue}
          className="text-[17px] font-semibold tracking-tight text-foreground sm:text-[20px] tabular"
        >
          {value}
        </div>
        {supportText && (
          <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">
            {supportText}
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block h-full group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
      >
        {content}
      </Link>
    );
  }

  return content;
}

export function KPICards({ data }: { data: KPICardData }) {
  const formattedRevenue = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(data.wonRevenue);

  const activeLeadsCount =
    data.activeLeads ??
    Math.max(
      0,
      data.totalLeads - data.wonClients - (data.lostLeads ?? 0)
    );

  const winRateVal =
    data.winRate ??
    (data.wonClients + (data.lostLeads ?? 0) > 0
      ? Math.round((data.wonClients / (data.wonClients + (data.lostLeads ?? 0))) * 100)
      : 0);

  const collectedVal = data.collectedRevenue ?? 0;
  const outstandingVal = data.outstandingRevenue ?? 0;
  const overdueDealsCount = data.overdueDealsCount ?? 0;

  // Lovable Connected 4-Panel Metric Strip
  const primaryMetrics = [
    {
      label: "Active leads",
      value: String(activeLeadsCount),
      hint: `${data.newLeads} new`,
      href: "/leads",
    },
    {
      label: "Win rate",
      value: `${winRateVal}%`,
      hint: `${data.wonClients} won · ${data.lostLeads ?? 0} lost`,
      href: "/leads?status=WON",
    },
    {
      label: "Collected",
      value: inrCompact(collectedVal),
      hint: "across confirmed deals",
      href: "/deals",
    },
    {
      label: "Outstanding",
      value: inrCompact(outstandingVal),
      delta: overdueDealsCount > 0 ? `${overdueDealsCount} overdue` : undefined,
      positive: false,
      href: overdueDealsCount > 0 ? "/deals" : "/deals",
    },
  ];

  // Original 6 KPIs preserved with full navigation and fidelity
  const originalStats = [
    { label: "Total Leads", value: data.totalLeads, icon: Users, href: "/leads" },
    { label: "New Leads", value: data.newLeads, icon: Sparkles, href: "/leads?status=NEW" },
    { label: "Qualified", value: data.qualifiedLeads, icon: ShieldCheck, href: "/leads?status=QUALIFIED" },
    { label: "Won Clients", value: data.wonClients, icon: Trophy, href: "/leads?status=WON" },
    {
      label: "Follow-ups",
      supportText: "Today",
      value: data.followUpsToday,
      icon: CalendarClock,
      href: "/follow-ups?filter=today",
    },
    {
      label: "Won Revenue",
      value: compactCurrency(data.wonRevenue),
      fullValue: formattedRevenue,
      icon: Coins,
      href: "/analytics",
    },
  ];

  return (
    <div className="space-y-4">
      {/* 1. Lovable Connected 4-Panel Strip */}
      <Card className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-xl)] border border-border/60 shadow-[var(--shadow-card)] lg:grid-cols-4">
        {primaryMetrics.map((m, i) => {
          const cell = (
            <div
              className={cn(
                "min-w-0 p-4 sm:p-5 transition-colors hover:bg-muted/40",
                i % 2 === 1 && "border-l border-border/60",
                i >= 2 && "border-t border-border/60 lg:border-t-0",
                i === 2 && "lg:border-l border-border/60"
              )}
            >
              <div className="eyebrow truncate">{m.label}</div>
              <div className="mt-2 truncate text-[22px] font-semibold tabular text-foreground sm:text-[26px]">
                {m.value}
              </div>
              <div className="mt-1.5 flex min-h-5 flex-wrap items-center gap-1.5">
                {m.delta && <Delta value={m.delta} positive={m.positive ?? true} />}
                {m.hint && (
                  <span className="truncate text-xs text-muted-foreground">{m.hint}</span>
                )}
              </div>
            </div>
          );

          return m.href ? (
            <Link key={m.label} href={m.href} className="block group">
              {cell}
            </Link>
          ) : (
            <div key={m.label}>{cell}</div>
          );
        })}
      </Card>

      {/* 2. Secondary Row preserving original 6 KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {originalStats.map((stat) => (
          <SecondaryKPICard key={stat.label} {...stat} />
        ))}
      </div>
    </div>
  );
}
