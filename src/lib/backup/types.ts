import type {
  DailySalesBriefing,
  Deal,
  DispatchedMobileAlert,
  FollowUp,
  Lead,
  LeadActivity,
  LeadAIInsight,
  LeadLossEvent,
  Payment,
  PersonalNote,
  SalesNotification,
  UndoAction,
  WebsitePackage,
  WebsiteSample,
  WhatsAppTemplate,
} from "@prisma/client";

/* -------------------------------------------------------------------------- */
/*  Reports                                                                    */
/* -------------------------------------------------------------------------- */

export type ReportKey =
  | "overview"
  | "sales"
  | "finance"
  | "leads"
  | "projects-deals"
  | "followups"
  | "activities-notes"
  | "other-records";

export interface ReportDefinition {
  key: ReportKey;
  file: string;
  title: string;
  subtitle: string;
  description: string;
  critical: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Dataset                                                                    */
/* -------------------------------------------------------------------------- */

export type CategoryKey =
  | "users"
  | "leads"
  | "deals"
  | "payments"
  | "followUps"
  | "activities"
  | "aiInsights"
  | "lossEvents"
  | "personalNotes"
  | "packages"
  | "samples"
  | "templates"
  | "notifications"
  | "briefings"
  | "undoActions"
  | "mobileAlerts";

export type SnapshotMode = "transaction-repeatable-read" | "sequential-batched";

/**
 * Non-sensitive projection of the User table. `passwordHash` is intentionally absent from
 * this type so it can never reach a CSV, a JSON payload or a PDF.
 */
export interface BackupUserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatasetMeta {
  snapshotMode: SnapshotMode;
  snapshotNote: string;
  batchSize: number;
  batchCount: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  crmSyncVersionAtStart: number | null;
  /** Row counts observed directly from the database (COUNT) per category. */
  databaseCounts: Record<CategoryKey, number | null>;
  /** Row counts actually materialised by the collector per category. */
  fetchedCounts: Record<CategoryKey, number>;
  warnings: string[];
}

/**
 * Every record set is flat (no nested includes) and keyed by its stable primary id so the
 * backup keeps relationships restorable: Deal.leadId -> Lead.id, Payment.dealId -> Deal.id, ...
 */
export interface BackupDataset {
  meta: DatasetMeta;
  users: BackupUserRecord[];
  leads: Lead[];
  deals: Deal[];
  payments: Payment[];
  followUps: FollowUp[];
  activities: LeadActivity[];
  aiInsights: LeadAIInsight[];
  lossEvents: LeadLossEvent[];
  personalNotes: PersonalNote[];
  packages: WebsitePackage[];
  samples: WebsiteSample[];
  templates: WhatsAppTemplate[];
  notifications: SalesNotification[];
  briefings: DailySalesBriefing[];
  undoActions: UndoAction[];
  mobileAlerts: DispatchedMobileAlert[];
}

/* -------------------------------------------------------------------------- */
/*  Manifest                                                                   */
/* -------------------------------------------------------------------------- */

export interface ManifestCategory {
  key: CategoryKey;
  label: string;
  databaseCount: number | null;
  exportedCount: number;
  included: boolean;
  files: string[];
}

export interface BackupArtifact {
  path: string;
  kind: "pdf" | "csv" | "json";
  bytes: number;
  sha256: string;
  rows?: number;
  pages?: number;
  reportKey?: ReportKey;
}

export interface FinancialReconciliation {
  contractedDealValue: number;
  moneyReceived: number;
  outstanding: number;
  collectionRate: number;
  wonDealValue: number;
  dealLevelReceivedSum: number;
  paymentLevelReceivedSum: number;
  dealLevelOutstandingSum: number;
  clientsWithMultipleDeals: number;
  crmClientDeals: number;
  otherClientDeals: number;
}

export interface ValidationCheck {
  id: string;
  label: string;
  critical: boolean;
  passed: boolean;
  expected?: string | number | null;
  actual?: string | number | null;
  detail?: string;
}

export interface BackupValidation {
  passed: boolean;
  criticalFailures: ValidationCheck[];
  warnings: ValidationCheck[];
  checks: ValidationCheck[];
  financialReconciliation: FinancialReconciliation;
}

export interface BackupManifest {
  backupName: string;
  backupFormatVersion: string;
  recordFormatVersion: string;
  schemaBaselineMigration: string;
  applicationName: string;
  generatedAtUtc: string;
  generatedAtIst: string;
  generatedBy: {
    userId: string;
    name: string;
    email: string;
    role: string;
  };
  scope: "all-time-complete";
  dateFilter: "none";
  snapshot: {
    mode: SnapshotMode;
    note: string;
    batchSize: number;
    batches: number;
    crmSyncVersionAtStart: number | null;
    crmSyncVersionAtEnd: number | null;
    businessRecordsModifiedByExport: false;
  };
  categories: ManifestCategory[];
  excludedCategories: ReadonlyArray<{ key: string; label: string; reason: string }>;
  reports: BackupArtifact[];
  rawData: BackupArtifact[];
  totals: {
    totalRecords: number;
    totalArtifacts: number;
    totalPdfPages: number;
  };
  integrity: {
    validationPassed: boolean;
    criticalFailureCount: number;
    warningCount: number;
    checks: ValidationCheck[];
    financialReconciliation: FinancialReconciliation;
    /**
     * Verification of the backup's artifact entries (PDF/CSV/JSON). The manifest cannot contain a
     * hash of itself, so the archive as a whole — including this manifest entry — is validated by
     * the ZIP central directory CRC-32 that every unzip tool re-checks on extraction.
     */
    archiveIntegrity: {
      artifactEntries: number;
      artifactBytes: number;
      crcVerified: boolean;
      note: string;
    };
  };
  generation: {
    durationMs: number;
    generatedAt: string;
  };
  notes: string[];
}

/* -------------------------------------------------------------------------- */
/*  ZIP                                                                        */
/* -------------------------------------------------------------------------- */

export interface ZipEntryInput {
  path: string;
  data: Buffer;
}

export interface ZipEntryInfo {
  path: string;
  compressedSize: number;
  size: number;
  crc32: number;
  method: number;
}

export interface ZipIntegrityReport {
  valid: boolean;
  entryCount: number;
  totalBytes: number;
  entries: ZipEntryInfo[];
  errors: string[];
  /** What the report covers (for example "artifact entries" or "final archive"). */
  scope?: string;
}

/* -------------------------------------------------------------------------- */
/*  Pipeline                                                                   */
/* -------------------------------------------------------------------------- */

export type BackupStage =
  | "preparing"
  | "collecting"
  | "analysing"
  | "reports"
  | "raw-data"
  | "verifying"
  | "packaging"
  | "ready"
  | "failed";

export interface BackupProgressEvent {
  stage: BackupStage;
  percent: number;
  message: string;
}

export type BackupProgressReporter = (event: BackupProgressEvent) => void;

export interface GeneratedPdf {
  reportKey: ReportKey;
  path: string;
  buffer: Buffer;
  pages: number;
}

export interface GeneratedRawFile {
  path: string;
  buffer: Buffer;
  rows: number;
}

export interface CompleteBackupResult {
  filename: string;
  zipBuffer: Buffer;
  manifest: BackupManifest;
  validation: BackupValidation;
  zipIntegrity: ZipIntegrityReport;
  checksumSha256: string;
  pagesByReport: Record<string, number>;
  bytes: number;
}

/* -------------------------------------------------------------------------- */
/*  Job registry                                                               */
/* -------------------------------------------------------------------------- */

export type BackupJobStatus = "running" | "ready" | "failed" | "downloaded" | "expired";

export interface BackupJobSnapshot {
  jobId: string;
  status: BackupJobStatus;
  stage: BackupStage;
  percent: number;
  message: string;
  startedAt: string;
  updatedAt: string;
  filename: string | null;
  bytes: number | null;
  checksumSha256: string | null;
  expiresAt: string | null;
  error: string | null;
  summary: {
    totalRecords: number;
    totalArtifacts: number;
    totalPdfPages: number;
    validationPassed: boolean;
    criticalFailureCount: number;
    warningCount: number;
    categories: ManifestCategory[];
  } | null;
}