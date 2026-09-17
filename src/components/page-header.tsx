import type { ReactNode } from "react";

type PageHeaderProps = { title: string; description: string; actions?: ReactNode };

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1.5 hidden lg:block">
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-[1.75rem]">{title}</h1>
        <p className="max-w-2xl text-base leading-6 text-[var(--muted)]">{description}</p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
