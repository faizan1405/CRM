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
import { cn } from "@/lib/utils";

type KPICardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  supportText?: string;
  href?: string;
  fullValue?: string;
};

export function KPICard({ label, value, icon: Icon, supportText, href, fullValue }: KPICardProps) {
  const content = (
    <div className="card-surface card-hover p-4 sm:p-5 flex h-full flex-col justify-between transition-all duration-200">
      <div className="flex items-center justify-between gap-2">
        <span title={label} className="eyebrow truncate">{label}</span>
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      </div>
      <div className="mt-2.5">
        <div
          title={fullValue}
          aria-label={fullValue}
          className="text-[20px] font-semibold tracking-tight text-foreground sm:text-[24px] tabular"
        >
          {value}
        </div>
        {supportText && (
          <div className="mt-1 text-[11.5px] font-medium text-muted-foreground">
            {supportText}
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl">
        {content}
      </Link>
    );
  }

  return content;
}

export function KPICards({
  data,
}: {
  data: {
    totalLeads: number;
    newLeads: number;
    qualifiedLeads: number;
    wonClients: number;
    followUpsToday: number;
    wonRevenue: number;
  };
}) {
  const formattedRevenue = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(data.wonRevenue);

  const stats = [
    { label: "Total Leads", value: data.totalLeads, icon: Users, href: "/leads" },
    { label: "New Leads", value: data.newLeads, icon: Sparkles, href: "/leads?status=NEW" },
    { label: "Qualified", value: data.qualifiedLeads, icon: ShieldCheck, href: "/leads?status=QUALIFIED" },
    { label: "Won Clients", value: data.wonClients, icon: Trophy, href: "/leads?status=WON" },
    {
      label: "Follow-ups",
      supportText: "Today",
      value: data.followUpsToday,
      icon: CalendarClock,
      href: "/follow-ups?filter=today",
    },
    {
      label: "Won Revenue",
      value: compactCurrency(data.wonRevenue),
      fullValue: formattedRevenue,
      icon: Coins,
      href: "/analytics",
    },
  ];

  return (
    <div
      tabIndex={0}
      aria-label="Key Performance Indicators"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4"
    >
      {stats.map((stat) => (
        <KPICard key={stat.label} {...stat} />
      ))}
    </div>
  );
}
