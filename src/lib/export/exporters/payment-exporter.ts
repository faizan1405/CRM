import type { ColumnDefinition, ExportFormat, ExportResult, PaymentExportRow } from "../types";
import { buildCsvBuffer } from "../csv-builder";
import { buildExcelBuffer } from "../excel-builder";
import { generateExportFilename } from "../formatters";

export const paymentExportColumns: ColumnDefinition<PaymentExportRow>[] = [
  {
    header: "Client",
    key: "clientName",
    width: 22,
    getValue: (row) => row.clientName,
  },
  {
    header: "Deal / Project",
    key: "dealOrProject",
    width: 24,
    getValue: (row) => row.dealOrProject || "—",
  },
  {
    header: "Payment Amount (INR)",
    key: "amount",
    width: 20,
    isNumeric: true,
    numFmt: "#,##0.00",
    getValue: (row) => row.amount,
  },
  {
    header: "Payment Date",
    key: "paymentDate",
    width: 16,
    getValue: (row) => row.paymentDate,
  },
  {
    header: "Payment Type",
    key: "paymentType",
    width: 16,
    getValue: (row) => row.paymentType,
  },
  {
    header: "Payment Method",
    key: "paymentMethod",
    width: 18,
    getValue: (row) => row.paymentMethod,
  },
  {
    header: "Reference / Transaction ID",
    key: "reference",
    width: 24,
    getValue: (row) => row.reference || "—",
  },
  {
    header: "Payment Note",
    key: "note",
    width: 30,
    getValue: (row) => row.note || "—",
  },
  {
    header: "Created At",
    key: "createdAt",
    width: 20,
    getValue: (row) => row.createdAt,
  },
];

/**
 * Reusable Payments exporter.
 * Each payment is emitted as a separate row.
 */
export async function exportPayments(
  rows: PaymentExportRow[],
  format: ExportFormat = "xlsx"
): Promise<ExportResult> {
  const filename = generateExportFilename("payments", format);
  const mimeType =
    format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/csv; charset=utf-8";

  const buffer =
    format === "xlsx"
      ? await buildExcelBuffer("Payments", rows, paymentExportColumns)
      : buildCsvBuffer(rows, paymentExportColumns);

  return {
    buffer,
    filename,
    mimeType,
    rowCount: rows.length,
  };
}
