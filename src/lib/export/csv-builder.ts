import type { ColumnDefinition } from "./types";

/**
 * Escapes a cell value for RFC 4180 compliant CSV.
 */
function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  // If string contains comma, quote, or newline, wrap in quotes and escape quotes
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates a UTF-8 encoded CSV Buffer with Byte Order Mark (BOM).
 * The BOM (\uFEFF) ensures Microsoft Excel and spreadsheet software correctly
 * open Indian currency symbols (₹) and UTF-8 characters without encoding issues.
 */
export function buildCsvBuffer<T>(
  data: T[],
  columns: ColumnDefinition<T>[]
): Buffer {
  const headerRow = columns.map((col) => escapeCsvCell(col.header)).join(",");
  const rows = data.map((item) =>
    columns.map((col) => escapeCsvCell(col.getValue(item))).join(",")
  );

  const csvContent = [headerRow, ...rows].join("\r\n");
  // \uFEFF BOM + CSV content in UTF-8
  return Buffer.from(`\uFEFF${csvContent}`, "utf-8");
}
