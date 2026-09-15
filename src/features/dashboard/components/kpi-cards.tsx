import Link from "next/link";
import { BadgeCheck, CalendarClock, CircleDollarSign, Handshake, UserPlus, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type KPICardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  colorScheme: "default" | "blue" | "purple" | "green" | "orange" | "emerald";
  supportText?: string;
  href?: string;
};

const colorStyles = {
  default: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", accent: "bg-slate-400" },
  blue: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", accent: "bg-blue-400" },
  purple: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", accent: "bg-purple-400" },
  green: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", accent: "bg-green-500" },
  orange: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", accent: "bg-amber-400" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", accent: "bg-emerald-400" },
};

export function KPICard({ label, value, icon: Icon, colorScheme, supportText, href }: KPICardProps) {
  const styles = colorStyles[colorScheme];

  const content = (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)] ${href ? "cursor-pointer hover:border-blue-300 active:scale-[0.97]" : "hover:border-slate-300"}`}
    >
      {/* Subtle accent left border */}
      <div className={`absolute inset-y-0 left-0 w-[3px] ${styles.accent} opacity-60`} />
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${styles.bg} ${styles.border} transition-transform duration-200 group-hover:scale-110`}>
          <Icon className={`h-5 w-5 ${styles.text}`} />
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight text-slate-900 transition-all duration-200">{value}</span>
        {supportText && <span className="text-xs font-medium text-slate-500">{supportText}</span>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-2xl">
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
    { label: "Total Leads", value: data.totalLeads, icon: UsersRound, colorScheme: "default" as const, href: "/leads" },
    { label: "New Leads", value: data.newLeads, icon: UserPlus, colorScheme: "blue" as const, href: "/leads?status=NEW" },
    { label: "Qualified", value: data.qualifiedLeads, icon: BadgeCheck, colorScheme: "purple" as const, href: "/leads?status=QUALIFIED" },
    { label: "Won Clients", value: data.wonClients, icon: Handshake, colorScheme: "green" as const, href: "/leads?status=WON" },
    { label: "Follow-ups Today", value: data.followUpsToday, icon: CalendarClock, colorScheme: "orange" as const, href: "/follow-ups?filter=today" },
    { label: "Revenue", value: formattedRevenue, icon: CircleDollarSign, colorScheme: "emerald" as const, href: "/analytics" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {stats.map((stat) => (
        <KPICard key={stat.label} {...stat} />
      ))}
    </div>
  );
}

