import type { ReportDefinition, ReportKey } from "./types";

/**
 * ==============================================================================
 * COMPLETE CRM BACKUP — VERSIONS & CATALOGUE
 * ==============================================================================
 *
 * BACKUP_FORMAT_VERSION  — version of the ZIP layout / manifest contract.
 * SCHEMA_BASELINE        — the Prisma migration head this export was written against.
 * RECORD_FORMAT_VERSION  — version of the per-record serialization contract (CSV/JSON).
 *
 * Bump a version whenever the corresponding contract changes so that a future
 * restore tool can reason about the payload it is reading.
 */
export const BACKUP_FORMAT_VERSION = "1.0.0";

export const RECORD_FORMAT_VERSION = "1.0.0";

export const SCHEMA_BASELINE_MIGRATION = "20261009000000_allow_multiple_deals_per_client";

export const BACKUP_TIMEZONE = "Asia/Kolkata";

/** ZIP entry folders (mirrors the documented folder contract). */
export const PDF_FOLDER = "PDF Reports";
export const RAW_FOLDER = "Raw Data";

/**
 * Rows fetched per query while walking a table. Every category is paginated with a
 * stable `orderBy id` + cursor walk so a growing dataset can never be silently truncated.
 */
export const DEFAULT_BATCH_SIZE = 500;

/**
 * Interactive (snapshot) transaction ceiling. Generous because the collector performs
 * every read of the backup inside ONE repeatable-read transaction so that the exported
 * tables are mutually consistent even while writes are happening concurrently.
 */
export const SNAPSHOT_TRANSACTION_TIMEOUT_MS = 10 * 60 * 1000;
export const SNAPSHOT_TRANSACTION_MAX_WAIT_MS = 20 * 1000;

/** How long a generated ZIP artifact is allowed to live on disk before the sweeper removes it. */
export const BACKUP_ARTIFACT_TTL_MS = 15 * 60 * 1000;

/**
 * Every *raw* backup file contains 100% of the records with no limit. The human-readable PDF
 * tables display at most this many rows per table so a report stays openable; whenever the cap
 * is reached the PDF prints an explicit disclosure naming the file that holds the full set.
 */
export const REPORT_TABLE_ROW_CAP = 2500;

/**
 * Report catalogue. The numeric prefix keeps a stable, self-describing folder order in the ZIP.
 * `critical: true` reports are mandatory — if one of them cannot be produced, the ZIP is NOT
 * labelled as a successful complete backup.
 */
export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    key: "overview",
    file: "01_CRM_Overview.pdf",
    title: "CRM Overview",
    subtitle: "Executive summary of the complete business dataset",
    description: "Business totals, lead distribution, sales performance, deal and payment totals, outstanding balances and follow-up health.",
    critical: true,
  },
  {
    key: "sales",
    file: "02_Sales_Report.pdf",
    title: "Sales Report",
    subtitle: "Funnel, conversion and won/lost history",
    description: "Lead statuses, sales funnel, conversion metrics, won/lost history, project values, sales performance and open opportunities.",
    critical: true,
  },
  {
    key: "finance",
    file: "03_Finance_Report.pdf",
    title: "Finance Report",
    subtitle: "Contracted value, collections and receivables",
    description: "Every eligible deal, contracted amounts, individual payment transactions with dates/modes/references, received amounts and outstanding balances.",
    critical: true,
  },
  {
    key: "leads",
    file: "04_All_Leads.pdf",
    title: "All Leads",
    subtitle: "Complete lead register including historical records",
    description: "Every lead — current, waste, lost, deleted and merged — with contact details, status, industry, quotes, notes and linked projects.",
    critical: true,
  },
  {
    key: "projects-deals",
    file: "05_Projects_and_Deals.pdf",
    title: "Projects & Deals",
    subtitle: "Per-client project ledger",
    description: "Each project listed separately under its CRM client or Other client, with amounts, dates, independent payment summaries and outstanding values.",
    critical: true,
  },
  {
    key: "followups",
    file: "06_Followups_Report.pdf",
    title: "Follow-ups Report",
    subtitle: "Pending, completed, cancelled and overdue follow-ups",
    description: "Full follow-up history with scheduled dates, status, associated client and notes.",
    critical: true,
  },
  {
    key: "activities-notes",
    file: "07_Activities_and_Notes.pdf",
    title: "Activities & Notes",
    subtitle: "Client activities, call outcomes and notes",
    description: "Client activities, call outcomes, lead notes, personal notes, timestamps and associated records.",
    critical: true,
  },
  {
    key: "other-records",
    file: "08_Other_CRM_Records.pdf",
    title: "Other CRM Records",
    subtitle: "Sales assets, operational history and supporting records",
    description: "Packages, samples, WhatsApp templates, loss events, notifications, daily briefings, AI insights, undo history and excluded-category disclosure.",
    critical: true,
  },
];

export const REPORT_KEYS: ReportKey[] = REPORT_DEFINITIONS.map((r) => r.key);

export function getReportDefinition(key: ReportKey): ReportDefinition {
  const found = REPORT_DEFINITIONS.find((r) => r.key === key);
  if (!found) {
    throw new Error(`Unknown backup report key: ${key}`);
  }
  return found;
}

/**
 * Categories deliberately withheld from the backup, with the reason recorded in the manifest.
 * These hold credentials or private notification transport keys.
 */
export const EXCLUDED_CATEGORIES = [
  {
    key: "userCredentials",
    label: "User credentials",
    reason:
      "Password hashes and authentication material (User.passwordHash) are never exported. Only the non-sensitive user directory fields (id, name, email, role, timestamps) are included so that activity authorship stays restorable.",
  },
  {
    key: "mobilePushSubscriptions",
    label: "Mobile push subscriptions",
    reason:
      "Web-push transport keys (endpoint, p256dh, auth) are private notification credentials and are never exported.",
  },
] as const;

/** Progress stage labels surfaced to the UI. */
export const BACKUP_STAGES = {
  preparing: "Preparing data",
  collecting: "Collecting CRM records",
  analysing: "Calculating business metrics",
  reports: "Generating PDF reports",
  "raw-data": "Serialising raw backup files",
  verifying: "Verifying records",
  packaging: "Packaging backup",
  ready: "Ready to download",
  failed: "Backup failed",
} as const;

/** Human-readable category labels used in progress reporting, manifests and reports. */
export const CATEGORY_LABELS: Record<string, string> = {
  users: "CRM users",
  leads: "Leads",
  deals: "Projects & Deals",
  payments: "Payment transactions",
  followUps: "Follow-ups",
  activities: "Activities",
  aiInsights: "AI insights",
  lossEvents: "Loss events",
  personalNotes: "Personal notes",
  packages: "Website packages",
  samples: "Website samples",
  templates: "WhatsApp templates",
  notifications: "Sales notifications",
  briefings: "Daily briefings",
  undoActions: "Undo history",
  mobileAlerts: "Mobile alert log",
};

export const BACKUP_FALLBACK_WARNING =
  "Non-ASCII characters outside the embedded font coverage were transliterated or replaced to avoid broken glyphs. The raw CSV/JSON files always contain the original text.";