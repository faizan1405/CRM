import type { ReactNode } from "react";
import { BarChart3 } from "lucide-react";

export const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const compactNumber = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

export function AnalyticsCard({ title, description, action, children, className = "" }: { title: string; description: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-5 ${className}`}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div><h2 className="text-base font-semibold text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ChartEmpty({ label }: { label: string }) {
  return <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center"><div><BarChart3 aria-hidden="true" className="mx-auto mb-2 text-slate-300" size={28} /><p className="text-sm font-medium text-slate-700">No {label} yet</p><p className="mt-1 text-xs text-slate-500">Data will appear here when it becomes available.</p></div></div>;
}

export const stageColors: Record<string, string> = { NEW: "#2563eb", CONTACTED: "#0891b2", QUALIFIED: "#7c3aed", PROPOSAL_SENT: "#d97706", WON: "#16a34a", LOST: "#dc2626" };
