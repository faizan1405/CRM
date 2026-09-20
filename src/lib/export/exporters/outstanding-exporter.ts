import type { ColumnDefinition, ExportFormat, ExportResult, OutstandingBalanceExportRow } from "../types";
import { buildCsvBuffer } from "../csv-builder";
import { buildExcelBuffer } from "../excel-builder";
import { generateExportFilename } from "../formatters";

export const outstandingExportColumns: ColumnDefinition<OutstandingBalanceExportRow>[] = [
  {
    header: "Client",
    key: "clientName",
    width: 22,
    getValue: (row) => row.clientName,
  },
  {
    header: "Business",
    key: "business",
    width: 24,
    getValue: (row) => row.business || "—",
  },
  {
    header: "Deal Value (INR)",
    key: "dealValue",
    width: 18,
    isNumeric: true,
    numFmt: "#,##0.00",
    getValue: (row) => row.dealValue,
  },
  {
    header: "Received (INR)",
    key: "received",
    width: 18,
    isNumeric: true,
    numFmt: "#,##0.00",
    getValue: (row) => row.received,
  },
  {
    header: "Remaining (INR)",
    key: "remaining",
    width: 18,
    isNumeric: true,
    numFmt: "#,##0.00",
    getValue: (row) => row.remaining,
  },
  {
    header: "Payment Status",
    key: "paymentStatus",
    width: 16,
    getValue: (row) => row.paymentStatus,
  },
  {
    header: "Next Due Date",
    key: "nextDueDate",
    width: 18,
    getValue: (row) => row.nextDueDate || "—",
  },
  {
    header: "Next Due Amount (INR)",
    key: "nextDueAmount",
    width: 22,
    isNumeric: true,
    numFmt: "#,##0.00",
    getValue: (row) => (row.nextDueAmount != null ? row.nextDueAmount : ""),
  },
  {
    header: "Days Overdue",
    key: "daysOverdue",
    width: 16,
    isNumeric: true,
    numFmt: "0",
    getValue: (row) => row.daysOverdue,
  },
];

/**
 * Reusable Outstanding Balances exporter.
 * Emits only deals that have a remaining balance > 0.
 */
export async function exportOutstandingBalances(
  rows: OutstandingBalanceExportRow[],
  format: ExportFormat = "xlsx"
): Promise<ExportResult> {
  // Ensure filtering strictly enforces Remaining > 0
  const filteredRows = rows.filter((r) => Number(r.remaining) > 0);

  const filename = generateExportFilename("outstanding-balances", format);
  const mimeType =
    format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/csv; charset=utf-8";

  const buffer =
    format === "xlsx"
      ? await buildExcelBuffer("Outstanding Balances", filteredRows, outstandingExportColumns)
      : buildCsvBuffer(filteredRows, outstandingExportColumns);

  return {
    buffer,
    filename,
    mimeType,
    rowCount: filteredRows.length,
  };
}
