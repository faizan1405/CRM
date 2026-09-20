import type { ColumnDefinition, ExportFormat, ExportResult, LeadExportRow } from "../types";
import { buildCsvBuffer } from "../csv-builder";
import { buildExcelBuffer } from "../excel-builder";
import { formatISTDate, generateExportFilename } from "../formatters";

export const leadExportColumns: ColumnDefinition<LeadExportRow>[] = [
  {
    header: "Name",
    key: "name",
    width: 22,
    getValue: (row) => row.name,
  },
  {
    header: "Business",
    key: "business",
    width: 24,
    getValue: (row) => row.business || "—",
  },
  {
    header: "Phone",
    key: "phone",
    width: 18,
    getValue: (row) => row.phone,
  },
  {
    header: "Email",
    key: "email",
    width: 26,
    getValue: (row) => row.email || "—",
  },
  {
    header: "Industry",
    key: "industry",
    width: 18,
    getValue: (row) => row.industry || "—",
  },
  {
    header: "Source",
    key: "source",
    width: 18,
    getValue: (row) => row.source || "—",
  },
  {
    header: "Canonical Status",
    key: "status",
    width: 18,
    getValue: (row) => row.status,
  },
  {
    header: "Quoted Amount (INR)",
    key: "quotedAmount",
    width: 22,
    isNumeric: true,
    numFmt: "#,##0.00",
    getValue: (row) => (row.quotedAmount != null ? row.quotedAmount : ""),
  },
  {
    header: "Next Follow-up",
    key: "nextFollowUp",
    width: 20,
    getValue: (row) => row.nextFollowUp || "—",
  },
  {
    header: "Last Meaningful Activity",
    key: "lastActivity",
    width: 32,
    getValue: (row) => row.lastActivity || "—",
  },
  {
    header: "Pinned",
    key: "isPinned",
    width: 12,
    getValue: (row) => (row.isPinned ? "Yes" : "No"),
  },
  {
    header: "Stale",
    key: "isStale",
    width: 12,
    getValue: (row) => (row.isStale ? "Yes" : "No"),
  },
  {
    header: "Created Date",
    key: "createdAt",
    width: 18,
    getValue: (row) => row.createdAt,
  },
];

/**
 * Reusable Leads exporter.
 * Produces CSV or Excel buffer without exposing any database internals or secrets.
 */
export async function exportLeads(
  rows: LeadExportRow[],
  format: ExportFormat = "xlsx"
): Promise<ExportResult> {
  const filename = generateExportFilename("leads", format);
  const mimeType =
    format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/csv; charset=utf-8";

  const buffer =
    format === "xlsx"
      ? await buildExcelBuffer("Leads", rows, leadExportColumns)
      : buildCsvBuffer(rows, leadExportColumns);

  return {
    buffer,
    filename,
    mimeType,
    rowCount: rows.length,
  };
}
