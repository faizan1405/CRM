"use client";

import { useMemo, useState } from "react";
import {
  Clock,
  GitMerge,
  Search,
  SlidersHorizontal,
  Star,
  X,
  Check,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  leadStatuses,
  type LeadOperationalState,
  type LeadSortOption,
  type LeadStatus,
  type QuickStatusType,
} from "@/features/leads/types";
import { cn } from "@/lib/utils";

export type LeadFiltersProps = {
  query: string;
  status: LeadStatus | "All";
  operationalFilter?: LeadOperationalState;
  pinnedOnly?: boolean;
  staleOnly?: boolean;
  duplicatesOnly?: boolean;
  sortBy?: LeadSortOption;
  selectedQuickStatuses?: QuickStatusType[];
  availableSources?: string[];
  selectedSources?: string[];
  statusCounts?: Record<LeadStatus | "All", number>;
  totalLeads?: number;
  filteredCount?: number;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: LeadStatus | "All") => void;
  onOperationalFilterChange?: (value: LeadOperationalState | undefined) => void;
  onPinnedOnlyChange?: (value: boolean) => void;
  onStaleOnlyChange?: (value: boolean) => void;
  onDuplicatesOnlyChange?: (value: boolean) => void;
  onSortByChange?: (value: LeadSortOption) => void;
  onQuickStatusToggle?: (qs: QuickStatusType) => void;
  onSourceToggle?: (source: string) => void;
  onClear: () => void;
};

const QUICK_STATUS_OPTIONS: { value: QuickStatusType; label: string }[] = [
  { value: "CONTACTED", label: "Contacted" },
  { value: "INTERESTED", label: "Interested" },
  { value: "CALL_NOT_PICK", label: "Call not picked" },
  { value: "CALL_AGAIN", label: "Call again" },
];

const DEFAULT_SOURCES = [
  "Website",
  "Referral",
  "WhatsApp",
  "Instagram",
  "Trade Show",
  "Cold Call",
  "LinkedIn",
  "Other",
];

const SORT_OPTIONS: { value: LeadSortOption; label: string }[] = [
  { value: "default", label: "Newest" },
  { value: "value", label: "Value" },
  { value: "followup", label: "Follow-up" },
  { value: "name_asc", label: "Name A → Z" },
  { value: "name_desc", label: "Name Z → A" },
  { value: "most_stale", label: "Most Stale" },
];

