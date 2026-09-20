import type { ColumnDefinition, ExportFormat, ExportResult, DealExportRow } from "../types";
import { buildCsvBuffer } from "../csv-builder";
import { buildExcelBuffer } from "../excel-builder";
import { generateExportFilename } from "../formatters";

export const dealExportColumns: ColumnDefinition<DealExportRow>[] = [
  {
    header: "Client Name",
    key: "clientName",
    width: 22,
    getValue: (row) => row.clientName,
  },
  {
    header: "Client Type",
    key: "clientType",
    width: 16,
    getValue: (row) => row.clientType,
  },
  {
    header: "Company",
    key: "company",
    width: 24,
    getValue: (row) => row.company || "—",
  },
  {
    header: "Project / Deal Name",
    key: "projectName",
    width: 26,
    getValue: (row) => row.projectName || "—",
  },
  {
    header: "Final Deal Value",
    key: "finalAmount",
    width: 18,
    isNumeric: true,
    numFmt: "#,##0.00",
    getValue: (row) => row.finalAmount,
  },
  {
    header: "Currency",
    key: "currency",
    width: 12,
    getValue: (row) => row.currency || "INR",
  },
  {
    header: "Received",
    key: "totalReceived",
    width: 18,
    isNumeric: true,
    numFmt: "#,##0.00",
    getValue: (row) => row.totalReceived,
  },
  {
    header: "Remaining",
    key: "remainingBalance",
    width: 18,
    isNumeric: true,
    numFmt: "#,##0.00",
    getValue: (row) => row.remainingBalance,
  },
  {
    header: "Payment Status",
    key: "paymentStatus",
    width: 16,
    getValue: (row) => row.paymentStatus,
  },
  {
    header: "Next Payment Due",
    key: "nextPaymentDueDate",
    width: 18,
    getValue: (row) => row.nextPaymentDueDate || "—",
  },
  {
    header: "Next Due Amount",
    key: "nextDueAmount",
    width: 18,
    isNumeric: true,
    numFmt: "#,##0.00",
    getValue: (row) => (row.nextPaymentDueAmount != null ? row.nextPaymentDueAmount : ""),
  },
  {
    header: "Deal Status",
    key: "dealStatus",
    width: 16,
    getValue: (row) => row.dealStatus,
  },
  {
    header: "Created Date",
    key: "createdAt",
    width: 18,
    getValue: (row) => row.createdAt,
  },
];

/**
 * Reusable Deals exporter.
 */
export async function exportDeals(
  rows: DealExportRow[],
  format: ExportFormat = "xlsx"
): Promise<ExportResult> {
  const filename = generateExportFilename("deals", format);
  const mimeType =
    format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/csv; charset=utf-8";

  const buffer =
    format === "xlsx"
      ? await buildExcelBuffer("Deals", rows, dealExportColumns)
      : buildCsvBuffer(rows, dealExportColumns);

  return {
    buffer,
    filename,
    mimeType,
    rowCount: rows.length,
  };
}
