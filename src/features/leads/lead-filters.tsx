import { Search, SlidersHorizontal, X } from "lucide-react";
import { leadStatuses, type LeadStatus } from "@/features/leads/types";

type LeadFiltersProps = {
  query: string;
  status: LeadStatus | "All";
  source: string;
  sources: string[];
  onQueryChange: (value: string) => void;
  onStatusChange: (value: LeadStatus | "All") => void;
  onSourceChange: (value: string) => void;
  onClear: () => void;
};

const controlClass = "h-11 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function LeadFilters({ query, status, source, sources, onQueryChange, onStatusChange, onSourceChange, onClear }: LeadFiltersProps) {
  const hasFilters = query.length > 0 || status !== "All" || source !== "All";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search leads</span>
          <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} type="search" placeholder="Search name, business, phone or email" className={`${controlClass} w-full pl-10 pr-3`} />
        </label>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <label className="min-w-0">
            <span className="sr-only">Filter by status</span>
            <select value={status} onChange={(event) => onStatusChange(event.target.value as LeadStatus | "All")} className={`${controlClass} w-full px-3 sm:w-44`}>
              <option value="All">All statuses</option>
              {leadStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="min-w-0">
            <span className="sr-only">Filter by lead source</span>
            <select value={source} onChange={(event) => onSourceChange(event.target.value)} className={`${controlClass} w-full px-3 sm:w-40`}>
              <option value="All">All sources</option>
              {sources.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        {hasFilters ? (
          <button type="button" onClick={onClear} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            <X aria-hidden="true" size={17} /> Clear
          </button>
        ) : (
          <span className="hidden h-11 items-center gap-2 px-3 text-sm text-slate-500 lg:flex"><SlidersHorizontal aria-hidden="true" size={17} /> Filters</span>
        )}
      </div>
    </div>
  );
}
