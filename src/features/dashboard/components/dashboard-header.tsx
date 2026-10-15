import { Plus, CalendarClock, KanbanSquare } from "lucide-react";
import Link from "next/link";

export function DashboardHeader() {
  return (
    <header className="relative overflow-hidden flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 p-6 sm:p-7 text-white shadow-lg shadow-blue-900/10 border border-white/10">
      <div className="absolute -right-8 -top-8 size-48 rounded-full bg-white/5 blur-2xl pointer-events-none" />
      <div className="absolute right-1/3 -bottom-10 size-40 rounded-full bg-blue-400/10 blur-xl pointer-events-none" />

      <div className="relative z-10 space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-white">
          Good evening, Faizan 👋
        </h1>
        <p className="text-blue-100/90 max-w-xl text-sm sm:text-base leading-relaxed">
          Here&apos;s what needs your attention today. Let&apos;s close some deals.
        </p>
      </div>

      <div className="relative z-10 flex shrink-0 flex-wrap items-center gap-2.5">
        <Link
          href="/leads?new=true"
          className="inline-flex h-9.5 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-white px-4 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-all cursor-pointer"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          <span>Add Lead</span>
        </Link>
        <Link
          href="/follow-ups?new=true"
          className="inline-flex h-9.5 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-white/10 px-4 text-sm font-semibold text-white shadow-sm hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white backdrop-blur-sm border border-white/20 transition-all cursor-pointer"
        >
          <CalendarClock className="size-4" />
          <span>Schedule Follow-up</span>
        </Link>
        <Link
          href="/pipeline"
          className="inline-flex h-9.5 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-white/5 px-3.5 text-sm font-semibold text-white/90 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-all cursor-pointer"
        >
          <KanbanSquare className="size-4" />
          <span>Open Pipeline</span>
        </Link>
      </div>
    </header>
  );
}
