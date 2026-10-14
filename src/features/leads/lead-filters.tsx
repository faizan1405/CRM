import { ArrowDownUp, Clock, GitMerge, Search, SlidersHorizontal, Star, X } from "lucide-react";
import { leadStatuses, type LeadSortOption, type LeadStatus } from "@/features/leads/types";
import { type LeadOperationalState } from "@/features/leads/types";
import { cn } from "@/lib/utils";

type LeadFiltersProps = {
  query: string;
  status: LeadStatus | "All";
  operationalFilter?: LeadOperationalState;
  pinnedOnly?: boolean;
  staleOnly?: boolean;
  duplicatesOnly?: boolean;
  sortBy?: LeadSortOption;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: LeadStatus | "All") => void;
  onOperationalFilterChange?: (value: LeadOperationalState | undefined) => void;
  onPinnedOnlyChange?: (value: boolean) => void;
  onStaleOnlyChange?: (value: boolean) => void;
  onDuplicatesOnlyChange?: (value: boolean) => void;
  onSortByChange?: (value: LeadSortOption) => void;
  onClear: () => void;
};

// Mobile viewport zoom prevention:
// text-base text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:text-sm
const controlClass =
  "h-9 rounded-lg bg-card text-[13.5px] text-foreground shadow-[inset_0_0_0_1px_var(--input)] outline-none transition-[box-shadow] duration-150 placeholder:text-subtle hover:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_20%,var(--input))] focus:shadow-[inset_0_0_0_1px_var(--ring),0_0_0_3px_color-mix(in_oklab,var(--ring)_15%,transparent)]";

const operationalFilters: { value: LeadOperationalState; label: string; dot: string }[] = [
  { value: "FOLLOW_UP_NOW", label: "Follow Up Now", dot: "bg-primary" },
  { value: "FUTURE_FOLLOW_UP", label: "Future Follow-up", dot: "bg-warning" },
  { value: "LOST", label: "Lost", dot: "bg-destructive" },
  { value: "WASTE", label: "Waste", dot: "bg-subtle" },
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
    (sortBy !== "default" && sortBy !== undefined);

  return (
    <div className="card-surface p-3.5 sm:p-4 mb-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
            />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              type="search"
              placeholder="Search name, business, phone or email"
              className={cn(controlClass, "w-full pl-9 pr-8")}
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 grid h-5 w-5 place-items-center text-subtle hover:text-foreground"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={status}
              onChange={(event) => onStatusChange(event.target.value as LeadStatus | "All")}
              className={cn(controlClass, "px-3 sm:w-40")}
              aria-label="Filter by status"
            >
              <option value="All">All statuses</option>
              {leadStatuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            {onSortByChange && (
              <select
                value={sortBy}
                onChange={(event) => onSortByChange(event.target.value as LeadSortOption)}
                className={cn(controlClass, "px-3 sm:w-44")}
                aria-label="Sort leads"
                data-testid="leads-sort-select"
              >
                <option value="default">Sort: Default</option>
                <option value="name_asc">Name A &rarr; Z</option>
                <option value="name_desc">Name Z &rarr; A</option>
                <option value="most_stale">Most Stale First</option>
              </select>
            )}

            {hasFilters && (
              <button
                type="button"
                onClick={onClear}
                className="press inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <X size={14} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="eyebrow mr-1">Quick:</span>
          {onDuplicatesOnlyChange && (
            <button
              type="button"
              onClick={() => onDuplicatesOnlyChange(!duplicatesOnly)}
              className={cn(
                "press inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-colors cursor-pointer",
                duplicatesOnly
                  ? "bg-warning-soft text-warning ring-1 ring-warning/30"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <GitMerge className="size-3" />
              <span>Possible Duplicates</span>
            </button>
          )}

          {onPinnedOnlyChange && (
            <button
              type="button"
              onClick={() => onPinnedOnlyChange(!pinnedOnly)}
              className={cn(
                "press inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-colors cursor-pointer",
                pinnedOnly
                  ? "bg-warning-soft text-warning ring-1 ring-warning/30"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <Star className={cn("size-3", pinnedOnly && "fill-warning")} />
              <span>Pinned only</span>
            </button>
          )}

          {onStaleOnlyChange && (
            <button
              type="button"
              onClick={() => onStaleOnlyChange(!staleOnly)}
              className={cn(
                "press inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-colors cursor-pointer",
                staleOnly
                  ? "bg-danger-soft text-destructive ring-1 ring-destructive/30"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <Clock className="size-3" />
              <span>Stale Leads</span>
            </button>
          )}

          {onOperationalFilterChange &&
            operationalFilters.map(({ value, label, dot }) => {
              const isActive = operationalFilter === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onOperationalFilterChange(isActive ? undefined : value)}
                  className={cn(
                    "press inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-accent text-accent-foreground ring-1 ring-primary/30"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", dot)} />
                  <span>{label}</span>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
