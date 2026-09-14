import type { PipelineStageHealth } from "@/features/analytics/types";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(val);

/** Map stage DB enum → CRM semantic color */
const STAGE_COLORS: Record<string, { bar: string; text: string }> = {
  NEW: { bar: "bg-blue-500", text: "text-blue-700" },
  CONTACTED: { bar: "bg-cyan-500", text: "text-cyan-700" },
  QUALIFIED: { bar: "bg-purple-500", text: "text-purple-700" },
  PROPOSAL_SENT: { bar: "bg-amber-500", text: "text-amber-700" },
  WON: { bar: "bg-emerald-500", text: "text-emerald-700" },
  LOST: { bar: "bg-rose-400", text: "text-rose-600" },
};

const DEFAULT_COLORS = { bar: "bg-slate-400", text: "text-slate-600" };

// Only show active-pipeline stages (exclude WON/LOST which are not "open pipeline")
const OPEN_STAGES = new Set(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT"]);

type Props = { data: PipelineStageHealth[] };

export function PipelineHealth({ data }: Props) {
  // Filter to open stages only — WON/LOST are not part of the current pipeline health
  const openStages = data.filter((s) => OPEN_STAGES.has(s.stage));
  const maxCount = Math.max(...openStages.map((s) => s.count), 1);
  const totalValue = openStages.reduce((sum, s) => sum + s.value, 0);

  return (
    <section
      aria-label="Pipeline health by stage"
      className="rounded-2xl border bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">Pipeline Health</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Where is your open pipeline sitting?
          </p>
        </div>
        {totalValue > 0 && (
          <span
            className="rounded-lg bg-purple-50 px-2.5 py-1 text-sm font-semibold text-purple-700"
            aria-label={`Total open pipeline value: ${formatCurrency(totalValue)}`}
          >
            {formatCurrency(totalValue)}
          </span>
        )}
      </div>

      {openStages.length === 0 || openStages.every((s) => s.count === 0) ? (
        <div className="mt-6 flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-400">No open pipeline</p>
        </div>
      ) : (
        <ol className="mt-4 space-y-2.5" aria-label="Pipeline stages">
          {openStages.map((stage) => {
            const colors = STAGE_COLORS[stage.stage] ?? DEFAULT_COLORS;
            const widthPct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;

            return (
              <li
                key={stage.stage}
                className="flex items-center gap-3"
                aria-label={`${stage.label}: ${stage.count} leads, ${formatCurrency(stage.value)} value`}
              >
                <span
                  className={`w-24 shrink-0 truncate text-xs font-semibold ${colors.text}`}
                >
                  {stage.label}
                </span>
                <div className="flex-1 overflow-hidden">
                  <div
                    className="flex h-6 items-center overflow-hidden rounded-md bg-slate-100"
                    aria-hidden="true"
                  >
                    <div
                      className={`h-full ${colors.bar} rounded-md transition-all duration-700`}
                      style={{ width: `${widthPct}%`, minWidth: stage.count > 0 ? "8px" : "0" }}
                    />
                  </div>
                </div>
                <div className="flex w-28 shrink-0 items-center justify-end gap-3 text-right">
                  <span className={`text-sm font-bold ${colors.text}`}>
                    {stage.count}
                  </span>
                  <span className="text-xs text-slate-400">
                    {stage.value > 0 ? formatCurrency(stage.value) : "—"}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="sr-only">
        Pipeline health:{" "}
        {openStages
          .map(
            (s) =>
              `${s.label}: ${s.count} leads worth ${formatCurrency(s.value)}`
          )
          .join("; ")}
      </p>
    </section>
  );
}
