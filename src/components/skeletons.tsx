import React from "react";

export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`skeleton-shimmer shrink-0 ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export function PageHeaderSkeleton({ hasAction = true }: { hasAction?: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-1" aria-hidden="true">
      <div className="space-y-1.5">
        <Skeleton className="h-7 sm:h-8 w-36 sm:w-48 rounded-lg" />
        <Skeleton className="h-4 w-56 sm:w-80 rounded" />
      </div>
      {hasAction && (
        <Skeleton className="h-11 w-full sm:w-32 rounded-xl" />
      )}
    </div>
  );
}

export function KPICardSkeleton() {
  return (
    <div
      className="relative flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3.5 w-20 sm:w-24 rounded" />
        <Skeleton className="size-8 sm:size-9 rounded-xl" />
      </div>
      <div className="mt-3 sm:mt-4 space-y-1.5">
        <Skeleton className="h-6 sm:h-7 w-16 sm:w-20 rounded" />
        <Skeleton className="h-3 w-24 rounded" />
      </div>
    </div>
  );
}

export function KPICardsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      aria-hidden="true"
      className="flex w-full flex-row flex-nowrap items-stretch gap-3 overflow-x-auto pb-2.5 pt-1 overscroll-x-contain [scrollbar-width:thin] rounded-2xl lg:grid lg:grid-cols-6 lg:gap-4 lg:overflow-x-visible lg:pb-0"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="min-w-[150px] max-w-[200px] flex-1 shrink-0 snap-start lg:min-w-0 lg:max-w-none lg:shrink">
          <KPICardSkeleton />
        </div>
      ))}
    </div>
  );
}

export function ActivitySkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col divide-y divide-slate-100" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <Skeleton className="h-3.5 w-44 sm:w-56 rounded" />
            <Skeleton className="h-3 w-28 sm:w-36 rounded" />
          </div>
          <Skeleton className="h-3 w-16 rounded shrink-0 ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function LeadCardSkeleton() {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-sm space-y-3"
      aria-hidden="true"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1.5 flex-1 min-w-0">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="size-6 rounded" />
        </div>
      </div>

      <div className="space-y-1.5 border-t border-slate-100 pt-2.5">
        <Skeleton className="h-3 w-36 rounded" />
        <Skeleton className="h-3 w-28 rounded" />
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
        <Skeleton className="h-5 w-24 rounded-md" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="size-8 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function LeadTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="hidden lg:block overflow-x-auto" aria-hidden="true">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/75 text-xs text-slate-500">
            <th className="py-3 px-4 w-12"><Skeleton className="size-4 rounded" /></th>
            <th className="py-3 px-4"><Skeleton className="h-3.5 w-24 rounded" /></th>
            <th className="py-3 px-4"><Skeleton className="h-3.5 w-16 rounded" /></th>
            <th className="py-3 px-4"><Skeleton className="h-3.5 w-28 rounded" /></th>
            <th className="py-3 px-4"><Skeleton className="h-3.5 w-28 rounded" /></th>
            <th className="py-3 px-4"><Skeleton className="h-3.5 w-20 rounded" /></th>
            <th className="py-3 px-4 text-right"><Skeleton className="h-3.5 w-16 rounded ml-auto" /></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="hover:bg-slate-50/50">
              <td className="py-3.5 px-4"><Skeleton className="size-4 rounded" /></td>
              <td className="py-3.5 px-4">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
              </td>
              <td className="py-3.5 px-4"><Skeleton className="h-5 w-20 rounded-full" /></td>
              <td className="py-3.5 px-4">
                <div className="space-y-1">
                  <Skeleton className="h-3.5 w-28 rounded" />
                  <Skeleton className="h-3 w-36 rounded" />
                </div>
              </td>
              <td className="py-3.5 px-4"><Skeleton className="h-4 w-24 rounded" /></td>
              <td className="py-3.5 px-4"><Skeleton className="h-4 w-16 rounded" /></td>
              <td className="py-3.5 px-4 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <Skeleton className="size-7 rounded-lg" />
                  <Skeleton className="size-7 rounded-lg" />
                  <Skeleton className="size-7 rounded-lg" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FollowUpCardSkeleton() {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-sm space-y-3"
      aria-hidden="true"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 flex-1 min-w-0">
          <Skeleton className="h-4 w-36 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      </div>

      <div className="rounded-lg bg-slate-50 p-2.5 space-y-1.5 border border-slate-100">
        <div className="flex items-center gap-2">
          <Skeleton className="size-3.5 rounded-full" />
          <Skeleton className="h-3 w-32 rounded" />
        </div>
        <Skeleton className="h-3 w-48 rounded" />
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
        <Skeleton className="h-7 w-20 rounded-lg" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-7 w-16 rounded-lg" />
          <Skeleton className="h-7 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function PipelineCardSkeleton() {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs space-y-2.5 cursor-default"
      aria-hidden="true"
    >
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-28 rounded" />
        <Skeleton className="size-4 rounded" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-3 w-36 rounded" />
        <Skeleton className="h-3 w-24 rounded" />
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
        <Skeleton className="h-4 w-16 rounded-md" />
        <Skeleton className="h-3 w-14 rounded" />
      </div>
    </div>
  );
}

export function PipelineColumnSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div
      className="w-[85vw] sm:w-[18rem] lg:w-80 shrink-0 flex flex-col rounded-xl border border-slate-200 bg-slate-50 sm:snap-center"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between p-3 border-b border-slate-200/80 bg-slate-100/70 rounded-t-xl">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-5 w-6 rounded-full" />
        </div>
        <Skeleton className="h-3.5 w-14 rounded" />
      </div>
      <div className="flex-1 p-3 space-y-3 min-h-[220px]">
        {Array.from({ length: count }).map((_, i) => (
          <PipelineCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function NoteCardSkeleton() {
  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
      aria-hidden="true"
    >
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-36 rounded" />
        <Skeleton className="size-4 rounded" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-4/5 rounded" />
        <Skeleton className="h-3 w-2/3 rounded" />
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        <Skeleton className="h-3 w-20 rounded" />
        <div className="flex items-center gap-2">
          <Skeleton className="size-5 rounded" />
          <Skeleton className="size-5 rounded" />
        </div>
      </div>
    </div>
  );
}

export function LeadDetailSkeleton() {
  return (
    <div className="flex h-full flex-col bg-white" aria-hidden="true">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <div className="space-y-1">
          <Skeleton className="h-6 w-40 rounded" />
          <Skeleton className="h-3.5 w-24 rounded" />
        </div>
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-4 w-28 rounded" />
            </div>
          ))}
        </div>
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <Skeleton className="h-5 w-24 rounded" />
          <ActivitySkeleton count={3} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   FULL-PAGE SKELETON STATES (FOR APP ROUTER LOADING.TSX)
   ───────────────────────────────────────────────────────────── */

export function DashboardSkeleton({ includeHeader = true }: { includeHeader?: boolean } = {}) {
  return (
    <div className="space-y-4 sm:space-y-6 pb-12" aria-busy="true" aria-label="Loading dashboard">
      {/* Header */}
      {includeHeader && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-1" aria-hidden="true">
          <div className="space-y-1.5">
            <Skeleton className="h-7 sm:h-8 w-44 rounded-lg" />
            <Skeleton className="h-4 w-64 sm:w-80 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <KPICardsGridSkeleton count={6} />

      {/* 3 Follow-up / Shortcut Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-5 w-36 mb-2 rounded" />
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
              <Skeleton className="size-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5 min-w-0">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-3 w-44 rounded" />
              </div>
              <Skeleton className="size-5 rounded shrink-0 ml-auto" />
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div aria-hidden="true">
        <Skeleton className="h-5 w-36 mb-2 rounded" />
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <ActivitySkeleton count={5} />
        </div>
      </div>

      {/* Pipeline & Revenue Summaries */}
      <div className="grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-2" aria-hidden="true">
        <div>
          <Skeleton className="h-5 w-36 mb-2 rounded" />
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-20 rounded" />
                    <Skeleton className="h-3 w-12 rounded" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <Skeleton className="h-5 w-36 mb-2 rounded" />
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg bg-slate-50 p-3 space-y-1 border border-slate-100">
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-6 w-24 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LeadsSkeleton({ includeHeader = true }: { includeHeader?: boolean } = {}) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading leads">
      {/* Header */}
      {includeHeader && <PageHeaderSkeleton />}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto" aria-hidden="true">
        <Skeleton className="h-10 w-28 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-hidden="true">
        <Skeleton className="h-11 w-full sm:w-80 rounded-xl" />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-20 rounded-lg" />
        </div>
      </div>

      {/* Records container */}
      <section
        aria-label="Loading leads list"
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5 sm:px-5" aria-hidden="true">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-3 w-32 rounded" />
        </div>

        {/* Desktop Table */}
        <LeadTableSkeleton rows={7} />

        {/* Mobile Cards */}
        <div className="flex flex-col gap-2 p-2 sm:grid sm:grid-cols-2 sm:gap-3 sm:p-4 lg:hidden" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <LeadCardSkeleton key={i} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function PipelineSkeleton({ includeHeader = true }: { includeHeader?: boolean } = {}) {
  return (
    <div className="flex w-full min-w-0 flex-col space-y-6" aria-busy="true" aria-label="Loading pipeline">
      {includeHeader && (
        <div className="shrink-0">
          <PageHeaderSkeleton hasAction={false} />
        </div>
      )}

      {/* Desktop Analytics Preview */}
      <div className="hidden sm:flex shrink-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 gap-6" aria-hidden="true">
        <Skeleton className="size-28 rounded-full shrink-0 self-center" />
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg bg-slate-50 p-2.5 space-y-1.5 border border-slate-100">
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-5 w-12 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Analytics Placeholder */}
      <div className="sm:hidden rounded-xl border border-slate-200 bg-white p-3.5" aria-hidden="true">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="size-4 rounded" />
        </div>
      </div>

      {/* Horizontal Pipeline Columns */}
      <div
        className="w-full min-h-0 min-w-0 flex-1 overflow-x-auto overscroll-x-contain touch-pan-x touch-pan-y custom-scrollbar"
        aria-hidden="true"
      >
        <div className="flex min-h-[480px] w-max min-w-full items-stretch gap-4 pb-6 sm:pb-4 px-4 sm:px-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <PipelineColumnSkeleton key={i} count={i % 2 === 0 ? 3 : 2} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function FollowUpsSkeleton({ includeHeader = true }: { includeHeader?: boolean } = {}) {
  return (
    <div className="flex h-full flex-col overflow-hidden pb-4 space-y-6" aria-busy="true" aria-label="Loading follow-ups">
      {includeHeader && <PageHeaderSkeleton />}

      {/* Tab navigation */}
      <div className="border-b border-slate-200 pb-1 flex gap-4 overflow-x-auto" aria-hidden="true">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      {/* Follow-up card list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <FollowUpCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function DealsSkeleton({ includeHeader = true }: { includeHeader?: boolean } = {}) {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16" aria-busy="true" aria-label="Loading deals and payments">
      {/* Header */}
      {includeHeader && <PageHeaderSkeleton />}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1 overflow-x-auto" aria-hidden="true">
        <Skeleton className="h-9 w-28 rounded-xl" />
        <Skeleton className="h-9 w-32 rounded-xl" />
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>

      {/* 5 Financial KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2 ${
              i === 2 ? "col-span-2 sm:col-span-1" : ""
            }`}
          >
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-7 w-28 rounded" />
            <Skeleton className="h-2.5 w-36 rounded" />
          </div>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-hidden="true">
        <Skeleton className="h-10 w-full sm:w-72 rounded-xl" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      </div>

      {/* Deals list representation */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden" aria-hidden="true">
        <div className="hidden lg:block">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-xs text-slate-500">
                <th className="py-3 px-4"><Skeleton className="h-3.5 w-24 rounded" /></th>
                <th className="py-3 px-4"><Skeleton className="h-3.5 w-20 rounded" /></th>
                <th className="py-3 px-4"><Skeleton className="h-3.5 w-20 rounded" /></th>
                <th className="py-3 px-4"><Skeleton className="h-3.5 w-24 rounded" /></th>
                <th className="py-3 px-4"><Skeleton className="h-3.5 w-20 rounded" /></th>
                <th className="py-3 px-4 text-right"><Skeleton className="h-3.5 w-16 rounded ml-auto" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="py-4 px-4">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-36 rounded" />
                      <Skeleton className="h-3 w-20 rounded" />
                    </div>
                  </td>
                  <td className="py-4 px-4"><Skeleton className="h-4 w-24 rounded" /></td>
                  <td className="py-4 px-4"><Skeleton className="h-4 w-20 rounded" /></td>
                  <td className="py-4 px-4"><Skeleton className="h-5 w-24 rounded-full" /></td>
                  <td className="py-4 px-4"><Skeleton className="h-4 w-24 rounded" /></td>
                  <td className="py-4 px-4 text-right">
                    <Skeleton className="h-8 w-24 rounded-lg ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden p-3 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-3.5 space-y-2.5">
              <div className="flex justify-between items-start">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
              <Skeleton className="h-8 w-full rounded-lg mt-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AnalyticsSkeleton({ includeHeader = true }: { includeHeader?: boolean } = {}) {
  return (
    <div className="space-y-5 pb-10 sm:space-y-6" aria-busy="true" aria-label="Loading analytics">
      {/* Header */}
      {includeHeader && (
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between pb-1" aria-hidden="true">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-32 rounded" />
            <Skeleton className="h-7 sm:h-8 w-48 rounded-lg" />
            <Skeleton className="h-4 w-72 sm:w-96 rounded" />
          </div>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-14 rounded-lg" />
            ))}
          </div>
        </header>
      )}

      {/* 6 Analytics KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>

      {/* Sales Funnel + Win/Loss Cards */}
      <div className="grid min-w-0 gap-5 xl:grid-cols-3" aria-hidden="true">
        {/* Sales Funnel (col-span-2) */}
        <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-5 w-32 rounded" />
            <Skeleton className="h-4 w-20 rounded" />
          </div>
          <div className="space-y-3.5 pt-2">
            {[90, 75, 55, 40, 25, 18].map((widthPercent, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-24 rounded" />
                  <Skeleton className="h-3 w-12 rounded" />
                </div>
                <div className="h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center px-1">
                  <Skeleton className="h-5 rounded-md" style={{ width: `${widthPercent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Win vs Lost (col-span-1) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <Skeleton className="h-5 w-28 rounded" />
          <div className="flex justify-center py-4">
            <Skeleton className="size-36 rounded-full" />
          </div>
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex justify-between">
              <Skeleton className="h-3.5 w-20 rounded" />
              <Skeleton className="h-3.5 w-16 rounded" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-3.5 w-20 rounded" />
              <Skeleton className="h-3.5 w-16 rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Lost Reasons Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4" aria-hidden="true">
        <Skeleton className="h-5 w-40 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-3.5 w-32 rounded" />
                <Skeleton className="h-3.5 w-10 rounded" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Trends Grid */}
      <div className="grid min-w-0 gap-5 xl:grid-cols-3" aria-hidden="true">
        <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <Skeleton className="h-5 w-36 rounded" />
          <div className="h-48 rounded-xl bg-slate-50/80 border border-slate-100 flex items-end p-4 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton
                key={i}
                className="flex-1 rounded-t-md"
                style={{ height: `${25 + (i * 11) % 70}%` }}
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <Skeleton className="h-5 w-28 rounded" />
          <div className="h-48 rounded-xl bg-slate-50/80 border border-slate-100 flex items-end p-4 gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton
                key={i}
                className="flex-1 rounded-t-md"
                style={{ height: `${30 + (i * 14) % 65}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PersonalNotesSkeleton({ includeHeader = true }: { includeHeader?: boolean } = {}) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-16" aria-busy="true" aria-label="Loading personal notes">
      {/* Header */}
      {includeHeader && <PageHeaderSkeleton />}

      {/* Search Input Bar */}
      <div aria-hidden="true">
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>

      {/* Quick Note Box Placeholder */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3" aria-hidden="true">
        <Skeleton className="h-16 w-full rounded-lg" />
        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <NoteCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
