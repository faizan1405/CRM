"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const EASE = [0.22, 0.7, 0.2, 1] as const;

export const STAGE_COLOR: Record<string, string> = {
  NEW: "var(--info)",
  CONTACTED: "var(--chart-4)",
  QUALIFIED: "var(--chart-2)",
  PROPOSAL_SENT: "var(--chart-3)",
  WON: "var(--primary)",
  LOST: "var(--destructive)",
};

export function AnalyticsCard({
  className,
  children,
  as: As = "section",
  id,
}: {
  className?: string;
  children: ReactNode;
  as?: "section" | "div";
  id?: string;
}) {
  return (
    <As
      id={id}
      className={cn(
        "min-w-0 rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] transition-[box-shadow,border-color] duration-300 hover:border-foreground/12 hover:shadow-[var(--shadow-lift)] sm:p-5",
        className
      )}
    >
      {children}
    </As>
  );
}

export type MetricInfo = {
  meaning: string;
  formula: string;
  scope: string;
  kind: "Period metric" | "Current snapshot";
  level?: "A" | "B" | "C";
};

export function InfoTip({ info, label }: { info: MetricInfo; label: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`About ${label}`}
          className="press -m-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-subtle transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3.5 text-[12.5px] z-50">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-foreground">{label}</p>
        </div>
        <p className="mt-1.5 leading-relaxed text-muted-foreground">{info.meaning}</p>
        <dl className="mt-3 space-y-1.5 border-t border-border pt-2.5">
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-subtle">Formula</dt>
            <dd className="font-medium text-foreground">{info.formula}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-subtle">Range</dt>
            <dd className="text-muted-foreground">{info.scope}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-subtle">Type</dt>
            <dd className="text-muted-foreground">{info.kind}</dd>
          </div>
        </dl>
      </PopoverContent>
    </Popover>
  );
}

export function CardHead({
  title,
  subtitle,
  action,
  info,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  info?: MetricInfo;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-semibold tracking-tight text-foreground">{title}</h3>
          {info && <InfoTip info={info} label={title} />}
        </div>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Sliding-indicator segmented control with framer-motion/motion layoutId. */
export function SlidingTabs<T extends string>({
  id,
  value,
  onChange,
  options,
  size = "md",
  className,
}: {
  id: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "relative inline-flex max-w-full overflow-x-auto rounded-[10px] bg-muted p-0.5 [scrollbar-width:none]",
        className
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative shrink-0 whitespace-nowrap rounded-lg font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
              size === "sm"
                ? "h-7 px-2.5 text-[12px]"
                : "h-8 px-2.5 text-[12.5px] sm:px-3 sm:text-[13px]",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId={`tab-${id}`}
                className="absolute inset-0 rounded-lg bg-card shadow-[var(--shadow-card)]"
                transition={{ type: "tween", duration: 0.24, ease: EASE }}
              />
            )}
            <span className="relative z-10">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function useCountUp(target: number, duration = 800) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (reduce || !Number.isFinite(target)) {
      setV(target);
      from.current = target;
      return;
    }
    const start = from.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const val = start + (target - start) * (1 - Math.pow(1 - k, 3));
      setV(val);
      from.current = val;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduce]);

  return v;
}

export function CountUp({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  const v = useCountUp(value);
  return (
    <span className={cn("tabular", className)} title={format(value)}>
      {format(v)}
    </span>
  );
}

/** Floating chart tooltip shell. */
export function TipShell({
  title,
  rows,
  foot,
}: {
  title: ReactNode;
  rows: { label: string; value: ReactNode; color?: string }[];
  foot?: ReactNode;
}) {
  return (
    <div className="min-w-[168px] rounded-xl border border-border bg-popover px-3 py-2.5 text-[12px] shadow-[var(--shadow-float)]">
      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{title}</p>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {r.color && (
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: r.color }} />
              )}
              {r.label}
            </span>
            <span className="tabular font-semibold text-foreground">{r.value}</span>
          </div>
        ))}
      </div>
      {foot && <p className="mt-2 border-t border-border pt-1.5 text-[11px] text-subtle">{foot}</p>}
    </div>
  );
}

export const axisProps = {
  tick: { fontSize: 11, fill: "var(--muted-foreground)" },
  tickLine: false,
  axisLine: false,
} as const;

export function ClientOnlyChart({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <div className={cn("relative min-w-0", className)}>
      {ready ? (
        children
      ) : (
        <div className="h-full w-full animate-pulse rounded-lg bg-muted/60" />
      )}
    </div>
  );
}
