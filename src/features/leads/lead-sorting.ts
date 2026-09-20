import type { Lead, LeadSortOption } from "./types";

/**
 * Compares two lead names ignoring case, leading/trailing whitespace,
 * and handles locale-aware character comparisons.
 */
export function compareLeadNames(aName?: string | null, bName?: string | null): number {
  const cleanA = (aName ?? "").trim().toLowerCase();
  const cleanB = (bName ?? "").trim().toLowerCase();
  return cleanA.localeCompare(cleanB, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Sorts leads based on the specified sort option.
 *
 * Rules:
 * - When sortBy is "name_asc" or "name_desc", explicit name sorting determines ordering.
 *   Pinned leads are NOT moved above alphabetical order.
 * - When sortBy is "default" or "most_stale", pinned leads appear first.
 * - Leading/trailing whitespace and casing are ignored.
 * - Stable fallback using lead id.
 */
export function sortLeads<
  T extends {
    id: string;
    name?: string | null;
    isPinned?: boolean;
    createdAt?: string;
    staleInfo?: { inactivityDays?: number };
  }
>(leads: T[], sortBy: LeadSortOption): T[] {
  return [...leads].sort((a, b) => {
    // Explicit name sorting: NO pinned bias
    if (sortBy === "name_asc") {
      const cmp = compareLeadNames(a.name, b.name);
      if (cmp !== 0) return cmp;
      return a.id.localeCompare(b.id);
    }

    if (sortBy === "name_desc") {
      const cmp = compareLeadNames(b.name, a.name);
      if (cmp !== 0) return cmp;
      return a.id.localeCompare(b.id);
    }

    // Default / Stale sorting: pinned leads float to top
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    if (sortBy === "most_stale") {
      const aDays = a.staleInfo?.inactivityDays ?? 0;
      const bDays = b.staleInfo?.inactivityDays ?? 0;
      if (bDays !== aDays) {
        return bDays - aDays;
      }
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    }

    return 0;
  });
}

/**
 * Parses URL query param string into a valid LeadSortOption.
 * Supports "name-asc", "name_asc", "name-desc", "name_desc", "stale", "most_stale", etc.
 */
export function parseSortParam(param: string | null): LeadSortOption {
  if (!param) return "default";
  const normalized = param.trim().toLowerCase();
  if (normalized === "name-asc" || normalized === "name_asc") return "name_asc";
  if (normalized === "name-desc" || normalized === "name_desc") return "name_desc";
  if (normalized === "stale" || normalized === "most_stale" || normalized === "most-stale") return "most_stale";
  return "default";
}

/**
 * Converts a LeadSortOption into URL query parameter value.
 * Returns null for "default" so it can be omitted from URL.
 */
export function sortOptionToQueryParam(option: LeadSortOption): string | null {
  if (option === "name_asc") return "name-asc";
  if (option === "name_desc") return "name-desc";
  if (option === "most_stale") return "stale";
  return null;
}
