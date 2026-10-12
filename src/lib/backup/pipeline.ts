import { db } from "@/lib/db";
import { formatISTDate, formatISTDateTime } from "@/lib/export/formatters";
import { buildBackupAnalytics } from "./analytics";
import { collectBackupDataset } from "./collector";
import { PDF_FOLDER, RAW_FOLDER } from "./constants";
import { MANIFEST_FILE_NAME, buildManifest, sha256 } from "./manifest";
import { buildCompleteExportJson, buildRawDataFiles, rawFileRowCounts } from "./raw-data";
import {
  buildRecordSummary,
  generateAllReports,
  generateReport,
  type GeneratedReport,
  type ReportContext,
} from "./pdf/reports";
import type { PdfVerification } from "./pdf/verify";
import { loadBackupFonts } from "./pdf/fonts";
import {
  BackupValidationError,
  mergeValidation,
  validateArchive,
  validateBackup,
  type ValidateBackupInput,
} from "./validation";
import { createZip, inspectZip } from "./zip";
import type {
  BackupDataset,
  BackupManifest,
  BackupProgressReporter,
  BackupValidation,
  CategoryKey,
  CompleteBackupResult,
  GeneratedRawFile,
  ZipEntryInput,
  ZipIntegrityReport,
} from "./types";
import type { BackupActor } from "./auth";
import type { ReportKey } from "./types";

export interface GenerateBackupOptions {
  actor: BackupActor;
  onProgress?: BackupProgressReporter;
  batchSize?: number;
  now?: Date;
}

/** Read-only lookup of the CRM sync version (used to prove the export mutated nothing). */
async function readCrmSyncVersion(): Promise<number | null> {
  try {
    const state = await db.crmSyncState.findUnique({ where: { id: "global" } });
    return state ? Number(state.version) : 0;
  } catch {
    return null;
  }
}

export function backupFileName(now: Date): string {
  return `ScaleFlow_CRM_Backup_${formatISTDate(now)}.zip`;
}

export interface PreparedBackupContext {
  dataset: BackupDataset;
  analytics: ReturnType<typeof buildBackupAnalytics>;
  reportContext: ReportContext;
  settings: {
    generatedAtIst: string;
    generatedAtUtc: string;
    generatedByName: string;
    generatedByEmail: string;
    scopeNote: string;
    warnings: string[];
    recordSummary: Array<{ label: string; value: string }>;
  };
  generatedAtUtc: string;
  generatedAtIst: string;
}

/**
 * Collects the snapshot and prepares everything the report renderers need. Shared by the complete
 * backup pipeline and by the individual-report download so both always agree on the numbers.
 */
export async function prepareBackupContext(
  options: Pick<GenerateBackupOptions, "actor" | "batchSize" | "allowSnapshotTransaction" | "now" | "onProgress">
): Promise<PreparedBackupContext> {
  const report: BackupProgressReporter = options.onProgress ?? (() => {});

  const progressByCategory = new Map<CategoryKey, { fetched: number; total: number }>();
  const collection = await collectBackupDataset({
    batchSize: options.batchSize,
    allowSnapshotTransaction: options.allowSnapshotTransaction,
    onProgress: (progress) => {
      progressByCategory.set(progress.key, { fetched: progress.fetched, total: progress.total });
      const totals = [...progressByCategory.values()];
      const fetched = totals.reduce((sum, entry) => sum + entry.fetched, 0);
      const expected = totals.reduce((sum, entry) => sum + Math.max(entry.total, entry.fetched), 0);
      const fraction = expected > 0 ? fetched / expected : 0.5;
      report({
        stage: "collecting",
        percent: 4 + Math.round(fraction * 38),
        message: `Collecting ${progress.label} — ${progress.fetched.toLocaleString("en-IN")} of ${Math.max(
          progress.total,
          progress.fetched
        ).toLocaleString("en-IN")} rows`,
      });
    },
  });

  const dataset = collection.dataset;
  report({ stage: "analysing", percent: 45, message: "Calculating business metrics with the canonical financial engine" });
  const analytics = buildBackupAnalytics(dataset);

  const generatedAtUtc = now.toISOString();
  const generatedAtIst = formatISTDateTime(now);
  const recordSummary = buildRecordSummary(dataset, analytics);

  const reportContext: ReportContext = {
    dataset,
    analytics,
    file: {
      generatedAtUtc,
      generatedAtIst,
      generatedByName: options.actor.name,
      generatedByEmail: options.actor.email,
      scopeNote: "All time · no date filter applied",
      warnings: dataset.meta.warnings,
      recordSummary,
    },
  };

  return {
    dataset,
    analytics,
    reportContext,
    settings: {
      generatedAtIst,
      generatedAtUtc,
      generatedByName: options.actor.name,
      generatedByEmail: options.actor.email,
      scopeNote: reportContext.file.scopeNote,
      warnings: dataset.meta.warnings,
      recordSummary,
    },
    generatedAtUtc,
    generatedAtIst,
  };
}

