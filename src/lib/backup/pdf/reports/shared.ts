import type { Deal, Lead, Payment } from "@prisma/client";
import { statusFromDatabase, type DatabaseLeadStatus } from "@/features/leads/types";
import { formatISTDate, formatISTDateTime } from "@/lib/export/formatters";
import { decimalToNumber } from "@/lib/financial/calculations";
import { REPORT_TABLE_ROW_CAP } from "../../constants";
import type { BackupAnalytics } from "../../analytics";
import type { BackupDataset, ReportDefinition, ReportKey } from "../../types";
import type { ReportColumn, ReportMeta, ReportBuilder } from "../report-builder";

/* -------------------------------------------------------------------------- */
/*  Context                                                                    */
/* -------------------------------------------------------------------------- */

export interface ReportContext {
  dataset: BackupDataset;
  analytics: BackupAnalytics;
  file: {
    generatedAtUtc: string;
    generatedAtIst: string;
    generatedByName: string;
    generatedByEmail: string;
    scopeNote: string;
    warnings: string[];
    recordSummary: Array<{ label: string; value: string }>;
    totalBytesLabel?: string;
  };
}

export interface ReportRenderSettings {
  generatedAtIst: string;
  generatedAtUtc: string;
  generatedByName: string;
  generatedByEmail: string;
  scopeNote: string;
  warnings: string[];
  recordSummary: Array<{ label: string; value: string }>;
}

export function buildReportMeta(definition: ReportDefinition, settings: ReportRenderSettings): ReportMeta {
  return {
    reportKey: definition.key,
    fileName: definition.file,
    title: definition.title,
    subtitle: definition.subtitle,
    generatedAtIst: settings.generatedAtIst,
    generatedAtUtc: settings.generatedAtUtc,
    generatedBy: `${settings.generatedByName} (${settings.generatedByEmail})`,
    organization: "Scale Flow CRM",
    recordSummary: settings.recordSummary,
    scopeNote: settings.scopeNote,
    warnings: settings.warnings,
  };
}

/* -------------------------------------------------------------------------- */
/*  Formatting                                                                 */
/* -------------------------------------------------------------------------- */

const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COUNT_FORMATTER = new Intl.NumberFormat("en-IN");

/** Indian currency: grouped as per the en-IN convention (12,34,567.00) with the rupee sign. */
export function inr(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "₹0.00";
  const sign = value < 0 ? "-" : "";
  return `${sign}₹${INR_FORMATTER.format(Math.abs(value))}`;
}

export function count(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0";
  return COUNT_FORMATTER.format(value);
}

export function pct(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0%";
  return `${value.toFixed(digits)}%`;
}

export function dash(value: string | null | undefined): string {
  const trimmed = (value ?? "").toString().trim();
  return trimmed.length > 0 ? trimmed : "—";
}

export function dateIst(value: Date | string | null | undefined): string {
  return value ? formatISTDate(value, "—") : "—";
}

export function dateTimeIst(value: Date | string | null | undefined): string {
  return value ? formatISTDateTime(value, "—") : "—";
}

export function amount(value: unknown): number {
  return decimalToNumber(value as never);
}

export function leadStatusLabel(status: string): string {
  return statusFromDatabase[status as DatabaseLeadStatus] ?? status;
}

export function leadFlags(lead: Lead): string {
  const flags: string[] = [];
  if (lead.deletedAt) flags.push("Archived (deleted)");
  if (lead.mergedIntoLeadId) flags.push("Merged away");
  if (lead.isWaste) flags.push("Waste");
  if (lead.isPinned) flags.push("Pinned");
  return flags.length > 0 ? flags.join(", ") : "Current";
}

