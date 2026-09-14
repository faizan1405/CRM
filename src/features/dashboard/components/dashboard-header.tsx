import { PlusCircle, CalendarPlus } from "lucide-react";
import Link from "next/link";

export function DashboardHeader() {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 p-6 sm:p-8 text-white shadow-md">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Good evening, Faizan 👋
        </h1>
        <p className="text-blue-100 max-w-xl text-sm sm:text-base">
          Here&apos;s what needs your attention today. Let&apos;s close some deals.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <Link
          href="/leads?new=true"
          className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-700 transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          Add Lead
        </Link>
        <Link
          href="/follow-ups?new=true"
          className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-blue-800/40 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-700 transition-colors backdrop-blur-sm border border-blue-400/30"
        >
          <CalendarPlus className="h-4 w-4" />
          Schedule Follow-up
        </Link>
        <Link
          href="/pipeline"
          className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-transparent px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-700 transition-colors"
        >
          Open Pipeline
        </Link>
      </div>
    </header>
  );
}
