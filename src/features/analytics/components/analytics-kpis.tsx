import type { CoreMetrics } from "@/features/analytics/types";
import {
  Users,
  TrendingUp,
  CircleDollarSign,
  Layers,
  Target,
  AlertCircle,
} from "lucide-react";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    notation: val >= 1_000_000 ? "compact" : "standard",
  }).format(val);

type KpiCardProps = {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent: string;
  alert?: boolean;
};

function KpiCard({ label, value, sub, icon: Icon, accent, alert }: KpiCardProps) {
  const bgMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    slate: "bg-slate-50 text-slate-600 border-slate-200",
  };
  const iconStyle = bgMap[accent] ?? bgMap.slate;

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-shadow hover:shadow-md ${alert ? "ring-1 ring-red-300" : ""}`}
      aria-label={`${label}: ${value}${sub ? `, ${sub}` : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${iconStyle}`}
          aria-hidden="true"
        >
          <Icon size={16} />
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
      {sub && (
        <p className={`mt-0.5 text-xs font-medium ${alert ? "text-red-500" : "text-slate-400"}`}>
          {sub}
        </p>
      )}
    </article>
  );
}

type Props = { data: CoreMetrics };

export function AnalyticsKpis({ data }: Props) {
  // winRate is expressed as 0-1 from Agent A
  const winRatePct = data.winRate * 100;

  const cards: KpiCardProps[] = [
    {
      label: "Total Leads",
      value: String(data.totalLeads),
      icon: Users,
      accent: "blue",
    },
    {
      label: "Win Rate",
      value: `${winRatePct.toFixed(1)}%`,
      sub: "of closed deals",
      icon: Target,
      accent: winRatePct >= 30 ? "green" : winRatePct >= 15 ? "amber" : "red",
    },
    {
      label: "Won Revenue",
      value: formatCurrency(data.wonRevenue),
      sub: "closed in period",
      icon: CircleDollarSign,
      accent: "green",
    },
    {
      label: "Open Pipeline",
      value: formatCurrency(data.openPipelineValue),
      sub: "active stages",
      icon: Layers,
      accent: "purple",
    },
    {
      label: "Avg Won Deal",
      value: data.avgWonDeal > 0 ? formatCurrency(data.avgWonDeal) : "—",
      sub: "average closed value",
      icon: TrendingUp,
      accent: "slate",
    },
    {
      label: "Overdue Follow-ups",
      value: String(data.overdueFollowUps),
      sub: data.overdueFollowUps > 0 ? "need immediate action" : "all up to date",
      icon: AlertCircle,
      accent: data.overdueFollowUps > 0 ? "red" : "green",
      alert: data.overdueFollowUps > 0,
    },
  ];

  return (
    <section aria-label="Key performance indicators">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <KpiCard key={c.label} {...c} />
        ))}
      </div>
    </section>
  );
}
