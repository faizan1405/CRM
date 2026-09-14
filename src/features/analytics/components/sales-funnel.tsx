import type { FunnelStage, DataCoverage } from "@/features/analytics/types";
import { Info, AlertTriangle } from "lucide-react";

/**
 * Stage color mapping matches CRM status semantics:
 *   New → blue | Contacted → cyan | Qualified → purple
 *   Proposal Sent → amber | Won → green
 */
const STAGE_COLORS: Record<string, { bar: string; text: string; bg: string; border: string }> = {
  NEW: {
    bar: "bg-blue-500",
    text: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  CONTACTED: {
    bar: "bg-cyan-500",
    text: "text-cyan-700",
    bg: "bg-cyan-50",
    border: "border-cyan-200",
  },
  QUALIFIED: {
    bar: "bg-purple-500",
    text: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
  },
  PROPOSAL_SENT: {
    bar: "bg-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  WON: {
    bar: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
};

const DEFAULT_COLORS = {
  bar: "bg-slate-400",
  text: "text-slate-600",
  bg: "bg-slate-50",
  border: "border-slate-200",
};

type Props = {
  stages: FunnelStage[];
  dataCoverage: DataCoverage;
};

export function SalesFunnel({ stages, dataCoverage }: Props) {
  const maxCount = Math.max(...stages.map((s) => s.reached), 1);
  const { funnelWarning, legacyLeadCount, activityHistoryCoverageStart } = dataCoverage;

  return (
    <section
      aria-label="Sales funnel"
      className="rounded-2xl border bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
    >
      <h2 className="text-base font-bold text-slate-900">Sales Funnel</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Stage-by-stage conversion — bottlenecks highlighted
      </p>

      {funnelWarning && (
        <div
          role="note"
          aria-label="Data completeness notice"
          className="mt-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700"
        >
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Historical stage tracking began{activityHistoryCoverageStart ? ` on ${new Date(activityHistoryCoverageStart).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}` : ""}.{" "}
            {legacyLeadCount > 0 && <><strong>{legacyLeadCount}</strong> legacy leads may have incomplete stage history. </>}
            Older funnel data may be incomplete.
          </span>
        </div>
      )}

      {stages.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-400">
          No funnel data for this period.
        </p>
      ) : (
        <ol className="mt-5 space-y-3" aria-label="Funnel stages">
          {stages.map((stage, idx) => {
            const colors = STAGE_COLORS[stage.status] ?? DEFAULT_COLORS;
            const widthPct = maxCount > 0 ? (stage.reached / maxCount) * 100 : 0;
            // conversionFromPrev is 0–1; threshold: drop-off > 40%
            const convPct = stage.conversionFromPrev !== null ? stage.conversionFromPrev * 100 : null;
            const dropOffPct = convPct !== null ? 100 - convPct : null;
            const isBottleneck = dropOffPct !== null && dropOffPct > 40;
            const isUnreliable = idx > 0 && stage.conversionFromPrev === null;

            return (
              <li key={stage.status}>
                {idx > 0 && (
                  <div
                    aria-hidden="true"
                    className="mb-2 flex items-center gap-2 pl-3"
                  >
                    <div className="h-4 w-px bg-slate-200" />
                    {isUnreliable ? (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                        <AlertTriangle size={10} aria-hidden="true" /> conversion data unreliable
                      </span>
                    ) : dropOffPct !== null ? (
                      <span
                        className={`text-[10px] font-semibold ${isBottleneck ? "text-red-500" : "text-slate-400"}`}
                      >
                        ↓{" "}
                        {isBottleneck
                          ? `⚠ ${dropOffPct.toFixed(0)}% drop-off`
                          : `${dropOffPct.toFixed(0)}% drop-off`}
                      </span>
                    ) : null}
                  </div>
                )}

                <div
                  className={`rounded-xl border p-3 ${colors.bg} ${colors.border} ${isBottleneck ? "ring-1 ring-red-300" : ""}`}
                  aria-label={`${stage.label}: ${stage.reached} leads${convPct !== null ? `, ${convPct.toFixed(1)}% conversion from previous stage` : " (conversion data unavailable)"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-sm font-semibold ${colors.text}`}>
                      {stage.label}
                    </span>
                    <div className="flex items-center gap-3 text-right">
                      <span
                        className={`text-lg font-bold ${colors.text}`}
                        aria-label={`${stage.reached} leads`}
                      >
                        {stage.reached}
                      </span>
                      {convPct !== null ? (
                        <span className="text-xs text-slate-500">
                          {convPct.toFixed(1)}% conv.
                        </span>
                      ) : idx > 0 ? (
                        <span className="text-xs text-slate-400 italic">—</span>
                      ) : null}
                    </div>
                  </div>
                  <div
                    className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/60"
                    aria-hidden="true"
                  >
                    <div
                      className={`h-full ${colors.bar} rounded-full transition-all duration-700`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="sr-only">
        Funnel summary:{" "}
        {stages
          .map(
            (s) =>
              `${s.label} ${s.reached} leads${s.conversionFromPrev !== null ? ` (${(s.conversionFromPrev * 100).toFixed(1)}% conversion)` : " (conversion data unavailable)"}`
          )
          .join("; ")}
      </p>
    </section>
  );
}
