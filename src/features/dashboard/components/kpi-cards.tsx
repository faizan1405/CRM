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

type KPICardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  colorScheme: "default" | "blue" | "purple" | "green" | "orange" | "emerald";
  supportText?: string;
  href?: string;
  fullValue?: string;
};

const colorStyles = {
  default: "bg-slate-50 text-slate-700 border-slate-200/80 icon-slate-500",
  blue: "bg-blue-50 text-blue-700 border-blue-200/80 icon-blue-500",
  purple: "bg-purple-50 text-purple-700 border-purple-200/80 icon-purple-500",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200/80 icon-emerald-500",
  orange: "bg-amber-50 text-amber-700 border-amber-200/80 icon-amber-500",
  emerald: "bg-teal-50 text-teal-700 border-teal-200/80 icon-teal-500",
};

export function KPICard({ label, value, icon: Icon, colorScheme, supportText, href, fullValue }: KPICardProps) {
  const styles = colorStyles[colorScheme];
  const [bg, text, border] = styles.split(" ");
  
  const content = (
    <div className={`relative flex h-full flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${href ? "hover:border-slate-300 cursor-pointer" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p title={label} className="truncate text-xs sm:text-[13px] font-semibold text-slate-500">{label}</p>
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-xl border ${bg} ${border}`}>
          <Icon className={`size-4 ${text}`} strokeWidth={2} />
        </div>
      </div>
      <div className="mt-2.5 sm:mt-3 flex min-w-0 flex-wrap items-baseline gap-1.5 sm:gap-2">
        <span title={fullValue} aria-label={fullValue} className="break-all text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-none">{value}</span>
        {supportText && <span className="text-[11px] sm:text-xs font-medium text-slate-500">{supportText}</span>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-2xl">
        {content}
      </Link>
    );
  }

  return content;
}

export function KPICards({ data }: { data: { totalLeads: number; newLeads: number; qualifiedLeads: number; wonClients: number; followUpsToday: number; wonRevenue: number } }) {
  
  const formattedRevenue = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(data.wonRevenue);

  const stats = [
    { label: "Total Leads", value: data.totalLeads, icon: Users, colorScheme: "default" as const, href: "/leads" },
    { label: "New Leads", value: data.newLeads, icon: Sparkles, colorScheme: "blue" as const, href: "/leads?status=NEW" },
    { label: "Qualified", value: data.qualifiedLeads, icon: ShieldCheck, colorScheme: "purple" as const, href: "/leads?status=QUALIFIED" },
    { label: "Won Clients", value: data.wonClients, icon: Trophy, colorScheme: "green" as const, href: "/leads?status=WON" },
    { label: "Follow-ups", supportText: "Today", value: data.followUpsToday, icon: CalendarClock, colorScheme: "orange" as const, href: "/follow-ups?filter=today" },
    { label: "Won Revenue", value: compactCurrency(data.wonRevenue), fullValue: formattedRevenue, icon: Coins, colorScheme: "emerald" as const, href: "/analytics" },
  ];

  return (
    <div
      tabIndex={0}
      aria-label="Key Performance Indicators"
      className="flex w-full flex-row flex-nowrap items-stretch gap-3 overflow-x-auto pb-2.5 pt-1 overscroll-x-contain snap-x snap-mandatory scroll-smooth [scrollbar-width:thin] focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-2xl lg:grid lg:grid-cols-6 lg:gap-4 lg:overflow-x-visible lg:pb-0"
    >
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-[150px] max-w-[200px] flex-1 shrink-0 snap-start lg:min-w-0 lg:max-w-none lg:shrink">
          <KPICard {...stat} />
        </div>
      ))}
    </div>
  );
}
