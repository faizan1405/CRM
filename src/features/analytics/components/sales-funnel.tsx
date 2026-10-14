"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, CircleAlert, CornerDownRight } from "lucide-react";
import type { FunnelStage } from "../types";
import { bottleneck, pct, transitions } from "../derive";
import { AnalyticsCard, CardHead, EASE } from "./kit";
import { cn } from "@/lib/utils";

export function SalesFunnel({
  stages,
  lostCount = 0,
}: {
  stages: FunnelStage[];
  lostCount?: number;
}) {
  const topCount = stages?.[0]?.reached ?? 0;
  const totalReached = stages?.reduce((sum, s) => sum + s.reached, 0) ?? 0;
  const hasData = Boolean(stages && stages.length > 0 && topCount > 0 && totalReached > 0);

  const tr = hasData ? transitions(stages) : [];
  const bn = hasData ? bottleneck(stages) : null;
  const [active, setActive] = useState<number>(bn?.index ?? 1);
  const sel = tr.find((t) => t.index === active) ?? tr[0] ?? null;

  if (!hasData) {
    return (
      <AnalyticsCard className="xl:col-span-2">
        <CardHead
          title="Sales funnel"
          subtitle="Conversion through each stage — watch for steep drop-offs."
        />
        <div className="grid min-h-64 place-items-center rounded-xl bg-muted/40 text-center">
          <div>
            <p className="font-medium text-foreground">No funnel activity yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Stage movement will appear as leads enter and progress through the pipeline.
            </p>
          </div>
        </div>
      </AnalyticsCard>
    );
  }

  const top = topCount;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <AnalyticsCard>
        <CardHead
          title="Sales funnel"
          subtitle="Leads that reached each stage. Tap a step to inspect it."
          info={{
            meaning:
              "Counts leads that reached or passed each stage. Lost is a separate outcome.",
            formula: "reached(stage) and reached ÷ reached(previous)",
            scope: "Selected range",
            kind: "Period metric",
          }}
        />
        <div className="space-y-0">
          {stages.map((s, i) => {
            const t = tr.find((x) => x.index === i);
            const w = Math.max(14, (s.reached / top) * 100);
            const isBn = bn?.index === i;
            const isActive = active === i;

            return (
              <div key={s.status}>
                {t && (
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    aria-label={`${t.from} to ${t.to}: ${
                      t.conversion === null
                        ? "insufficient history"
                        : pct(t.conversion, 1) + " conversion"
                    }`}
                    className={cn(
                      "group mx-auto my-1 flex w-full items-center justify-center gap-2 rounded-lg py-1 text-[11.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
                      isActive
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <ArrowDown
                      className={cn(
                        "h-3 w-3 transition-transform",
                        isActive && "translate-y-0.5"
                      )}
                    />
                    {t.conversion === null ? (
                      <span className="text-subtle">Insufficient history</span>
                    ) : (
                      <>
                        <span className="tabular font-semibold">
                          {pct(t.conversion, 0)}
                        </span>
                        <span className="text-subtle">converted</span>
                        <span className="text-subtle">·</span>
                        <span
                          className={cn(
                            "tabular",
                            isBn && "font-semibold text-warning"
                          )}
                        >
                          {pct(t.dropOff!, 0)} drop
                        </span>
                        {isBn && (
                          <span className="rounded-md bg-warning-soft px-1.5 py-px text-[10.5px] font-medium text-warning">
                            Bottleneck
                          </span>
                        )}
                      </>
                    )}
                  </button>
                )}

                <div className="flex items-center gap-3">
                  <Link
                    href={`/leads?status=${encodeURIComponent(s.status)}`}
                    className="w-[88px] shrink-0 truncate text-[12.5px] font-medium text-foreground hover:underline sm:w-[104px]"
                  >
                    {s.label}
                  </Link>

                  <div className="relative h-9 min-w-0 flex-1">
                    <motion.div
                      className={cn(
                        "absolute inset-y-0 left-0 flex items-center justify-end rounded-lg pr-2.5 transition-[box-shadow] duration-200",
                        (isActive || active === i + 1) &&
                          "shadow-[0_0_0_2px_var(--card),0_0_0_3.5px_var(--ring)]"
                      )}
                      style={{
                        background: `color-mix(in oklab, var(--primary) ${
                          [20, 34, 52, 72, 100][Math.min(i, 4)]
                        }%, var(--card))`,
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${w}%` }}
                      transition={{ duration: 0.8, ease: EASE, delay: i * 0.07 }}
                    >
                      <span
                        className={cn(
                          "tabular text-[12.5px] font-semibold",
                          i >= 3 ? "text-primary-foreground" : "text-foreground"
                        )}
                      >
                        {s.reached.toLocaleString("en-IN")}
                      </span>
                    </motion.div>
                  </div>

                  <span className="tabular w-10 shrink-0 text-right text-[11.5px] text-muted-foreground">
                    {pct(s.reached / top)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {lostCount > 0 && (
          <div className="mt-4 flex items-center gap-3 border-t border-border pt-3.5">
            <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-subtle" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="font-medium text-foreground">
                  Lost{" "}
                  <span className="font-normal text-muted-foreground">
                    · alternative outcome
                  </span>
                </span>
                <span className="tabular font-semibold text-foreground">
                  {lostCount.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full bg-destructive"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(100, (lostCount / (top + lostCount)) * 100)}%`,
                  }}
                  transition={{ duration: 0.7, ease: EASE }}
                />
              </div>
            </div>
          </div>
        )}
      </AnalyticsCard>

      <div className="grid grid-cols-1 gap-4">
        <AnalyticsCard>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Selected step
          </p>
          <AnimatePresence mode="wait">
            {sel ? (
              <motion.div
                key={sel.index}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                <p className="mt-1.5 text-[16px] font-semibold tracking-tight text-foreground">
                  {sel.from} → {sel.to}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
                  <div>
                    <dt className="text-muted-foreground">Reached {sel.from}</dt>
                    <dd className="tabular text-[18px] font-semibold text-foreground">
                      {sel.fromCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Reached {sel.to}</dt>
                    <dd className="tabular text-[18px] font-semibold text-foreground">
                      {sel.toCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Conversion</dt>
                    <dd className="tabular text-[18px] font-semibold text-primary">
                      {sel.conversion === null ? "—" : pct(sel.conversion, 1)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Drop-off</dt>
                    <dd className="tabular text-[18px] font-semibold text-foreground">
                      {sel.dropOff === null ? "—" : pct(sel.dropOff, 1)}
                    </dd>
                  </div>
                </dl>
                {sel.conversion === null && (
                  <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-[12px] text-muted-foreground">
                    Insufficient history. Some leads predate activity tracking, so
                    this conversion cannot be verified.
                  </p>
                )}
              </motion.div>
            ) : (
              <p className="mt-2 text-[13px] text-muted-foreground">
                Select a stage transition to inspect its drop-off.
              </p>
            )}
          </AnimatePresence>
        </AnalyticsCard>

        <AnalyticsCard className="bg-[color-mix(in_oklab,var(--warning-soft)_45%,var(--card))]">
          <div className="flex items-center gap-2">
            <CircleAlert className="h-4 w-4 text-warning" />
            <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
              Biggest funnel bottleneck
            </h3>
          </div>
          {bn ? (
            <>
              <p className="mt-2.5 text-[20px] font-semibold tracking-tight text-foreground">
                {bn.from} → {bn.to}
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                <span className="tabular font-semibold text-foreground">
                  {pct(bn.dropOff!)}
                </span>{" "}
                of leads that reached {bn.from} did not move to {bn.to} (
                {bn.fromCount - bn.toCount} of {bn.fromCount}). It is the
                largest verified drop-off in this range, so it is where
                follow-up effort is likely to matter most.
              </p>
              <button
                type="button"
                onClick={() => setActive(bn.index)}
                className="press mt-3 text-[12.5px] font-medium text-primary hover:underline cursor-pointer"
              >
                Inspect this step
              </button>
            </>
          ) : (
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              Not enough verified history to identify a bottleneck.
            </p>
          )}
        </AnalyticsCard>
      </div>
    </div>
  );
}