export function leadNoteSnippet(notes: string | null | undefined, maxLength = 240): string {
  const value = (notes ?? "").trim();
  if (!value) return "—";
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

export function contactCell(lead: Lead): string {
  const lines = [lead.phone || "—"];
  if (lead.email) lines.push(lead.email);
  return lines.join("\n");
}

export function clientLabelForDeal(deal: Deal, lead: Lead | undefined, clientName: string): string {
  if (deal.source === "OTHER_CLIENT") return clientName;
  return lead?.name ?? clientName;
}

export function paymentNoteCell(payment: Payment): string {
  const parts: string[] = [];
  if (payment.reference) parts.push(`Ref: ${payment.reference}`);
  if (payment.note) parts.push(payment.note);
  return parts.length ? parts.join(" • ") : "—";
}

/* -------------------------------------------------------------------------- */
/*  Table helpers                                                              */
/* -------------------------------------------------------------------------- */

export interface CappedRows {
  rows: string[][];
  shown: number;
  total: number;
  omitted: number;
}

/**
 * Applies the report display cap. The cap is always disclosed in the PDF (never silent) and the
 * raw backup files remain complete — this only bounds how many rows a printed report contains.
 */
export function capRows(rows: string[][], cap = REPORT_TABLE_ROW_CAP): CappedRows {
  if (rows.length <= cap) {
    return { rows, shown: rows.length, total: rows.length, omitted: 0 };
  }
  return { rows: rows.slice(0, cap), shown: cap, total: rows.length, omitted: rows.length - cap };
}

export interface TableSectionOptions {
  title: string;
  description?: string;
  caption?: string;
  columns: ReportColumn[];
  rows: string[][];
  totals?: string[];
  emptyMessage?: string;
  emphasizeRows?: number[];
  cap?: number;
  /** Raw file that holds the complete record set (used in the display-limit disclosure). */
  fullDataSetFile?: string;
  /** Column order note shown when a table is capped: index of the row-number column. */
  rowNumberStart?: number;
}

/**
 * Renders a titled table section with an automatic, explicit disclosure when the display cap is
 * reached, so a reader is never misled into thinking a truncated print-out is the full dataset.
 */
export function tableSection(builder: ReportBuilder, options: TableSectionOptions): void {
  const capped = capRows(options.rows, options.cap);

  builder.heading(options.title, options.description);

  builder.table({
    caption: options.caption,
    columns: options.columns,
    rows: capped.rows,
    totals: options.totals,
    emptyMessage: options.emptyMessage,
    emphasizeRows: options.emphasizeRows,
  });

  if (capped.omitted > 0) {
    builder.addCallout(
      "Display limit reached",
      [
        `This report prints the first ${count(capped.shown)} of ${count(capped.total)} rows so the document stays readable. ` +
          `The complete, unlimited record set is included in the backup archive${
            options.fullDataSetFile ? ` (see ${options.fullDataSetFile})` : ""
          } and in complete_crm_export.json.`,
      ],
      "info"
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  Cover summary                                                              */
/* -------------------------------------------------------------------------- */

export function buildRecordSummary(dataset: BackupDataset, analytics: BackupAnalytics): Array<{ label: string; value: string }> {
  const summary = [
    { label: "Leads", value: count(dataset.leads.length) },
    { label: "Projects & Deals", value: count(dataset.deals.length) },
    { label: "Payment transactions", value: count(dataset.payments.length) },
    { label: "Follow-ups", value: count(dataset.followUps.length) },
    { label: "Activities", value: count(dataset.activities.length) },
    { label: "Personal notes", value: count(dataset.personalNotes.length) },
    { label: "Money received", value: inr(analytics.reconciliation.moneyReceived) },
    { label: "Outstanding", value: inr(analytics.reconciliation.outstanding) },
    {
      label: "Total records",
      value: count(Object.values(dataset.meta.fetchedCounts).reduce((sum, value) => sum + value, 0)),
    },
  ];
  return summary;
}

/** Standard closing note that documents canonical financial definitions in every money report. */
export function canonicalFinanceNote(analytics: BackupAnalytics): string[] {
  const reconciliation = analytics.reconciliation;
  return [
    `Money received (${inr(reconciliation.moneyReceived)}) is the sum of every payment transaction and equals the deal-level received sum (${inr(
      reconciliation.dealLevelReceivedSum
    )}).`,
    `Contracted value (${inr(reconciliation.contractedDealValue)}) counts each project exactly once, so clients with multiple projects (${count(
      reconciliation.clientsWithMultipleDeals
    )}) are never double counted.`,
    `Outstanding (${inr(reconciliation.outstanding)}) is MAX(contracted − received, 0) per project and equals the per-project sum (${inr(
      reconciliation.dealLevelOutstandingSum
    )}). Overpayments are capped at zero.`,
    `Collection rate ${pct(reconciliation.collectionRate)} = money received ÷ contracted value. Won deal value ${inr(
      reconciliation.wonDealValue
    )} covers confirmed/completed deals of won CRM clients only, per the canonical financial definitions.`,
  ];
}

export const REPORT_KEYS_ORDER: ReportKey[] = [
  "overview",
  "sales",
  "finance",
  "leads",
  "projects-deals",
  "followups",
  "activities-notes",
  "other-records",
];