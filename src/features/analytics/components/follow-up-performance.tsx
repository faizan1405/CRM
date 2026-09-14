import type { FollowUpPerformanceData } from "@/features/analytics/types";
import { CheckCircle2, Clock, AlertCircle, Plus } from "lucide-react";

type StatPillProps = {
  label: string;
  value: number;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
};

function StatPill({ label, value, icon: Icon, colorClass, bgClass }: StatPillProps) {
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-xl border p-3 ${bgClass}`}
      aria-label={`${label}: ${value}`}
    >
      <Icon size={16} className={colorClass} aria-hidden="true" />
      <span className={`text-lg font-bold ${colorClass}`}>{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
    </div>
  );
}

type Props = { data: FollowUpPerformanceData };

export function FollowUpPerformance({ data }: Props) {
  const TYPE_ICONS: Record<string, string> = {
    Call: "📞",
    WhatsApp: "💬",
    Email: "✉️",
    Other: "📋",
  };

  return (
    <section
      aria-label="Follow-up performance"
      className="rounded-2xl border bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Follow-up Performance
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">Discipline &amp; completion metrics</p>
        </div>
        <div
          className="flex flex-col items-end"
          aria-label={`Completion rate: ${data.completionRate.toFixed(1)}%`}
        >
          <span
            className={`text-xl font-bold ${
              data.completionRate >= 70
                ? "text-emerald-700"
                : data.completionRate >= 40
                ? "text-amber-700"
                : "text-red-600"
            }`}
          >
            {data.completionRate.toFixed(1)}%
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Completion
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100"
        aria-hidden="true"
      >
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            data.completionRate >= 70
              ? "bg-emerald-500"
              : data.completionRate >= 40
              ? "bg-amber-500"
              : "bg-red-500"
          }`}
          style={{ width: `${Math.min(data.completionRate, 100)}%` }}
        />
      </div>

      {/* Stat pills */}
      <div className="mt-4 grid grid-cols-4 gap-2" role="list" aria-label="Follow-up statistics">
        <StatPill
          label="Created"
          value={data.created}
          icon={Plus}
          colorClass="text-blue-600"
          bgClass="bg-blue-50 border-blue-100"
        />
        <StatPill
          label="Completed"
          value={data.completed}
          icon={CheckCircle2}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-50 border-emerald-100"
        />
        <StatPill
          label="Pending"
          value={data.pending}
          icon={Clock}
          colorClass="text-amber-600"
          bgClass="bg-amber-50 border-amber-100"
        />
        <StatPill
          label="Overdue"
          value={data.overdue}
          icon={AlertCircle}
          colorClass={data.overdue > 0 ? "text-red-600" : "text-slate-400"}
          bgClass={data.overdue > 0 ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100"}
        />
      </div>

      {/* Type breakdown */}
      {data.byType.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            By Type
          </p>
          <div className="space-y-2">
            {data.byType.map((row) => {
              const completionPct =
                row.created > 0
                  ? Math.round((row.completed / row.created) * 100)
                  : 0;
              const icon = TYPE_ICONS[row.type] ?? "📋";
              return (
                <div
                  key={row.type}
                  className="flex items-center gap-3"
                  aria-label={`${row.type}: ${row.created} created, ${row.completed} completed, ${row.pending} pending, ${row.overdue} overdue`}
                >
                  <span className="w-5 text-center text-sm" aria-hidden="true">
                    {icon}
                  </span>
                  <span className="w-20 shrink-0 text-xs font-medium text-slate-600">
                    {row.type}
                  </span>
                  <div className="flex-1 overflow-hidden">
                    <div
                      className="flex h-4 overflow-hidden rounded bg-slate-100"
                      aria-hidden="true"
                    >
                      <div
                        className="h-full bg-emerald-400 transition-all duration-700"
                        style={{ width: `${completionPct}%` }}
                        title={`${completionPct}% completed`}
                      />
                    </div>
                  </div>
                  <div className="flex w-28 shrink-0 justify-end gap-3 text-right text-xs text-slate-500">
                    <span>{row.created} created</span>
                    {row.overdue > 0 && (
                      <span className="text-red-500">{row.overdue} overdue</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="sr-only">
        Follow-up summary: {data.created} created, {data.completed} completed,{" "}
        {data.pending} pending, {data.overdue} overdue.{" "}
        {data.completionRate.toFixed(1)}% completion rate.
      </p>
    </section>
  );
}
