import { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Phone, MessageCircle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { telLink, waLink } from "@/lib/crm/format";
import { leadStatusLabel, leadStatusTone, quickStatusLabel, quickStatusTone, type Tone } from "@/lib/crm/labels";
import type { LeadStatus, QuickStatus } from "@/lib/crm/types";

const tones: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground [--dot:var(--subtle)]",
  info: "bg-info-soft text-info [--dot:var(--info)]",
  primary: "bg-accent text-accent-foreground [--dot:var(--primary)]",
  warning: "bg-warning-soft text-warning [--dot:var(--warning)]",
  success: "bg-success-soft text-success [--dot:var(--success)]",
  danger: "bg-danger-soft text-destructive [--dot:var(--destructive)]",
};

export function Pill({ tone = "neutral", children, className, dot = true }: { tone?: Tone; children: ReactNode; className?: string | undefined; dot?: boolean }) {
  return (
    <span className={cn("inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[12px] font-medium", tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-[var(--dot)]" />}
      {children}
    </span>
  );
}

export const LeadStatusPill = ({ status, className }: { status: LeadStatus; className?: string | undefined }) =>
  <Pill tone={leadStatusTone[status]} className={className}>{leadStatusLabel[status]}</Pill>;

export const QuickStatusPill = ({ status, className }: { status: QuickStatus; className?: string | undefined }) =>
  status === "NONE" ? null : <Pill tone={quickStatusTone[status]} dot={false} className={cn("bg-transparent ring-1 ring-inset ring-current/20", className)}>{quickStatusLabel[status]}</Pill>;

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="truncate text-[22px] font-semibold leading-tight sm:text-[26px]">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ className, children, hover }: { className?: string | undefined; children: ReactNode; hover?: boolean }) {
  return <div className={cn("card-surface", hover && "card-hover", className)}>{children}</div>;
}

export function SectionHead({ title, meta, action, className }: { title: string; meta?: ReactNode; action?: ReactNode; className?: string | undefined }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-5 pb-3 pt-4", className)}>
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="truncate text-[13.5px] font-semibold">{title}</h2>
        {meta && <span className="shrink-0 text-xs text-muted-foreground tabular">{meta}</span>}
      </div>
      {action}
    </div>
  );
}
/** @deprecated use SectionHead */
export const CardTitle = ({ children, action }: { children: string; action?: ReactNode }) => <SectionHead title={children} action={action} />;

export function Delta({ value, positive = true }: { value: string; positive?: boolean }) {
  const I = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium tabular", positive ? "bg-success-soft text-success" : "bg-danger-soft text-destructive")}>
      <I className="h-3 w-3" />{value}
    </span>
  );
}

/** A single card split into hairline-separated metric cells. */
export function MetricStrip({ items }: { items: { label: string; value: string; delta?: string; positive?: boolean; hint?: string }[] }) {
  return (
    <Card className="grid grid-cols-2 overflow-hidden lg:grid-cols-4">
      {items.map((m, i) => (
        <div key={m.label} className={cn("min-w-0 p-4 sm:p-5", i % 2 === 1 && "border-l", i >= 2 && "border-t lg:border-t-0", i === 2 && "lg:border-l")}>
          <div className="eyebrow truncate">{m.label}</div>
          <div className="mt-2 truncate text-[20px] font-semibold tabular sm:text-[24px]">{m.value}</div>
          <div className="mt-1.5 flex min-h-5 flex-wrap items-center gap-1.5">
            {m.delta && <Delta value={m.delta} positive={m.positive ?? true} />}
            {m.hint && <span className="truncate text-xs text-muted-foreground">{m.hint}</span>}
          </div>
        </div>
      ))}
    </Card>
  );
}

/** Back-compat single stat card */
export function StatCard({ label, value, delta, positive = true }: { label: string; value: string; delta?: string; icon?: LucideIcon; positive?: boolean }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="eyebrow truncate">{label}</div>
      <div className="mt-2 text-[20px] font-semibold tabular sm:text-[24px]">{value}</div>
      {delta && <div className="mt-1.5"><Delta value={delta} positive={positive} /></div>}
    </Card>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="relative">
        <span className="absolute inset-0 -m-3 rounded-2xl border border-dashed" />
        <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-card text-muted-foreground shadow-[var(--shadow-card)]"><Icon className="h-[18px] w-[18px]" /></span>
      </div>
      <h3 className="mt-6 text-[14px] font-semibold">{title}</h3>
      <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const avatarHues = [162, 75, 230, 25, 300, 120];
export function Avatar({ name, className }: { name: string; className?: string | undefined }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  const hue = avatarHues[name.charCodeAt(0) % avatarHues.length];
  return (
    <span
      className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold", className)}
      style={{ background: `oklch(0.95 0.03 ${hue})`, color: `oklch(0.4 0.08 ${hue})`, boxShadow: `inset 0 0 0 1px oklch(0.4 0.08 ${hue} / 10%)` }}
    >
      {initials}
    </span>
  );
}

export function ContactActions({ phone, size = "md", className }: { phone: string; size?: "sm" | "md" | "lg"; className?: string | undefined }) {
  if (size === "sm") {
    return (
      <div className={cn("flex shrink-0 gap-1", className)}>
        <a aria-label="Call" href={telLink(phone)} onClick={(e) => e.stopPropagation()} className="press grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><Phone className="h-[15px] w-[15px]" /></a>
        <a aria-label="WhatsApp" href={waLink(phone)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="press grid h-8 w-8 place-items-center rounded-lg text-whatsapp hover:bg-success-soft"><MessageCircle className="h-[15px] w-[15px]" /></a>
      </div>
    );
  }
  const h = size === "lg" ? "h-12 text-[14px]" : "h-10 text-[13px]";
  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      <a href={telLink(phone)} className={cn("press inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-4 font-medium text-ink-foreground hover:opacity-90", h)}><Phone className="h-4 w-4" /> Call</a>
      <a href={waLink(phone)} target="_blank" rel="noreferrer" className={cn("press inline-flex items-center justify-center gap-2 rounded-xl bg-whatsapp px-4 font-medium text-whatsapp-foreground hover:opacity-90", h)}><MessageCircle className="h-4 w-4" /> WhatsApp</a>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; className?: string | undefined }) {
  return (
    <div className={cn("-mx-1 flex gap-0.5 overflow-x-auto px-1 [scrollbar-width:none]", className)}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-all duration-200",
              active ? "bg-card text-foreground shadow-[var(--shadow-card)]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
            {o.count !== undefined && <span className={cn("tabular text-[11.5px]", active ? "text-muted-foreground" : "text-subtle")}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Skeleton({ className }: { className?: string | undefined }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

/** Charts render client-side only; show a matching skeleton until mounted. */
export function ChartFrame({ className, children }: { className?: string | undefined; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <div className={cn("relative", className)}>
      {ready ? children : (
        <div className="flex h-full items-end gap-2 px-2 pb-6">
          {[40, 65, 50, 80, 72, 90].map((h, i) => <div key={i} className="flex-1" style={{ height: `${h}%` }}><Skeleton className="h-full" /></div>)}
        </div>
      )}
    </div>
  );
}

export function DemoTag() {
  return <span className="rounded border border-dashed px-1.5 py-px text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Demo</span>;
}

export const chartTooltip = {
  contentStyle: { borderRadius: 10, border: "none", boxShadow: "var(--shadow-float)", fontSize: 12, padding: "8px 10px", background: "var(--popover)" },
  labelStyle: { color: "var(--muted-foreground)", marginBottom: 2, fontSize: 11 },
  itemStyle: { padding: 0, color: "var(--foreground)", fontWeight: 500 },
};
