import type { ColumnDefinition, ExportFormat, ExportResult, FollowUpExportRow } from "../types";
import { buildCsvBuffer } from "../csv-builder";
import { buildExcelBuffer } from "../excel-builder";
import { generateExportFilename } from "../formatters";

export const followUpExportColumns: ColumnDefinition<FollowUpExportRow>[] = [
  {
    header: "Lead Name",
    key: "leadName",
    width: 22,
    getValue: (row) => row.leadName,
  },
  {
    header: "Phone",
    key: "phone",
    width: 18,
    getValue: (row) => row.phone,
  },
  {
    header: "Canonical Status",
    key: "status",
    width: 18,
    getValue: (row) => row.status,
  },
  {
    header: "Follow-up Date",
    key: "followUpDate",
    width: 16,
    getValue: (row) => row.followUpDate,
  },
  {
    header: "Follow-up Time",
    key: "followUpTime",
    width: 16,
    getValue: (row) => row.followUpTime,
  },
  {
    header: "Follow-up Type",
    key: "followUpType",
    width: 16,
    getValue: (row) => row.followUpType,
  },
  {
    header: "Follow-up Note",
    key: "followUpNote",
    width: 32,
    getValue: (row) => row.followUpNote || "—",
  },
  {
    header: "Timing State",
    key: "timingState",
    width: 16,
    getValue: (row) => row.timingState,
  },
];

/**
 * Reusable Follow-ups exporter.
 * Strictly adheres to canonical single active follow-up rule per lead.
 */
export async function exportFollowUps(
  rows: FollowUpExportRow[],
  format: ExportFormat = "xlsx"
): Promise<ExportResult> {
  const filename = generateExportFilename("follow-ups", format);
  const mimeType =
    format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/csv; charset=utf-8";

  const buffer =
    format === "xlsx"
      ? await buildExcelBuffer("Follow-ups", rows, followUpExportColumns)
      : buildCsvBuffer(rows, followUpExportColumns);

  return {
    buffer,
    filename,
    mimeType,
    rowCount: rows.length,
  };
}
