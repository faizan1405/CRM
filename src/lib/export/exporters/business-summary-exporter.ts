import type { ColumnDefinition, ExportFormat, ExportResult, BusinessSummaryData, BusinessSummaryMetricRow } from "../types";
import { buildCsvBuffer } from "../csv-builder";
import { buildExcelBuffer } from "../excel-builder";
import { generateExportFilename } from "../formatters";

export const businessSummaryColumns: ColumnDefinition<BusinessSummaryMetricRow>[] = [
  {
    header: "Business Metric",
    key: "metric",
    width: 28,
    getValue: (row) => row.metric,
  },
  {
    header: "Value",
    key: "value",
    width: 22,
    isNumeric: true,
    numFmt: "#,##0.00",
    getValue: (row) => row.value,
  },
  {
    header: "Notes / Unit",
    key: "notes",
    width: 28,
    getValue: (row) => row.notes || "",
  },
];

export function transformSummaryToRows(summary: BusinessSummaryData): BusinessSummaryMetricRow[] {
  return [
    {
      metric: "Total Leads",
      value: summary.totalLeads,
      notes: "Active non-deleted leads",
    },
    {
      metric: "Qualified Leads",
      value: summary.qualifiedLeads,
      notes: "Canonical QUALIFIED status",
    },
    {
      metric: "Won Deals",
      value: summary.wonDeals,
      notes: "Confirmed / completed deals",
    },
    {
      metric: "Total Deal Value",
      value: summary.totalDealValue,
      notes: "INR (₹) total contracted value",
    },
    {
      metric: "Payments Received",
      value: summary.paymentsReceived,
      notes: "INR (₹) actual payment records",
    },
    {
      metric: "Outstanding Balance",
      value: summary.outstanding,
      notes: "INR (₹) remaining deal balances",
    },
    {
      metric: "Overdue Balance",
      value: summary.overdue,
      notes: "INR (₹) due date passed",
    },
    {
      metric: "Follow-ups Due",
      value: summary.followUpsDue,
      notes: "Active follow-ups due today or overdue",
    },
    {
      metric: "Stale Leads",
      value: summary.staleLeads,
      notes: "Exceeded inactivity threshold",
    },
  ];
}

/**
 * Reusable Business Summary exporter.
 */
export async function exportBusinessSummary(
  summary: BusinessSummaryData,
  format: ExportFormat = "xlsx"
): Promise<ExportResult> {
  const rows = transformSummaryToRows(summary);
  const prefix = summary.period === "this_month" ? "business-summary-monthly" : "business-summary";
  const filename = generateExportFilename(prefix, format);
  const mimeType =
    format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/csv; charset=utf-8";

  const buffer =
    format === "xlsx"
      ? await buildExcelBuffer("Business Summary", rows, businessSummaryColumns)
      : buildCsvBuffer(rows, businessSummaryColumns);

  return {
    buffer,
    filename,
    mimeType,
    rowCount: rows.length,
  };
}
