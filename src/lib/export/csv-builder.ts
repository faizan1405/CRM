import type { ColumnDefinition } from "./types";

/**
 * Escapes a cell value for RFC 4180 compliant CSV.
 */
function escapeCsvCell(value: unknown): string {
  // Neutralize formula-starting characters to prevent spreadsheet formula injection.
  // Excel/Sheets interpret cells starting with =, +, -, @, (, or # as formulas.
  const formulaTriggerChars = /^[=\+\@\#\s]/;
  const neutralized = formulaTriggerChars.test(str) ? " " + str : str;

  // If string contains comma, quote, or newline, wrap in quotes and escape quotes
  const workingStr = neutralized;
  if (/[\",\r\n]/.test(workingStr)) {
    return `"${workingStr.replace(/\"/g, '\"\"')}"`;
  }
  return workingStr;
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
