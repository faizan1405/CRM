import { type ReactNode } from "react";

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`skeleton-shimmer ${className ?? ""}`} aria-hidden="true" />
  );
}

export function KPICardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24 rounded" />
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
      <div className="mt-4">
        <Skeleton className="h-8 w-16 rounded" />
      </div>
    </div>
  );
}

export function LeadCardSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-6 w-12 rounded-full" />
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        <Skeleton className="h-3 w-40 rounded" />
        <Skeleton className="h-3 w-28 rounded" />
      </div>
      <div className="mt-3 flex gap-3 border-t border-slate-100 pt-2">
        <Skeleton className="h-8 w-14 rounded" />
        <Skeleton className="h-8 w-14 rounded" />
        <Skeleton className="h-8 w-20 rounded" />
      </div>
    </div>
  );
}

export function ActivitySkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4 px-4 py-3 sm:px-6" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <Skeleton className="h-3.5 w-48 rounded" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PipelineColumnSkeleton() {
  return (
    <div className="w-80 shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <Skeleton className="h-6 w-20 rounded mb-3" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <LeadCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function NotificationSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <Skeleton className="h-3.5 w-56 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LeadDetailSkeleton() {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <Skeleton className="h-6 w-40 rounded" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-16 rounded mb-1" />
              <Skeleton className="h-4 w-28 rounded" />
            </div>
          ))}
        </div>
        <div className="border-t border-slate-100 pt-4">
          <Skeleton className="h-5 w-24 rounded mb-3" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex flex-col gap-1.5 flex-1">
                  <Skeleton className="h-3.5 w-44 rounded" />
                  <Skeleton className="h-3 w-32 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
