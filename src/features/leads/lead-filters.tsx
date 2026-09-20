import { ArrowDownUp, Clock, GitMerge, Search, SlidersHorizontal, Star, X } from "lucide-react";
import { leadStatuses, type LeadStatus } from "@/features/leads/types";
import { type LeadOperationalState } from "@/features/leads/types";

type LeadFiltersProps = {
  query: string;
  status: LeadStatus | "All";
  operationalFilter?: LeadOperationalState;
  pinnedOnly?: boolean;
  staleOnly?: boolean;
  duplicatesOnly?: boolean;
  sortBy?: "default" | "most_stale";
  onQueryChange: (value: string) => void;
  onStatusChange: (value: LeadStatus | "All") => void;
  onOperationalFilterChange?: (value: LeadOperationalState | undefined) => void;
  onPinnedOnlyChange?: (value: boolean) => void;
  onStaleOnlyChange?: (value: boolean) => void;
  onDuplicatesOnlyChange?: (value: boolean) => void;
  onSortByChange?: (value: "default" | "most_stale") => void;
  onClear: () => void;
};

const controlClass = "h-11 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const activeClasses: Record<LeadOperationalState, { bg: string; ring: string; text: string }> = {
  FOLLOW_UP_NOW: { bg: "bg-emerald-50", ring: "ring-emerald-200", text: "text-emerald-700" },
  FUTURE_FOLLOW_UP: { bg: "bg-amber-50", ring: "ring-amber-200", text: "text-amber-700" },
  LOST: { bg: "bg-rose-50", ring: "ring-rose-200", text: "text-rose-700" },
  WASTE: { bg: "bg-slate-100", ring: "ring-slate-300", text: "text-slate-600" },
  ACTIVE_NEUTRAL: { bg: "bg-slate-50", ring: "ring-slate-200", text: "text-slate-600" },
};

const operationalFilters: { value: LeadOperationalState; label: string; dot: string }[] = [
  { value: "FOLLOW_UP_NOW", label: "Follow Up Now", dot: "bg-emerald-500" },
  { value: "FUTURE_FOLLOW_UP", label: "Future Follow-up", dot: "bg-amber-500" },
  { value: "LOST", label: "Lost", dot: "bg-rose-500" },
  { value: "WASTE", label: "Waste", dot: "bg-slate-400" },
];

export function LeadFilters({
  query,
  status,
  operationalFilter,
  pinnedOnly = false,
  staleOnly = false,
  duplicatesOnly = false,
  sortBy = "default",
  onQueryChange,
  onStatusChange,
  onOperationalFilterChange,
  onPinnedOnlyChange,
  onStaleOnlyChange,
  onDuplicatesOnlyChange,
  onSortByChange,
  onClear,
}: LeadFiltersProps) {
  const hasFilters =
    query.length > 0 ||
    status !== "All" ||
    operationalFilter !== undefined ||
    pinnedOnly ||
    staleOnly ||
    duplicatesOnly ||
    sortBy === "most_stale";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search leads</span>
            <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => onQueryChange(event.target.value)} type="search" placeholder="Search name, business, phone or email" className={`${controlClass} w-full pl-10 pr-3`} />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <label className="min-w-0">
              <span className="sr-only">Filter by status</span>
              <select value={status} onChange={(event) => onStatusChange(event.target.value as LeadStatus | "All")} className={`${controlClass} w-full px-3 sm:w-44`}>
                <option value="All">All statuses</option>
                {leadStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            {hasFilters ? (
              <button type="button" onClick={onClear} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer">
                <X aria-hidden="true" size={17} /> Clear
              </button>
            ) : (
              <span className="hidden h-11 items-center gap-2 px-3 text-sm text-slate-500 lg:flex"><SlidersHorizontal aria-hidden="true" size={17} /> Filters</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Quick:</span>
          {onDuplicatesOnlyChange && (
            <button
              type="button"
              onClick={() => onDuplicatesOnlyChange(!duplicatesOnly)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors cursor-pointer ${
                duplicatesOnly
                  ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                  : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
              }`}
            >
              <GitMerge className={`size-3.5 ${duplicatesOnly ? "text-amber-700" : "text-slate-400"}`} />
              Possible Duplicates
            </button>
          )}
          {onPinnedOnlyChange && (
            <button
              type="button"
              onClick={() => onPinnedOnlyChange(!pinnedOnly)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors cursor-pointer ${
                pinnedOnly
                  ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                  : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
              }`}
            >
              <Star className={`size-3.5 ${pinnedOnly ? "fill-amber-500 text-amber-500" : "text-slate-400"}`} />
              Pinned only
            </button>
          )}
          {onStaleOnlyChange && (
            <button
              type="button"
              onClick={() => onStaleOnlyChange(!staleOnly)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors cursor-pointer ${
                staleOnly
                  ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                  : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
              }`}
            >
              <Clock className={`size-3.5 ${staleOnly ? "text-amber-700" : "text-slate-400"}`} />
              Stale Leads
            </button>
          )}
          {onSortByChange && (
            <button
              type="button"
              onClick={() => onSortByChange(sortBy === "most_stale" ? "default" : "most_stale")}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors cursor-pointer ${
                sortBy === "most_stale"
                  ? "bg-orange-100 text-orange-900 ring-1 ring-orange-300"
                  : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
              }`}
            >
              <ArrowDownUp className={`size-3.5 ${sortBy === "most_stale" ? "text-orange-700" : "text-slate-400"}`} />
              Most Stale First
            </button>
          )}
          {onOperationalFilterChange && operationalFilters.map(({ value, label, dot }) => {
            const isActive = operationalFilter === value;
            const active = activeClasses[value];
            return (
              <button
                key={value}
                type="button"
                onClick={() => onOperationalFilterChange(isActive ? undefined : value)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors cursor-pointer ${
                  isActive ? `${active.bg} ring-1 ${active.ring} ${active.text}` : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                }`}
              >
                <span className={`size-2 rounded-full ${dot}`} />
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
