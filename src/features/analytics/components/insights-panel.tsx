"use client";

import { motion } from "motion/react";
import {
  Filter,
  CalendarClock,
  MessageCircle,
  Wallet,
  CircleSlash,
  Layers,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AnalyticsData } from "../types";
import type { LostReasonsAnalyticsData } from "@/features/lost-reasons/types";
import { deriveInsights, type Insight } from "../derive";
import { AnalyticsCard, EASE } from "./kit";
import { cn } from "@/lib/utils";

const ICON: Record<Insight["kind"], LucideIcon> = {
  funnel: Filter,
  followup: CalendarClock,
  revenue: Wallet,
  lost: CircleSlash,
  pipeline: Layers,
};

export function InsightsPanel({
  data,
  lostReasons,
}: {
  data: AnalyticsData;
  lostReasons?: LostReasonsAnalyticsData;
}) {
  const items = deriveInsights(data, lostReasons);

  if (!items.length) {
    return (
      <AnalyticsCard>
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
          Sales performance insights
        </h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          More insights will become available as activity and revenue accumulate in this period.
        </p>
      </AnalyticsCard>
    );
  }

  return (
    <AnalyticsCard className="p-0 sm:p-0 overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border px-4 py-4 sm:px-5">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
            Sales performance insights
          </h3>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Rule-based intelligence derived from verified CRM activity.
          </p>
        </div>
        <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          Live CRM Signals
        </span>
      </div>

      <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
        {items.map((it, i) => {
          const Icon = it.id === "volume" ? MessageCircle : ICON[it.kind];
          return (
            <motion.div
              key={it.id}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, ease: EASE, delay: i * 0.05 }}
              className="group bg-card p-4 transition-colors hover:bg-muted/40 sm:p-5"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                    it.tone === "attention"
                      ? "bg-warning-soft text-warning"
                      : it.tone === "positive"
                      ? "bg-success-soft text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="tabular text-[20px] font-semibold leading-tight tracking-tight text-foreground">
                    {it.value}
                  </p>
                  <p className="mt-1 text-[13px] font-medium leading-snug text-foreground">
                    {it.title}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    {it.detail}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </AnalyticsCard>
  );
}
