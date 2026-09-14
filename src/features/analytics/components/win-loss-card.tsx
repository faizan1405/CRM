"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
};

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg"
    >
      <p className="text-xs font-semibold text-slate-500">{payload[0].name}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-900">
        {payload[0].value} deal{payload[0].value !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

type Props = {
  wonLeads: number;
  lostLeads: number;
  winRate: number; // 0–1 from Agent A
  lostRate?: number; // kept for Agent B; future use
};

export function WinLossCard({ wonLeads, lostLeads, winRate }: Props) {
  const total = wonLeads + lostLeads;
  const isEmpty = total === 0;
  const winRatePct = winRate * 100;

  const chartData = [
    { name: "Won", value: wonLeads, color: "#10b981" },
    { name: "Lost", value: lostLeads, color: "#f43f5e" },
  ];

  return (
    <section
      aria-label={`Win / loss breakdown: ${wonLeads} won, ${lostLeads} lost, ${winRatePct.toFixed(1)}% win rate`}
      className="rounded-2xl border bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
    >
      <h2 className="text-base font-bold text-slate-900">Win / Loss</h2>
      <p className="mt-0.5 text-xs text-slate-500">Closed deal outcomes</p>

      {isEmpty ? (
        <div className="mt-6 flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-400">No closed deals in this period</p>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-4">
          {/* Donut chart */}
          <div className="h-28 w-28 shrink-0" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="80%"
                  dataKey="value"
                  strokeWidth={2}
                  stroke="#fff"
                  startAngle={90}
                  endAngle={-270}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Stats */}
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
                <span className="text-sm font-medium text-emerald-800">Won</span>
              </div>
              <span className="text-lg font-bold text-emerald-700">{wonLeads}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-rose-100 bg-rose-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" aria-hidden="true" />
                <span className="text-sm font-medium text-rose-800">Lost</span>
              </div>
              <span className="text-lg font-bold text-rose-700">{lostLeads}</span>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-center">
              <p className="text-xs text-slate-500">Win Rate</p>
              <p
                className={`text-xl font-bold ${
                  winRatePct >= 30
                    ? "text-emerald-700"
                    : winRatePct >= 15
                    ? "text-amber-700"
                    : "text-red-600"
                }`}
              >
                {winRatePct.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      <p className="sr-only">
        Win/loss summary: {wonLeads} won, {lostLeads} lost out of {total} closed
        deals. Win rate: {winRatePct.toFixed(1)}%.
      </p>
    </section>
  );
}
