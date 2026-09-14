/**
 * Phase 6 – Analytics Helper Utilities
 *
 * Pure helper functions for:
 *  - Date boundary computation (IST / Asia/Kolkata aware)
 *  - Trend bucket labelling
 *  - Prisma Decimal → number serialization
 */

import type { DateRange } from "@/features/analytics/types";
import type { Decimal } from "@prisma/client/runtime/library";

// ─── IST Timezone Helpers ──────────────────────────────────────────────────────

/**
 * Given a Gregorian date in IST (year, month 1-indexed, day),
 * return the equivalent UTC Date that represents midnight IST on that day.
 *
 * IST = UTC+5:30, so midnight IST = UTC 18:30 the previous day.
 */
export function buildISTMidnight(year: number, month: number, day: number): Date {
  // month is 1-indexed here; Date.UTC expects 0-indexed month
  return new Date(Date.UTC(year, month - 1, day, -5, -30, 0, 0));
}

/**
 * Extract the current date parts in Asia/Kolkata timezone.
 */
export function getTodayIST(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);

  return {
    year: parseInt(parts.find((p) => p.type === "year")!.value),
    month: parseInt(parts.find((p) => p.type === "month")!.value), // 1-indexed
    day: parseInt(parts.find((p) => p.type === "day")!.value),
  };
}

// ─── Date Range Boundaries ─────────────────────────────────────────────────────

export type DateRangeBoundaries = {
  /** null means "no lower bound" (all time) */
  start: Date | null;
  /** Upper bound — typically now */
  end: Date;
};

/**
 * Returns UTC Date boundaries for the requested DateRange.
 *
 * For calendar-day ranges (7d/30d/90d), the start is midnight IST N days ago
 * so that a lead created at 23:59 IST today is correctly included.
 * "All time" returns start=null.
 */
export function getDateRangeBoundaries(range: DateRange, now: Date = new Date()): DateRangeBoundaries {
  if (range === "all") {
    return { start: null, end: now };
  }

  const daysMap: Record<Exclude<DateRange, "all">, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
  };

  const days = daysMap[range as Exclude<DateRange, "all">];
  const { year, month, day } = getTodayIST(now);

  // Compute start date N days ago in IST
  // Subtract days from IST date then build midnight UTC
  const startDate = new Date(Date.UTC(year, month - 1, day - days + 1));
  const startIST = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(startDate);

  const sy = parseInt(startIST.find((p) => p.type === "year")!.value);
  const sm = parseInt(startIST.find((p) => p.type === "month")!.value);
  const sd = parseInt(startIST.find((p) => p.type === "day")!.value);

  return {
    start: buildISTMidnight(sy, sm, sd),
    end: now,
  };
}

// ─── Trend Granularity ─────────────────────────────────────────────────────────

export type TrendGranularity = "daily" | "weekly" | "monthly";

/**
 * Choose an appropriate chart granularity for the date range.
 *
 * 7d  → daily   (7 points)
 * 30d → daily   (30 points)
 * 90d → weekly  (~13 points — cleaner than 90 daily bars)
 * all → monthly (open-ended)
 */
export function getTrendGranularity(range: DateRange): TrendGranularity {
  if (range === "7d" || range === "30d") return "daily";
  if (range === "90d") return "weekly";
  return "monthly";
}

// ─── Bucket Label Generation ───────────────────────────────────────────────────

/**
 * Format a Date into the bucket label for a given granularity.
 *
 * daily   → "YYYY-MM-DD"   (ISO date, suitable for display)
 * weekly  → "YYYY-MM-DD"   (Monday of the ISO week)
 * monthly → "YYYY-MM"
 */
export function bucketLabel(date: Date, granularity: TrendGranularity): string {
  if (granularity === "monthly") {
    // Format as YYYY-MM using IST timezone
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(date);
    const y = parts.find((p) => p.type === "year")!.value;
    const m = parts.find((p) => p.type === "month")!.value;
    return `${y}-${m}`;
  }

  if (granularity === "weekly") {
    // Return the Monday of the week containing this date (ISO week)
    const d = new Date(date);
    const istOffset = 5.5 * 60 * 60 * 1000; // IST = UTC+5:30
    const istDate = new Date(d.getTime() + istOffset);
    const dow = istDate.getUTCDay(); // 0=Sun,1=Mon,...
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(istDate.getTime() + diffToMonday * 24 * 60 * 60 * 1000);
    const yy = monday.getUTCFullYear();
    const mm = String(monday.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(monday.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }

  // daily — format in IST
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const dd = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${dd}`;
}

/**
 * Generate all bucket labels for a date range at a given granularity.
 * Returns them in chronological order so the chart always has a complete x-axis.
 */
export function generateBucketLabels(
  range: DateRange,
  granularity: TrendGranularity,
  now: Date = new Date()
): string[] {
  const { start, end } = getDateRangeBoundaries(range, now);
  const labels: string[] = [];

  if (!start) {
    // "all time" — do not pre-generate labels; caller builds them from data
    return [];
  }

  const cursor = new Date(start);
  const seen = new Set<string>();

  while (cursor <= end) {
    const label = bucketLabel(cursor, granularity);
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }

    // Advance cursor
    if (granularity === "daily") {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    } else if (granularity === "weekly") {
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    } else {
      // monthly
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }

  return labels;
}

// ─── Decimal Serialization ─────────────────────────────────────────────────────

/**
 * Safely convert a Prisma Decimal (or null/undefined) to a plain JS number.
 * Returns 0 for null/undefined.
 */
export function serializeDecimal(value: Decimal | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}


// ─── Rate Helpers ──────────────────────────────────────────────────────────────

/**
 * Safe division for rate calculations.
 * Returns 0 if denominator is 0 or NaN.
 */
export function safeRate(numerator: number, denominator: number): number {
  if (!denominator || !isFinite(denominator)) return 0;
  const rate = numerator / denominator;
  // Round to 4 decimal places for clean percentages on frontend
  return Math.round(rate * 10000) / 10000;
}
