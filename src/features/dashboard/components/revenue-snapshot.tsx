import { TrendingUp, CircleDollarSign, BarChart3 } from "lucide-react";

export function RevenueSnapshot() {
  const data = [
    {
      label: "Won Revenue",
      value: "$84,500",
      trend: "+15% from last month",
      icon: CircleDollarSign,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Open Pipeline Value",
      value: "$142,000",
      trend: "24 active deals",
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Average Won Deal",
      value: "$3,520",
      trend: "+2% from last month",
      icon: BarChart3,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {data.map((item, i) => (
        <div key={i} className="flex items-center justify-between rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
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
        </div>
      ))}
    </div>
  );
}
