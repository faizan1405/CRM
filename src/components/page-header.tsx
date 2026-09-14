type PageHeaderProps = { title: string; description: string };

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="space-y-1.5">
      <h1 className="text-2xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-[1.75rem]">{title}</h1>
      <p className="max-w-2xl text-base leading-6 text-[var(--muted)]">{description}</p>
    </header>
  );
}