export function LeadFilters({
  query,
  status,
  pinnedOnly = false,
  staleOnly = false,
  duplicatesOnly = false,
  sortBy = "default",
  selectedQuickStatuses = [],
  availableSources = DEFAULT_SOURCES,
  selectedSources = [],
  statusCounts,
  totalLeads = 0,
  filteredCount = 0,
  onQueryChange,
  onStatusChange,
  onPinnedOnlyChange,
  onStaleOnlyChange,
  onDuplicatesOnlyChange,
  onSortByChange,
  onQuickStatusToggle,
  onSourceToggle,
  onClear,
}: LeadFiltersProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Active filter count: includes quick status, sources, pinned, stale, duplicates, and non-default sorting
  const activeCount = useMemo(() => {
    let count = 0;
    if (pinnedOnly) count++;
    if (staleOnly) count++;
    if (duplicatesOnly) count++;
    if (selectedQuickStatuses.length > 0) count += selectedQuickStatuses.length;
    if (selectedSources.length > 0) count += selectedSources.length;
    if (sortBy !== "default") count++;
    return count;
  }, [
    pinnedOnly,
    staleOnly,
    duplicatesOnly,
    selectedQuickStatuses,
    selectedSources,
    sortBy,
  ]);

  const hasAnyFilter =
    query.trim().length > 0 ||
    status !== "All" ||
    activeCount > 0;

  return (
    <div className="mb-3 flex flex-col gap-2.5 lg:flex-row lg:items-center">
      {/* Search Bar + Filters Popover Button */}
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1 lg:w-72 lg:flex-none">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
          />
          {/* Mobile viewport zoom prevention: */}
          {/* text-base text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:text-sm */}
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search name, business, phone"
            aria-label="Search leads"
            className="h-10 w-full rounded-lg bg-card pl-9 pr-9 text-[13.5px] shadow-[var(--shadow-card)] outline-none transition-shadow placeholder:text-subtle focus:shadow-[0_0_0_1px_var(--ring),0_0_0_4px_color-mix(in_oklab,var(--ring)_15%,transparent)] md:h-9"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onQueryChange("")}
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-subtle hover:text-foreground cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Lovable Filter Popover */}
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={popoverOpen}
              className={cn(
                "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[13px] font-medium cursor-pointer press focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-card text-foreground shadow-[var(--shadow-card)] hover:bg-muted px-3.5 h-10 shrink-0 md:h-9 transition-colors",
                activeCount > 0 && "text-primary font-semibold"
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filters</span>
              {activeCount > 0 && (
                <span className="grid h-4 min-w-4 place-items-center rounded bg-primary px-1 text-[10px] text-primary-foreground tabular font-bold">
                  {activeCount}
                </span>
              )}
            </button>
          </PopoverTrigger>

          <PopoverContent
            align="start"
            sideOffset={6}
            className="w-[min(340px,calc(100vw-2rem))] p-0 rounded-xl border border-border bg-card shadow-[var(--shadow-float)]"
          >
            <div className="space-y-4 p-4 max-h-[75vh] overflow-y-auto">
              {/* Quick Status Chips */}
              <div>
                <div className="eyebrow mb-2">Quick status</div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_STATUS_OPTIONS.map((opt) => {
                    const isSelected = selectedQuickStatuses.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onQuickStatusToggle?.(opt.value)}
                        className={cn(
                          "press h-7.5 rounded-full px-3 text-[12px] font-medium transition-colors cursor-pointer",
                          isSelected
                            ? "bg-foreground text-background shadow-xs font-semibold"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Source Chips */}
              <div>
                <div className="eyebrow mb-2">Source</div>
                <div className="flex flex-wrap gap-1.5">
                  {availableSources.map((source) => {
                    const isSelected = selectedSources.includes(source);
                    return (
                      <button
                        key={source}
                        type="button"
                        onClick={() => onSourceToggle?.(source)}
                        className={cn(
                          "press h-7.5 rounded-full px-3 text-[12px] font-medium transition-colors cursor-pointer",
                          isSelected
                            ? "bg-foreground text-background shadow-xs font-semibold"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {source}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pinned Only Toggle */}
              {onPinnedOnlyChange && (
                <label className="flex cursor-pointer items-center justify-between rounded-lg bg-muted/60 px-3 py-2.5 text-[13px] font-medium transition-colors hover:bg-muted">
                  <span className="flex items-center gap-2">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                    <span>Pinned only</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={pinnedOnly}
                    onChange={(e) => onPinnedOnlyChange(e.target.checked)}
                    className="h-4 w-4 accent-[var(--primary)] rounded cursor-pointer"
                  />
                </label>
              )}

              {/* Stale Only Toggle */}
              {onStaleOnlyChange && (
                <label className="flex cursor-pointer items-center justify-between rounded-lg bg-muted/60 px-3 py-2.5 text-[13px] font-medium transition-colors hover:bg-muted">
                  <span className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-warning" />
                    <span>Stale leads only</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={staleOnly}
                    onChange={(e) => onStaleOnlyChange(e.target.checked)}
                    className="h-4 w-4 accent-[var(--primary)] rounded cursor-pointer"
                  />
                </label>
              )}

              {/* Possible Duplicates Toggle */}
              {onDuplicatesOnlyChange && (
                <label className="flex cursor-pointer items-center justify-between rounded-lg bg-muted/60 px-3 py-2.5 text-[13px] font-medium transition-colors hover:bg-muted">
                  <span className="flex items-center gap-2">
                    <GitMerge className="h-3.5 w-3.5 text-amber-600" />
                    <span>Possible duplicates</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={duplicatesOnly}
                    onChange={(e) => onDuplicatesOnlyChange(e.target.checked)}
                    className="h-4 w-4 accent-[var(--primary)] rounded cursor-pointer"
                  />
                </label>
              )}

              {/* Sort By */}
              {onSortByChange && (
                <div>
                  <div className="eyebrow mb-2">Sort by</div>
                  <div className="grid grid-cols-2 gap-1 rounded-[10px] bg-muted p-1">
                    {SORT_OPTIONS.map((opt) => {
                      const isSelected = sortBy === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => onSortByChange(opt.value)}
                          className={cn(
                            "press inline-flex h-7.5 items-center justify-between rounded-md px-2.5 text-[12px] font-medium transition-all cursor-pointer",
                            isSelected
                              ? "bg-card text-foreground shadow-xs font-semibold"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <span>{opt.label}</span>
                          {isSelected && <Check className="h-3 w-3 text-primary ml-1 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  {/* Hidden accessible select to satisfy legacy query or test selectors */}
                  <select
                    data-testid="leads-sort-select"
                    value={sortBy}
                    onChange={(e) => onSortByChange(e.target.value as LeadSortOption)}
                    className="sr-only"
                    aria-label="Sort leads"
                  >
                    <option value="default">Sort: Default</option>
                    <option value="name_asc">Name A → Z</option>
                    <option value="name_desc">Name Z → A</option>
                    <option value="most_stale">Most Stale First</option>
                    <option value="value">Value</option>
                    <option value="followup">Follow-up</option>
                  </select>
                </div>
              )}
            </div>

            {/* Popover Footer */}
            <div className="flex justify-between items-center border-t border-border bg-muted/40 px-4 py-2.5">
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setPopoverOpen(false);
                }}
                disabled={activeCount === 0 && !query && status === "All"}
                className="text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Reset
              </button>
              <span className="text-[12px] text-muted-foreground tabular font-medium">
                {filteredCount} {filteredCount === 1 ? "result" : "results"}
              </span>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Lovable Horizontal Status Tabs */}
      <div className="min-w-0 rounded-[10px] bg-muted p-0.5 lg:ml-auto">
        <div className="-mx-1 flex gap-0.5 overflow-x-auto px-1 [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => onStatusChange("All")}
            className={cn(
              "press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-all duration-200 cursor-pointer",
              status === "All"
                ? "bg-card text-foreground shadow-[var(--shadow-card)]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>All</span>
            <span
              className={cn(
                "tabular text-[11.5px]",
                status === "All" ? "text-muted-foreground font-semibold" : "text-subtle"
              )}
            >
              {statusCounts?.All ?? totalLeads}
            </span>
          </button>

          {leadStatuses.map((s) => {
            const isSelected = status === s;
            const count = statusCounts ? statusCounts[s] ?? 0 : 0;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onStatusChange(s)}
                className={cn(
                  "press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-all duration-200 cursor-pointer",
                  isSelected
                    ? "bg-card text-foreground shadow-[var(--shadow-card)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{s}</span>
                <span
                  className={cn(
                    "tabular text-[11.5px]",
                    isSelected ? "text-muted-foreground font-semibold" : "text-subtle"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
