import Link from "next/link";
import { ArrowDown, TriangleAlert } from "lucide-react";
import type { FunnelStage } from "../types";
import { AnalyticsCard, stageColors } from "./shared";

export function SalesFunnel({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(...stages.map((stage) => stage.reached), 0);
  return (
    <AnalyticsCard title="Sales funnel" description="Conversion through each stage — watch for steep drop-offs." className="xl:col-span-2">
      {stages.length === 0 || max === 0 ? (
        <div className="grid min-h-64 place-items-center rounded-xl bg-slate-50 text-center">
          <div>
            <p className="font-medium text-slate-700">No funnel activity yet</p>
            <p className="mt-1 text-sm text-slate-500">Stage movement will appear as leads progress.</p>
          </div>
        </div>
      ) : (
        <ol className="space-y-2.5" aria-label="Lead stage funnel">
          {stages.map((stage, index) => {
            const width = Math.max(48, (stage.reached / max) * 100);
            const drop = stage.conversionFromPrev === null ? null : Math.max(0, 1 - stage.conversionFromPrev);
            const bottleneck = drop !== null && drop >= 0.4;
            return (
              <li key={stage.status} className="flex flex-col items-center">
                {index > 0 ? (
                  <div className="flex items-center justify-center my-1.5">
                    {stage.conversionFromPrev === null ? (
                      <span className="text-[11px] text-slate-400">Conversion unavailable</span>
                    ) : (
                      <div
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium border shadow-2xs ${
                          bottleneck
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        <ArrowDown aria-hidden="true" size={11} className={bottleneck ? "text-rose-500" : "text-slate-400"} />
                        <span>{(stage.conversionFromPrev * 100).toFixed(1)}% converted</span>
                        <span className="text-slate-300">•</span>
                        <span>{(drop! * 100).toFixed(1)}% drop-off</span>
                        {bottleneck ? <span className="font-semibold text-rose-700">(bottleneck)</span> : null}
                      </div>
                    )}
                  </div>
                ) : null}
                <Link
                  href={`/leads?status=${encodeURIComponent(stage.status)}`}
                  aria-label={`View ${stage.label} leads`}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 flex min-h-12 items-center justify-between gap-3 rounded-xl px-4 text-white shadow-sm transition-all duration-200 hover:opacity-95 hover:shadow-md cursor-pointer"
                  style={{ width: `${width}%`, backgroundColor: stageColors[stage.status] ?? "#475569" }}
                >
                  <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                    <span className="truncate">{stage.label}</span>
                    {bottleneck ? <TriangleAlert aria-label="Bottleneck" className="shrink-0 text-amber-300" size={15} /> : null}
                  </span>
                  <span className="shrink-0 text-base font-bold">{stage.reached.toLocaleString("en-IN")}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </AnalyticsCard>
  );
}