export interface SingleReportResult {
  filename: string;
  buffer: Buffer;
  pages: number;
  verification: PdfVerification;
  generatedAtIst: string;
}

/** Generates one PDF report on demand (used by the "download a single report" action). */
export async function generateSingleReport(
  options: Pick<GenerateBackupOptions, "actor" | "batchSize" | "allowSnapshotTransaction" | "now" | "onProgress"> & {
    reportKey: ReportKey;
  }
): Promise<SingleReportResult> {
  const prepared = await prepareBackupContext(options);
  const report: GeneratedReport = await generateReport(options.reportKey, prepared.reportContext, prepared.settings);
  return {
    filename: report.file,
    buffer: report.buffer,
    pages: report.pages,
    verification: report.verification,
    generatedAtIst: prepared.generatedAtIst,
  };
}

/**
 * Collects, reports, validates and packages the complete CRM backup.
 *
 * Read-only by construction: every database interaction is a SELECT inside one repeatable-read
 * snapshot (with a documented sequential fallback), and the only writes performed anywhere in this
 * module are to the temporary ZIP artifact on disk — never to business data.
 */
export async function generateCompleteBackup(options: GenerateBackupOptions): Promise<CompleteBackupResult> {
  const now = options.now ?? new Date();
  const report: BackupProgressReporter = options.onProgress ?? (() => {});
  const startedAt = Date.now();

  /* ------------------------------ 1. Collect ------------------------------- */

  report({ stage: "preparing", percent: 2, message: "Preparing the read-only database snapshot" });

  const progressByCategory = new Map<CategoryKey, { fetched: number; total: number }>();
  const collection = await collectBackupDataset({
    batchSize: options.batchSize,
    allowSnapshotTransaction: options.allowSnapshotTransaction,
    onProgress: (progress) => {
      progressByCategory.set(progress.key, { fetched: progress.fetched, total: progress.total });
      const totals = [...progressByCategory.values()];
      const fetched = totals.reduce((sum, entry) => sum + entry.fetched, 0);
      const expected = totals.reduce((sum, entry) => sum + Math.max(entry.total, entry.fetched), 0);
      const fraction = expected > 0 ? fetched / expected : 0.5;
      report({
        stage: "collecting",
        percent: 4 + Math.round(fraction * 38),
        message: `Collecting ${progress.label} — ${progress.fetched.toLocaleString("en-IN")} of ${Math.max(
          progress.total,
          progress.fetched
        ).toLocaleString("en-IN")} rows`,
      });
    },
  });

  const dataset: BackupDataset = collection.dataset;

  /* ------------------------------ 2. Analyse ------------------------------- */

  report({ stage: "analysing", percent: 45, message: "Calculating business metrics with the canonical financial engine" });
  const analytics = buildBackupAnalytics(dataset);

  /* --------------------------- 3. Raw data files --------------------------- */

  report({ stage: "raw-data", percent: 50, message: "Serialising machine-readable CSV and JSON backup files" });
  const rawFiles: GeneratedRawFile[] = buildRawDataFiles(dataset);
  const generatedAtUtc = now.toISOString();
  const generatedAtIst = formatISTDateTime(now);
  const jsonBuffer = Buffer.from(
    buildCompleteExportJson({
      dataset,
      analytics,
      generatedAt: generatedAtUtc,
      generatedBy: {
        id: options.actor.id,
        name: options.actor.name,
        email: options.actor.email,
        role: options.actor.role,
      },
    }),
    "utf8"
  );

  /* ------------------------------ 4. Reports ------------------------------- */

  const fonts = loadBackupFonts();
  const warnings = [...dataset.meta.warnings, ...fonts.warnings];
  const reportContext: ReportContext = {
    dataset,
    analytics,
    file: {
      generatedAtUtc,
      generatedAtIst,
      generatedByName: options.actor.name,
      generatedByEmail: options.actor.email,
      scopeNote: "All time · no date filter applied",
      warnings: dataset.meta.warnings,
      recordSummary: buildRecordSummary(dataset, analytics),
    },
  };

  const reports: GeneratedReport[] = await generateAllReports(
    reportContext,
    {
      generatedAtIst,
      generatedAtUtc,
      generatedByName: options.actor.name,
      generatedByEmail: options.actor.email,
      scopeNote: reportContext.file.scopeNote,
      warnings: dataset.meta.warnings,
      recordSummary: reportContext.file.recordSummary,
    },
    (key, index, total) => {
      report({
        stage: "reports",
        percent: 54 + Math.round((index / Math.max(1, total)) * 30),
        message: `Generating PDF reports — ${index + 1} of ${total} (${key.replace(/-/g, " ")})`,
      });
    }
  );

  /* ------------------------ 5. Content verification ------------------------ */

  report({ stage: "verifying", percent: 86, message: "Verifying record coverage, relationships and financial totals" });

  const crmSyncVersionAtEnd = await readCrmSyncVersion();

  const validationInput: ValidateBackupInput = {
    dataset,
    analytics,
    reports,
    rawFiles: rawFiles.map((file) => ({ path: file.path, rows: file.rows })),
    jsonTableCounts: {
      users: dataset.users.length,
      leads: dataset.leads.length,
      deals: dataset.deals.length,
      payments: dataset.payments.length,
      followUps: dataset.followUps.length,
      activities: dataset.activities.length,
      aiInsights: dataset.aiInsights.length,
      lossEvents: dataset.lossEvents.length,
      personalNotes: dataset.personalNotes.length,
      websitePackages: dataset.packages.length,
      websiteSamples: dataset.samples.length,
      whatsappTemplates: dataset.templates.length,
      salesNotifications: dataset.notifications.length,
      dailyBriefings: dataset.briefings.length,
      undoActions: dataset.undoActions.length,
      dispatchedMobileAlerts: dataset.mobileAlerts.length,
    },
    crmSyncVersionAtEnd,
  };

  const contentValidation = validateBackup(validationInput);

  /* ------------------------------ 6. Package ------------------------------- */

  report({ stage: "packaging", percent: 91, message: "Packaging the backup archive" });

  const artifactEntries: ZipEntryInput[] = [
    ...reports.map((entry) => ({ path: `${PDF_FOLDER}/${entry.file}`, data: entry.buffer })),
    ...rawFiles.map((entry) => ({ path: entry.path, data: entry.buffer })),
    { path: `${RAW_FOLDER}/complete_crm_export.json`, data: jsonBuffer },
  ];

  const buildManifestFor = (validation: BackupValidation): BackupManifest =>
    buildManifest({
      fileName: backupFileName(now),
      generatedAt: now,
      generatedAtIst,
      durationMs: Date.now() - startedAt,
      actor: options.actor,
      dataset,
      validation,
      reports,
      rawFiles,
      jsonBuffer,
      archiveIntegrity: artifactIntegrity,
      crmSyncVersionAtEnd,
      extraNotes: [],
    });

  const buildArchive = (manifest: BackupManifest): Buffer =>
    createZip(
      [...artifactEntries, { path: MANIFEST_FILE_NAME, data: Buffer.from(JSON.stringify(manifest, null, 2), "utf8") }],
      { date: now }
    );

  // Pass 1 — verify the artifact entries (PDF/CSV/JSON) and measure the archive.
  const artifactIntegrity = inspectZip(createZip(artifactEntries, { date: now }));
  artifactIntegrity.scope = "artifact entries";

  const expectedEntryCount = artifactEntries.length + 1; // + the manifest

  // Pass 2 — build the archive with the manifest, then verify the finished container.
  const firstArchive = buildArchive(buildManifestFor(contentValidation));
  const firstIntegrity = inspectZip(firstArchive);
  firstIntegrity.scope = "final archive";
  const archiveChecks = validateArchive(firstIntegrity, expectedEntryCount);
  const mergedValidation = mergeValidation(contentValidation, archiveChecks);

  if (!mergedValidation.passed) {
    throw new BackupValidationError(mergedValidation.criticalFailures);
  }

  // Pass 3 — rebuild so the delivered manifest carries the merged validation, then re-verify.
  const finalManifest = buildManifestFor(mergedValidation);
  const finalArchive = buildArchive(finalManifest);
  const finalIntegrity = inspectZip(finalArchive);
  finalIntegrity.scope = "final archive";
  const finalChecks = validateArchive(finalIntegrity, expectedEntryCount);
  const finalValidation = mergeValidation(contentValidation, finalChecks);

  if (!finalValidation.passed) {
    throw new BackupValidationError(finalValidation.criticalFailures);
  }

  report({ stage: "ready", percent: 100, message: "Backup ready — validating and preparing your download" });

  return {
    filename: backupFileName(now),
    zipBuffer: finalArchive,
    manifest: finalManifest,
    validation: finalValidation,
    zipIntegrity: finalIntegrity,
    checksumSha256: sha256(finalArchive),
    pagesByReport: reports.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.reportKey] = entry.pages;
      return acc;
    }, {}),
    bytes: finalArchive.length,
  };
}

/** Row/filename helpers exposed for the API layer and tests. */
export function rawFileSummary(files: GeneratedRawFile[]): Record<string, number> {
  return rawFileRowCounts(files);
}