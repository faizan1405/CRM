import { ArrowDown, TriangleAlert } from "lucide-react";
import type { FunnelStage } from "../types";
import { AnalyticsCard, stageColors } from "./shared";

export function SalesFunnel({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(...stages.map((stage) => stage.reached), 0);
  return (
    <AnalyticsCard title="Sales funnel" description="Conversion through each stage — watch for steep drop-offs." className="xl:col-span-2">
      {stages.length === 0 || max === 0 ? <div className="grid min-h-64 place-items-center rounded-xl bg-slate-50 text-center"><div><p className="font-medium text-slate-700">No funnel activity yet</p><p className="mt-1 text-sm text-slate-500">Stage movement will appear as leads progress.</p></div></div> : (
        <ol className="space-y-2" aria-label="Lead stage funnel">
          {stages.map((stage, index) => {
            const width = Math.max(44, (stage.reached / max) * 100);
            const drop = stage.conversionFromPrev === null ? null : Math.max(0, 1 - stage.conversionFromPrev);
            const bottleneck = drop !== null && drop >= 0.4;
            return <li key={stage.status}>
              {index > 0 ? <div className="flex h-8 items-center justify-center gap-2 text-xs text-slate-500">
                <ArrowDown aria-hidden="true" size={14} />
                {stage.conversionFromPrev === null ? <span>Conversion unavailable</span> : <span className={bottleneck ? "font-semibold text-red-700" : ""}>{(stage.conversionFromPrev * 100).toFixed(1)}% converted · {(drop! * 100).toFixed(1)}% drop-off {bottleneck ? "— bottleneck" : ""}</span>}
              </div> : null}
              <div className="mx-auto flex min-h-14 items-center justify-between gap-3 rounded-xl px-4 text-white shadow-sm transition-[width]" style={{ width: `${width}%`, backgroundColor: stageColors[stage.status] ?? "#475569" }}>
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold"><span className="truncate">{stage.label}</span>{bottleneck ? <TriangleAlert aria-label="Bottleneck" className="shrink-0" size={15} /> : null}</span>
                <span className="shrink-0 text-lg font-bold">{stage.reached.toLocaleString("en-IN")}</span>
              </div>
            </li>;
          })}
        </ol>
      )}
    </AnalyticsCard>
  );
}
