import { Check, Clock3, ListPlus, TriangleAlert } from "lucide-react";
import type { FollowUpPerformanceData } from "../types";
import { AnalyticsCard } from "./shared";

const typeLabels: Record<string, string> = { CALL: "Call", WHATSAPP: "WhatsApp", EMAIL: "Email", OTHER: "Other" };

export function FollowUpPerformance({ data }: { data: FollowUpPerformanceData }) {
  const metrics = [
    { label: "Created", value: data.created, icon: ListPlus, tone: "text-blue-700 bg-blue-50" },
    { label: "Completed", value: data.completed, icon: Check, tone: "text-green-700 bg-green-50" },
    { label: "Pending", value: data.pending, icon: Clock3, tone: "text-amber-700 bg-amber-50" },
    { label: "Overdue", value: data.overdue, icon: TriangleAlert, tone: "text-red-700 bg-red-50" },
  ];
  return <AnalyticsCard title="Follow-up performance" description="Execution discipline across follow-up activity." className="xl:col-span-2" action={<span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">{(data.completionRate * 100).toFixed(1)}% complete</span>}>
    {data.created === 0 ? <div className="grid min-h-48 place-items-center rounded-xl bg-slate-50 text-center"><div><p className="font-medium text-slate-700">No follow-ups in this period</p><p className="mt-1 text-sm text-slate-500">Created and completed activity will appear here.</p></div></div> : <div className="grid gap-6 lg:grid-cols-[1fr_1.25fr]">
      <dl className="grid grid-cols-2 gap-3">{metrics.map(({ label, value, icon: Icon, tone }) => <div key={label} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"><dt className="flex items-center gap-2 text-xs font-medium text-slate-500"><span className={`grid size-7 place-items-center rounded-lg ${tone}`}><Icon aria-hidden="true" size={14} /></span>{label}</dt><dd className="mt-2 text-2xl font-bold text-slate-950">{value}</dd></div>)}</dl>
      <div><h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">By follow-up type</h3><div className="space-y-3">{data.byType.map((row) => { const rate = row.total ? row.completed / row.total : 0; return <div key={row.type}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="font-medium text-slate-700">{typeLabels[row.type] ?? row.type}</span><span className="text-slate-500">{row.completed}/{row.total} completed</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${rate * 100}%` }} /></div></div>; })}</div></div>
    </div>}
  </AnalyticsCard>;
}
