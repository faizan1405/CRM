import type { PipelineStage } from "../types";
import { AnalyticsCard, currency, stageColors } from "./shared";

export function PipelineHealth({ stages }: { stages: PipelineStage[] }) {
  const max = Math.max(...stages.map((stage) => stage.value), 1);
  const total = stages.reduce((sum, stage) => sum + stage.value, 0);
  return <AnalyticsCard title="Pipeline health" description="Where active opportunity value is sitting right now.">
    {stages.length === 0 || stages.every((stage) => stage.count === 0) ? <div className="grid min-h-56 place-items-center rounded-xl bg-slate-50 text-center"><div><p className="font-medium text-slate-700">No open pipeline yet</p><p className="mt-1 text-sm text-slate-500">Active stages will appear here.</p></div></div> : <div className="space-y-4">
      {stages.map((stage) => <div key={stage.stage}><div className="mb-1.5 flex items-end justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{stage.label}</p><p className="text-xs text-slate-500">{stage.count} {stage.count === 1 ? "lead" : "leads"}</p></div><p className="text-sm font-semibold tabular-nums text-slate-900">{currency.format(stage.value)}</p></div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${(stage.value / max) * 100}%`, backgroundColor: stageColors[stage.stage] ?? "#475569" }} /></div></div>)}
      <div className="border-t border-slate-100 pt-3 text-right text-xs text-slate-500">Total open value <strong className="ml-1 text-slate-800">{currency.format(total)}</strong></div>
    </div>}
  </AnalyticsCard>;
}
