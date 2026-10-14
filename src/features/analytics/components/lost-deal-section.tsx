"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { LostReasonsAnalyticsData } from "@/features/lost-reasons/types";
import { pct } from "../derive";
import { AnalyticsCard, CardHead, EASE } from "./kit";
import { cn } from "@/lib/utils";

export function LostDealSection({
  data,
}: {
  data?: LostReasonsAnalyticsData;
}) {
  const [act, setAct] = useState<number | null>(null);

  const rows = (data?.breakdown ?? []).filter((r) => r.count > 0);
  const total = data?.totalLost || rows.reduce((a, r) => a + r.count, 0) || 1;
  const top = data?.topReason || rows[0] || null;

  if (!rows.length) {
    return (
      <AnalyticsCard>
        <CardHead
          title="Lost deal analysis"
          subtitle="Recorded lost reasons, ranked"
        />
        <div className="grid min-h-48 place-items-center rounded-xl bg-muted/40 p-4 text-center">
          <div>
            <p className="font-medium text-foreground">No lost lead records yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Lost reasons will appear here as leads are marked lost with a recorded rationale.
            </p>
          </div>
        </div>
      </AnalyticsCard>
    );
  }

  return (
    <AnalyticsCard>
      <CardHead
        title="Lost deal analysis"
        subtitle="Recorded lost reasons, ranked"
      />

      {top && (
        <div className="mb-4 rounded-xl bg-muted/70 px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Most common lost reason
          </p>
          <p className="mt-1 text-[17px] font-semibold tracking-tight text-foreground">
            {top.label}{" "}
            <span className="tabular text-[13px] font-medium text-muted-foreground">
              · {top.count} {top.count === 1 ? "lead" : "leads"},{" "}
              {pct(top.count / total, 1)}
            </span>
          </p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            Based on recorded reasons. Counts show frequency, not cause.
          </p>
        </div>
      )}

      <ol className="space-y-1.5">
        {rows.map((r, i) => (
          <li key={r.reason}>
            <button
              type="button"
              onMouseEnter={() => setAct(i)}
              onMouseLeave={() => setAct(null)}
              onFocus={() => setAct(i)}
              onBlur={() => setAct(null)}
              onClick={() => setAct(act === i ? null : i)}
              className={cn(
                "grid w-full grid-cols-[18px_minmax(0,128px)_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-1 py-1 text-left text-[12.5px] transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
                act !== null && act !== i && "opacity-45"
              )}
            >
              <span className="tabular text-[11px] text-subtle">{i + 1}</span>
              <span className="truncate text-foreground font-medium">
                {r.label}
              </span>
              <span className="h-2 rounded-full bg-muted">
                <motion.span
                  className="block h-full rounded-full"
                  style={{
                    background: "var(--destructive)",
                    opacity: i === 0 ? 0.85 : 0.45,
                  }}
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(r.count / (top?.count || 1)) * 100}%`,
                  }}
                  transition={{ duration: 0.7, ease: EASE, delay: i * 0.04 }}
                />
              </span>
              <span className="tabular w-16 text-right font-medium text-foreground">
                {act === i ? pct(r.count / total, 1) : r.count}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </AnalyticsCard>
  );
}
