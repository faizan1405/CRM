import Link from "next/link";
import { TrendingUp, CircleDollarSign, BarChart3, ChevronRight } from "lucide-react";
import { inr } from "@/lib/crm/format";

export function RevenueSnapshot({
  data,
}: {
  data: { won: number; openPipeline: number; avgWonDeal: number };
}) {
  const displayData = [
    {
      label: "Won Deal Value",
      value: inr(data.won),
      trend: "Total won contracted value",
      icon: CircleDollarSign,
      color: "text-primary",
      bg: "bg-success-soft",
      href: "/analytics",
    },
    {
      label: "Open Pipeline Value",
      value: inr(data.openPipeline),
      trend: "Active leads pipeline value",
      icon: TrendingUp,
      color: "text-info",
      bg: "bg-info-soft",
      href: "/pipeline",
    },
    {
      label: "Average Won Deal",
      value: inr(data.avgWonDeal),
      trend: "Based on confirmed won deals",
      icon: BarChart3,
      color: "text-chart-2",
      bg: "bg-muted",
      href: "/analytics",
    },
  ];

  return (
    <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl bg-card">
      {displayData.map((item, i) => (
        <Link
          href={item.href}
          aria-label={`View ${item.label}`}
          key={i}
          className="press group flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.bg}`}>
              <item.icon className={`h-4 w-4 ${item.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-foreground">{item.label}</p>
              <p className="text-[11.5px] text-muted-foreground truncate">{item.trend}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[16px] font-semibold tabular text-foreground">{item.value}</span>
            <ChevronRight className="h-4 w-4 text-subtle transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>
      ))}
    </div>
  );
}
