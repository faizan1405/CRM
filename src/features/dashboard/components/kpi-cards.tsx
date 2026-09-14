import { BadgeCheck, CalendarClock, CircleDollarSign, Handshake, UserPlus, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type KPICardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  colorScheme: "default" | "blue" | "purple" | "green" | "orange" | "emerald";
  supportText?: string;
};

const colorStyles = {
  default: "bg-slate-50 text-slate-700 border-slate-200 icon-slate-500",
  blue: "bg-blue-50 text-blue-700 border-blue-200 icon-blue-500",
  purple: "bg-purple-50 text-purple-700 border-purple-200 icon-purple-500",
  green: "bg-green-50 text-green-700 border-green-200 icon-green-500",
  orange: "bg-amber-50 text-amber-700 border-amber-200 icon-amber-500",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 icon-emerald-500",
};

export function KPICard({ label, value, icon: Icon, colorScheme, supportText }: KPICardProps) {
  const styles = colorStyles[colorScheme];
  const [bg, text, border] = styles.split(" ");
  
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${bg} ${border}`}>
          <Icon className={`h-5 w-5 ${text}`} />
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight text-slate-900">{value}</span>
        {supportText && <span className="text-xs font-medium text-slate-500">{supportText}</span>}
      </div>
    </div>
  );
}

export function KPICards({ data }: { data: { totalLeads: number; newLeads: number; qualifiedLeads: number; wonClients: number; followUpsToday: number; wonRevenue: number } }) {
  
  const formattedRevenue = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(data.wonRevenue);

  const stats = [
    { label: "Total Leads", value: data.totalLeads, icon: UsersRound, colorScheme: "default" as const },
    { label: "New Leads", value: data.newLeads, icon: UserPlus, colorScheme: "blue" as const },
    { label: "Qualified", value: data.qualifiedLeads, icon: BadgeCheck, colorScheme: "purple" as const },
    { label: "Won Clients", value: data.wonClients, icon: Handshake, colorScheme: "green" as const },
    { label: "Follow-ups Today", value: data.followUpsToday, icon: CalendarClock, colorScheme: "orange" as const },
    { label: "Revenue", value: formattedRevenue, icon: CircleDollarSign, colorScheme: "emerald" as const },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {stats.map((stat) => (
        <KPICard key={stat.label} {...stat} />
      ))}
    </div>
  );
}
