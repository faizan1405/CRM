import { Banknote, CircleDollarSign, ClockAlert, Percent, ReceiptIndianRupee, UsersRound } from "lucide-react";
import type { AnalyticsKpiData } from "../types";
import { compactNumber, currency } from "./shared";

const cards = [
  { key: "totalLeads", label: "Total Leads", icon: UsersRound, tone: "bg-blue-50 text-blue-700", format: (v: number) => v.toLocaleString("en-IN"), note: "in selected period" },
  { key: "winRate", label: "Win Rate", icon: Percent, tone: "bg-emerald-50 text-emerald-700", format: (v: number) => `${(v * 100).toFixed(1)}%`, note: "of closed deals" },
  { key: "wonRevenue", label: "Won Revenue", icon: CircleDollarSign, tone: "bg-green-50 text-green-700", format: currency.format, note: "closed-won value" },
  { key: "openPipelineValue", label: "Open Pipeline", icon: Banknote, tone: "bg-purple-50 text-purple-700", format: currency.format, note: "active opportunity value" },
  { key: "avgWonDeal", label: "Average Won Deal", icon: ReceiptIndianRupee, tone: "bg-cyan-50 text-cyan-700", format: currency.format, note: "per won deal" },
  { key: "overdueFollowUps", label: "Overdue Follow-ups", icon: ClockAlert, tone: "bg-red-50 text-red-700", format: (v: number) => v.toLocaleString("en-IN"), note: "need attention" },
] as const;

export function AnalyticsKpis({ data }: { data: AnalyticsKpiData }) {
  return <section aria-label="Key performance indicators" className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">{cards.map(({ key, label, icon: Icon, tone, format, note }) => (
    <article key={key} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className={`mb-4 grid size-9 place-items-center rounded-xl ${tone}`}><Icon aria-hidden="true" size={18} /></div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-[clamp(1.2rem,1.5vw,1.5rem)] font-bold tracking-tight text-slate-950" title={format(data[key])}>{format(data[key])}</p>
      <p className="mt-1 text-xs text-slate-500">{data[key] === 0 ? "No data yet" : note}</p>
      {key === "openPipelineValue" && data[key] > 0 ? <p className="sr-only">Compact value: {compactNumber.format(data[key])}</p> : null}
    </article>
  ))}</section>;
}
