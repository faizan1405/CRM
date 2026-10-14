"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { inr, inrCompact } from "@/lib/crm/format";
import type { PipelineStage } from "../types";
import { pct } from "../derive";
import {
  AnalyticsCard,
  CardHead,
  EASE,
  SlidingTabs,
  STAGE_COLOR,
} from "./kit";
import { cn } from "@/lib/utils";

export function PipelineHealth({ stages }: { stages: PipelineStage[] }) {
  const [mode, setMode] = useState<"value" | "count">("value");
  const [act, setAct] = useState<number | null>(null);

  const max = Math.max(
    ...stages.map((s) => (mode === "count" ? s.count : s.value)),
    1
  );
  const totalV = stages.reduce((a, s) => a + s.value, 0) || 1;
  const totalC = stages.reduce((a, s) => a + s.count, 0);

  if (!stages || stages.length === 0 || stages.every((s) => s.count === 0)) {
    return (
      <AnalyticsCard>
        <CardHead
          title="Pipeline health"
          subtitle="Where active opportunity value is sitting right now."
        />
        <div className="grid min-h-56 place-items-center rounded-xl bg-muted/40 text-center">
          <div>
            <p className="font-medium text-foreground">No open pipeline yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Active stages will appear here as leads enter the pipeline.
            </p>
          </div>
        </div>
      </AnalyticsCard>
    );
  }

  return (
    <AnalyticsCard>
      <CardHead
        title="Pipeline health"
        subtitle={
          <>
            Current snapshot ·{" "}
            <span className="tabular font-medium text-foreground">
              {inr(totalV)}
            </span>{" "}
            open across {totalC} {totalC === 1 ? "lead" : "leads"}
          </>
        }
        action={
          <SlidingTabs
            id="pipe"
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: "value", label: "Value" },
              { value: "count", label: "Lead count" },
            ]}
          />
        }
      />

      <div className="space-y-3">
        {stages.map((s, i) => {
          const v = mode === "count" ? s.count : s.value;
          const color = STAGE_COLOR[s.stage] || "var(--primary)";

          return (
            <Link
              key={s.stage}
              href={`/pipeline?stage=${encodeURIComponent(s.stage)}`}
              onMouseEnter={() => setAct(i)}
              onMouseLeave={() => setAct(null)}
              onFocus={() => setAct(i)}
              onBlur={() => setAct(null)}
              className={cn(
                "block w-full rounded-lg text-left transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                act !== null && act !== i && "opacity-45"
              )}
            >
              <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: color }}
                  />
                  {s.label}
                </span>
                <span className="tabular text-muted-foreground">
                  {act === i ? (
                    <span className="text-foreground">
                      {s.count} leads · {inr(s.value)} · {pct(s.value / totalV)}
                    </span>
                  ) : (
                    <span className="font-semibold text-foreground">
                      {mode === "count" ? s.count : inrCompact(s.value)}
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(v / max) * 100}%` }}
                  transition={{ duration: 0.6, ease: EASE }}
                />
              </div>
            </Link>
          );
        })}
      </div>

      <div
        className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label="Share of open pipeline value by stage"
      >
        {stages.map((s) => (
          <div
            key={s.stage}
            className="h-full border-r border-card last:border-0"
            style={{
              width: `${(s.value / totalV) * 100}%`,
              background: STAGE_COLOR[s.stage] || "var(--primary)",
            }}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Share of open value by stage. No closing probabilities are applied.
      </p>
    </AnalyticsCard>
  );
}
