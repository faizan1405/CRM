import Link from "next/link";
import {
  Banknote,
  Coins,
  ClockAlert,
  Percent,
  ReceiptIndianRupee,
  Users,
  HandCoins,
  CheckCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AnalyticsKpiData } from "../types";
import { compactNumber, currency } from "./shared";
import { compactCurrency } from "@/features/dashboard/compact-currency";

type CardDef = {
  key: keyof AnalyticsKpiData;
  label: string;
  icon: LucideIcon;
  tone: string;
  format: (v: number) => string;
  note: string;
  href: string;
  isCurrency?: boolean;
};

const cards: CardDef[] = [
  {
    key: "totalLeads",
    label: "Total Leads",
    icon: Users,
    tone: "bg-blue-50 text-blue-700 border-blue-200/80",
    format: (v: number) => (v || 0).toLocaleString("en-IN"),
    note: "in selected period",
    href: "/leads",
  },
  {
    key: "winRate",
    label: "Win Rate",
    icon: Percent,
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    format: (v: number) => `${((v || 0) * 100).toFixed(1)}%`,
    note: "of closed deals",
    href: "/analytics#win-loss",
  },
  {
    key: "wonRevenue",
    label: "Won Deal Value",
    icon: Coins,
    tone: "bg-green-50 text-green-700 border-green-200/80",
    format: (v: number) => currency.format(v || 0),
    note: "closed-won contract value",
    href: "/deals",
    isCurrency: true,
  },
  {
    key: "openPipelineValue",
    label: "Open Pipeline Value",
    icon: Banknote,
    tone: "bg-purple-50 text-purple-700 border-purple-200/80",
    format: (v: number) => currency.format(v || 0),
    note: "active opportunity value",
    href: "/pipeline",
    isCurrency: true,
  },
  {
    key: "moneyReceived",
    label: "Money Received",
    icon: HandCoins,
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    format: (v: number) => currency.format(v || 0),
    note: "actual cash collected",
    href: "/deals",
    isCurrency: true,
  },
  {
    key: "totalOutstanding",
    label: "Outstanding",
    icon: ReceiptIndianRupee,
    tone: "bg-amber-50 text-amber-700 border-amber-200/80",
    format: (v: number) => currency.format(v || 0),
    note: "pending collection",
    href: "/deals?filter=unpaid",
    isCurrency: true,
  },
  {
    key: "collectionRate",
    label: "Collection Rate",
    icon: CheckCircle2,
    tone: "bg-cyan-50 text-cyan-700 border-cyan-200/80",
    format: (v: number) => `${(v || 0).toFixed(2)}%`,
    note: "collected vs contracted",
    href: "/deals",
  },
  {
    key: "overdueFollowUps",
    label: "Overdue Follow-ups",
    icon: ClockAlert,
    tone: "bg-rose-50 text-rose-700 border-rose-200/80",
    format: (v: number) => (v || 0).toLocaleString("en-IN"),
    note: "need attention",
    href: "/follow-ups?filter=overdue",
  },
];

export function AnalyticsKpis({ data }: { data: AnalyticsKpiData }) {
  return (
    <section aria-label="Key performance indicators" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(({ key, label, icon: Icon, tone, format, note, href, isCurrency }) => {
        const rawVal = Number(data[key]) || 0;
        const formatted = format(rawVal);
        const displayVal = isCurrency ? compactCurrency(rawVal) : formatted;

        return (
          <Link
            href={href}
            aria-label={`View ${label}`}
            key={key}
            className="group press min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5 card-surface card-hover transition-all cursor-pointer"
          >
            <div className={`mb-3 grid size-8 place-items-center rounded-lg border ${tone}`}>
              <Icon aria-hidden="true" size={15} strokeWidth={2} />
            </div>
            <p className="eyebrow truncate">{label}</p>
            <p
              className="mt-2 text-[20px] font-semibold tabular text-foreground sm:text-[24px] truncate"
              title={formatted}
              aria-label={formatted}
            >
              {displayVal}
            </p>
            <p className="mt-1 text-xs text-muted-foreground truncate">{rawVal === 0 ? "No data yet" : note}</p>
            {isCurrency && rawVal > 0 ? (
              <p className="sr-only">Compact value: {compactNumber.format(rawVal)}</p>
            ) : null}
          </Link>
        );
      })}
    </section>
  );
}
