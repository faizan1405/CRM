import type { LucideIcon } from "lucide-react";

type StatCardProps = { label: string; value: string; icon: LucideIcon };

export function StatCard({ label, value, icon: Icon }: StatCardProps) {
  return (
    <article className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-[var(--muted)]">{label}</p>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Icon aria-hidden="true" size={18} strokeWidth={1.9} /></span>
      </div>
      <p className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-[var(--muted)]">Awaiting CRM data</p>
    </article>
  );
}
