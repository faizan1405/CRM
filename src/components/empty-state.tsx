import type { LucideIcon } from "lucide-react";

type EmptyStateProps = { title: string; description: string; icon: LucideIcon };

export function EmptyState({ title, description, icon: Icon }: EmptyStateProps) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-[var(--surface-muted)] px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm"><Icon aria-hidden="true" size={20} strokeWidth={1.8} /></span>
      <p className="mt-4 text-base font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-[var(--muted)]">{description}</p>
    </div>
  );
}
