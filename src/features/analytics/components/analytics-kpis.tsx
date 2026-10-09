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
    <section aria-label="Key performance indicators" className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-4">
      {cards.map(({ key, label, icon: Icon, tone, format, note, href, isCurrency }) => {
        const rawVal = Number(data[key]) || 0;
        const formatted = format(rawVal);
        const displayVal = isCurrency ? compactCurrency(rawVal) : formatted;

        return (
          <Link
            href={href}
            aria-label={`View ${label}`}
            key={key}
            className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 min-w-0 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-4.5 shadow-sm"
          >
            <div className={`mb-3.5 grid size-9 place-items-center rounded-xl border ${tone} shadow-2xs`}>
              <Icon aria-hidden="true" size={17} strokeWidth={2} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
            <p
              className="mt-1 break-all text-[clamp(1.1rem,1.5vw,1.5rem)] font-bold tracking-tight text-slate-950 leading-tight"
              title={formatted}
              aria-label={formatted}
            >
              {displayVal}
            </p>
            <p className="mt-1 text-xs text-slate-500">{rawVal === 0 ? "No data yet" : note}</p>
            {isCurrency && rawVal > 0 ? (
              <p className="sr-only">Compact value: {compactNumber.format(rawVal)}</p>
            ) : null}
          </Link>
        );
      })}
    </section>
  );
}
