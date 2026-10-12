import { createHash } from "node:crypto";
import {
  BACKUP_FORMAT_VERSION,
  CATEGORY_LABELS,
  EXCLUDED_CATEGORIES,
  PDF_FOLDER,
  RAW_FOLDER,
  RECORD_FORMAT_VERSION,
  SCHEMA_BASELINE_MIGRATION,
} from "./constants";
import type {
  BackupArtifact,
  BackupDataset,
  BackupManifest,
  BackupValidation,
  CategoryKey,
  ManifestCategory,
  ZipIntegrityReport,
} from "./types";
import type { GeneratedReport } from "./pdf/reports";

export const MANIFEST_FILE_NAME = "backup_manifest.json";
export const COMPLETE_JSON_FILE_NAME = "complete_crm_export.json";

export function sha256(buffer: Buffer | string): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Categories de-duplicated so a file shared by several categories is listed once per category. */
const CATEGORY_FILE_NAMES: Record<CategoryKey, string> = {
  users: "users.csv",
  leads: "leads.csv",
  deals: "deals.csv",
  payments: "payments.csv",
  followUps: "followups.csv",
  activities: "activities.csv",
  aiInsights: "ai_insights.csv",
  lossEvents: "loss_events.csv",
  personalNotes: "notes.csv",
  packages: "sales_assets.csv",
  samples: "sales_assets.csv",
  templates: "sales_assets.csv",
  notifications: "notifications.csv",
  briefings: "daily_briefings.csv",
  undoActions: "undo_actions.csv",
  mobileAlerts: "mobile_alert_log.csv",
};

export interface BuildManifestInput {
  fileName: string;
  generatedAt: Date;
  generatedAtIst: string;
  durationMs: number;
  actor: { id: string; name: string; email: string; role: string };
  dataset: BackupDataset;
  validation: BackupValidation;
  reports: GeneratedReport[];
  rawFiles: Array<{ path: string; buffer: Buffer; rows: number }>;
  jsonBuffer: Buffer;
  archiveIntegrity: ZipIntegrityReport;
  crmSyncVersionAtEnd: number | null;
  extraNotes?: string[];
}

export function buildManifest(input: BuildManifestInput): BackupManifest {
  const {
    dataset,
    validation,
    reports,
    rawFiles,
    jsonBuffer,
    archiveIntegrity,
    actor,
    generatedAt,
    generatedAtIst,
    durationMs,
    fileName,
    crmSyncVersionAtEnd,
  } = input;

  const categories: ManifestCategory[] = (Object.keys(CATEGORY_LABELS) as CategoryKey[]).map((key) => ({
    key,
    label: CATEGORY_LABELS[key],
    databaseCount: dataset.meta.databaseCounts[key] ?? null,
    exportedCount: dataset.meta.fetchedCounts[key] ?? 0,
    included: true,
    files: [`${RAW_FOLDER}/${CATEGORY_FILE_NAMES[key]}`],
  }));

  const reportArtifacts: BackupArtifact[] = reports.map((report) => ({
    path: `${PDF_FOLDER}/${report.file}`,
    kind: "pdf",
    bytes: report.buffer.length,
    sha256: sha256(report.buffer),
    pages: report.pages,
    reportKey: report.reportKey,
  }));

  const rawArtifacts: BackupArtifact[] = [
    ...rawFiles.map((file) => ({
      path: file.path,
      kind: "csv" as const,
      bytes: file.buffer.length,
      sha256: sha256(file.buffer),
      rows: file.rows,
    })),
    {
      path: `${RAW_FOLDER}/${COMPLETE_JSON_FILE_NAME}`,
      kind: "json" as const,
      bytes: jsonBuffer.length,
      sha256: sha256(jsonBuffer),
      rows: Object.values(dataset.meta.fetchedCounts).reduce((sum, value) => sum + value, 0),
    },
  ];

  const totalRecords = Object.values(dataset.meta.fetchedCounts).reduce((sum, value) => sum + value, 0);
  const totalPdfPages = reports.reduce((sum, report) => sum + report.pages, 0);

  const notes = [
    "This archive is a read-only export. No CRM record, deal, payment, follow-up, notification or sync version was created, updated or deleted while producing it.",
    "The backup covers all time and applies no date filter and no record limit to the raw data files.",
    "PDF reports are management documents: individual tables print at most 2,500 rows and always disclose when that display limit is reached, naming the raw file that holds the complete set.",
    "Authentication material (User.passwordHash) and private push-notification keys (MobilePushSubscription) are excluded by design; see excludedCategories.",
    "The user directory is included so activity authorship can be restored; it contains no credentials.",
    "JSON and CSV files preserve stable record ids and relationship keys for a potential future restore. No destructive restore/import is performed or implied by this backup.",
    ...(dataset.meta.warnings.length ? [`Collection warnings: ${dataset.meta.warnings.join(" ")}`] : []),
    ...(input.extraNotes ?? []),
  ];

  return {
    backupName: fileName,
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    recordFormatVersion: RECORD_FORMAT_VERSION,
    schemaBaselineMigration: SCHEMA_BASELINE_MIGRATION,
    applicationName: "Scale Flow CRM",
    generatedAtUtc: generatedAt.toISOString(),
    generatedAtIst,
    generatedBy: {
      userId: actor.id,
      name: actor.name,
      email: actor.email,
      role: actor.role,
    },
    scope: "all-time-complete",
    dateFilter: "none",
    snapshot: {
      mode: dataset.meta.snapshotMode,
      note: dataset.meta.snapshotNote,
      batchSize: dataset.meta.batchSize,
      batches: dataset.meta.batchCount,
      crmSyncVersionAtStart: dataset.meta.crmSyncVersionAtStart,
      crmSyncVersionAtEnd,
      businessRecordsModifiedByExport: false,
    },
    categories,
    excludedCategories: EXCLUDED_CATEGORIES,
    reports: reportArtifacts,
    rawData: rawArtifacts,
    totals: {
      totalRecords,
      totalArtifacts: reportArtifacts.length + rawArtifacts.length + 1,
      totalPdfPages,
    },
    integrity: {
      validationPassed: validation.passed,
      criticalFailureCount: validation.criticalFailures.length,
      warningCount: validation.warnings.length,
      checks: validation.checks,
      financialReconciliation: validation.financialReconciliation,
      archiveIntegrity: {
        artifactEntries: archiveIntegrity.entryCount,
        artifactBytes: archiveIntegrity.totalBytes,
        crcVerified: archiveIntegrity.valid,
        note:
          "Every artifact entry (PDF reports, CSV files and the complete JSON export) was inflated and CRC-32 verified against the archive directory. " +
          "The manifest entry itself is verified by the ZIP central directory CRC-32 that unzip tools re-check on extraction.",
      },
    },
    generation: {
      durationMs,
      generatedAt: generatedAt.toISOString(),
    },
    notes,
  };
}