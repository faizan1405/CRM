/**
 * Human-readable formatters for CRM exports.
 * All date/time conversions strictly respect Indian Standard Time (IST / Asia/Kolkata).
 */

export function getTodayISTDateString(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function formatISTDate(
  date: Date | string | null | undefined,
  fallback = "—"
): string {
  if (!date) return fallback;
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return fallback;
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return fallback;
  }
}

export function formatISTDateTime(
  date: Date | string | null | undefined,
  fallback = "—"
): string {
  if (!date) return fallback;
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return fallback;
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return fallback;
  }
}

export function formatISTTime(
  date: Date | string | null | undefined,
  fallback = "—"
): string {
  if (!date) return fallback;
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return fallback;
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return fallback;
  }
}

export function generateExportFilename(target: string, format: "csv" | "xlsx"): string {
  const dateStr = getTodayISTDateString();
  const ext = format === "xlsx" ? "xlsx" : "csv";
  return `scale-flow-${target}-${dateStr}.${ext}`;
}

export function formatCurrencyINR(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return "₹0";
  return `₹${amount.toLocaleString("en-IN")}`;
}
