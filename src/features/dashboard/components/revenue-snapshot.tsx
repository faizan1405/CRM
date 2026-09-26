import Link from "next/link";
import { TrendingUp, CircleDollarSign, BarChart3 } from "lucide-react";

export function RevenueSnapshot({ data }: { data: { won: number; openPipeline: number; avgWonDeal: number } }) {
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);

  const displayData = [
    {
      label: "Won Deal Value",
      value: formatCurrency(data.won),
      trend: "Total to date",
      icon: CircleDollarSign,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Open Pipeline Value",
      value: formatCurrency(data.openPipeline),
      trend: "Active stages",
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Average Won Deal",
      value: formatCurrency(data.avgWonDeal),
      trend: "Based on won deals",
      icon: BarChart3,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {displayData.map((item, i) => (
        <Link href={i === 1 ? "/pipeline" : "/analytics"} aria-label={`View ${item.label}`} key={i} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 flex flex-wrap gap-3 items-center justify-between rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${item.bg}`}>
              <item.icon className={`h-5 w-5 ${item.color}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{item.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{item.trend}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-slate-900">{item.value}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
