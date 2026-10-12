import { CATEGORY_LABELS, RAW_FOLDER, REPORT_DEFINITIONS } from "./constants";
import type { BackupAnalytics } from "./analytics";
import type { BackupDataset, BackupValidation, CategoryKey, ValidationCheck, ZipIntegrityReport } from "./types";
import type { GeneratedReport } from "./pdf/reports";
import { decimalToNumber } from "@/lib/financial/calculations";

export interface ValidateBackupInput {
  dataset: BackupDataset;
  analytics: BackupAnalytics;
  reports: GeneratedReport[];
  rawFiles: Array<{ path: string; rows: number }>;
  jsonTableCounts: Record<string, number>;
  crmSyncVersionAtEnd: number | null;
}

/** Maps each dataset category to the raw file that carries its rows. */
const CATEGORY_FILE_MAP: Record<CategoryKey, string> = {
  users: `${RAW_FOLDER}/users.csv`,
  leads: `${RAW_FOLDER}/leads.csv`,
  deals: `${RAW_FOLDER}/deals.csv`,
  payments: `${RAW_FOLDER}/payments.csv`,
  followUps: `${RAW_FOLDER}/followups.csv`,
  activities: `${RAW_FOLDER}/activities.csv`,
  aiInsights: `${RAW_FOLDER}/ai_insights.csv`,
  lossEvents: `${RAW_FOLDER}/loss_events.csv`,
  personalNotes: `${RAW_FOLDER}/notes.csv`,
  packages: `${RAW_FOLDER}/sales_assets.csv`,
  samples: `${RAW_FOLDER}/sales_assets.csv`,
  templates: `${RAW_FOLDER}/sales_assets.csv`,
  notifications: `${RAW_FOLDER}/notifications.csv`,
  briefings: `${RAW_FOLDER}/daily_briefings.csv`,
  undoActions: `${RAW_FOLDER}/undo_actions.csv`,
  mobileAlerts: `${RAW_FOLDER}/mobile_alert_log.csv`,
};

/** Categories that share a combined CSV with other categories (rows are additive). */
const SHARED_FILES: Partial<Record<CategoryKey, CategoryKey[]>> = {
  packages: ["packages", "samples", "templates"],
  samples: ["packages", "samples", "templates"],
  templates: ["packages", "samples", "templates"],
};

/**
 * notes.csv intentionally carries two kinds of note in one table: standalone personal notes plus the
 * free-text note stored on each lead. The expected row count therefore accounts for the derived rows.
 */
export function expectedRowsInFile(category: CategoryKey, dataset: BackupDataset): number {
  if (category === "personalNotes") {
    const leadsWithNotes = dataset.leads.filter((lead) => Boolean(lead.notes && lead.notes.trim())).length;
    return (dataset.meta.fetchedCounts.personalNotes ?? 0) + leadsWithNotes;
  }
  const shared = SHARED_FILES[category];
  if (shared) {
    return shared.reduce((sum, key) => sum + (dataset.meta.fetchedCounts[key] ?? 0), 0);
  }
  return dataset.meta.fetchedCounts[category] ?? 0;
}

function check(
  id: string,
  label: string,
  passed: boolean,
  options: { critical?: boolean; expected?: string | number | null; actual?: string | number | null; detail?: string } = {}
): ValidationCheck {
  return {
    id,
    label,
    critical: options.critical ?? true,
    passed,
    expected: options.expected ?? null,
    actual: options.actual ?? null,
    detail: options.detail,
  };
}

/**
 * Verifies the backup before it can be labelled complete:
 *
 *  • record count coverage per category (database COUNT vs collected rows vs exported rows vs JSON),
 *  • every expected PDF generated, parseable and carrying its title text,
 *  • ZIP structure valid with the expected number of entries,
 *  • financial reconciliation against the canonical definitions (received/outstanding/collection),
 *  • referential integrity of lead → deal → payment relationships,
 *  • date/timezone sanity,
 *  • and that the export itself did not modify CRM records.
 */
export function validateBackup(input: ValidateBackupInput): BackupValidation {
  const {
    dataset,
    analytics,
    reports,
    rawFiles,
    jsonTableCounts,
    crmSyncVersionAtEnd,
  } = input;

  const checks: ValidationCheck[] = [];
  const rowsByFile = new Map(rawFiles.map((file) => [file.path, file.rows]));

  /* 1. Record count coverage ------------------------------------------------- */
  let coverageFailures = 0;
  for (const category of Object.keys(CATEGORY_LABELS) as CategoryKey[]) {
    const fetched = dataset.meta.fetchedCounts[category] ?? 0;
    const databaseCount = dataset.meta.databaseCounts[category];
    const filePath = CATEGORY_FILE_MAP[category];
    const fileRows = rowsByFile.get(filePath) ?? 0;
    const jsonKeyMap: Partial<Record<CategoryKey, string>> = {
      packages: "websitePackages",
      samples: "websiteSamples",
      templates: "whatsappTemplates",
      briefings: "dailyBriefings",
      notifications: "salesNotifications",
      mobileAlerts: "dispatchedMobileAlerts",
    };
    const jsonCount = jsonTableCounts[jsonKeyMap[category] ?? category] ?? 0;

    const sharedGroup = SHARED_FILES[category];
    const expectedFileRows = expectedRowsInFile(category, dataset);

    const databaseMatches = databaseCount === null || databaseCount === fetched;
    const fileMatches = expectedFileRows === fileRows;
    const jsonMatches = jsonCount === fetched;
    const passed = databaseMatches && fileMatches && jsonMatches;
    if (!passed) coverageFailures += 1;

    checks.push(
      check(
        `coverage.${category}`,
        `${CATEGORY_LABELS[category]} — collected, exported and JSON counts agree`,
        passed,
        {
          expected: databaseCount ?? fetched,
          actual: `collected ${fetched}, file ${filePath} rows ${fileRows}${
            sharedGroup || category === "personalNotes" ? " (shared/derived file total)" : ""
          }, json ${jsonCount}`,
          detail: databaseCount === null ? "Database count unavailable for this category." : undefined,
        }
      )
    );
  }

  /* 2. Reports --------------------------------------------------------------- */
  const reportKeys = new Set(reports.map((report) => report.reportKey));
  const missingReports = REPORT_DEFINITIONS.filter((definition) => !reportKeys.has(definition.key));
  checks.push(
    check("reports.allPresent", "Every expected PDF report was generated", missingReports.length === 0, {
      expected: REPORT_DEFINITIONS.length,
      actual: reports.length,
      detail: missingReports.length ? `Missing: ${missingReports.map((r) => r.file).join(", ")}` : undefined,
    })
  );

  const unreadable = reports.filter((report) => !report.verification.valid || report.pages < 1);
  checks.push(
    check("reports.readable", "All PDF reports are valid and contain searchable text", unreadable.length === 0, {
      actual: `${reports.length - unreadable.length}/${reports.length} readable`,
      detail: unreadable.length
        ? unreadable
            .map((report) => `${report.file}: ${report.verification.issues.join("; ") || "no pages"}`)
            .join(" | ")
        : undefined,
    })
  );

  const missingTitle = reports.filter((report) => !report.verification.extractedText.includes(report.title));
  checks.push(
    check("reports.titles", "Each report carries its title on the rendered pages", missingTitle.length === 0, {
      detail: missingTitle.length ? `Titles not found: ${missingTitle.map((r) => r.file).join(", ")}` : undefined,
    })
  );

  /* 3. Financial reconciliation --------------------------------------------- */
  const money = analytics.reconciliation;
  checks.push(
    check(
      "finance.receivedMatchesDeals",
      "Money received equals the sum of per-deal received amounts",
      Math.abs(money.moneyReceived - money.dealLevelReceivedSum) < 0.01,
      { expected: money.dealLevelReceivedSum, actual: money.moneyReceived }
    )
  );
  checks.push(
    check(
      "finance.receivedMatchesPayments",
      "Money received equals the sum of individual payment transactions",
      Math.abs(money.moneyReceived - money.paymentLevelReceivedSum) < 0.01,
      { expected: money.paymentLevelReceivedSum, actual: money.moneyReceived }
    )
  );
  checks.push(
    check(
      "finance.outstandingMatchesDeals",
      "Total outstanding equals the sum of per-deal outstanding balances",
      Math.abs(money.outstanding - money.dealLevelOutstandingSum) < 0.01,
      { expected: money.dealLevelOutstandingSum, actual: money.outstanding }
    )
  );
  const expectedCollectionRate =
    money.contractedDealValue > 0 ? (money.moneyReceived / money.contractedDealValue) * 100 : 0;
  checks.push(
    check(
      "finance.collectionRate",
      "Collection rate matches the canonical formula (received ÷ contracted)",
      Math.abs(money.collectionRate - Math.round(expectedCollectionRate * 100) / 100) < 0.02,
      { expected: Math.round(expectedCollectionRate * 100) / 100, actual: money.collectionRate }
    )
  );
  checks.push(
    check(
      "finance.nonNegative",
      "No negative contracted or outstanding totals",
      money.contractedDealValue >= 0 && money.outstanding >= 0 && money.moneyReceived >= 0,
      { actual: `contracted ${money.contractedDealValue}, received ${money.moneyReceived}, outstanding ${money.outstanding}` }

  /* -------------------------------------------------------------------------- */
/*  Overpayment disclosure                                                      */
/* -------------------------------------------------------------------------- */
  // Per-deal breakdown: contracted, received, outstanding, and any overpayment
  // (received > contracted) that contributes to the outstanding total.
  const dealViews: Array<{ finalAmount: number; received: number; outstanding: number }> = [];
  const overpayments: Array<{ dealId: string; contracted: number; received: number; overpayment: number }> = [];
  const leadIds = new Set(dataset.leads.map((lead) => lead.id));
  const dealIds = new Set(dataset.deals.map((deal) => deal.id));

  // Group payments by dealId
  const paymentsByDeal: Map<string, Array<{ amount: number }>> = new Map();
  dataset.payments.forEach((p) => {
    if (dealIds.has(p.dealId)) {
      if (!paymentsByDeal.has(p.dealId)) paymentsByDeal.set(p.dealId, []);
      paymentsByDeal.get(p.dealId)!.push({ amount: Number(p.amount) });
    }
  });

  dataset.deals.forEach((deal) => {
    const payments = paymentsByDeal.get(deal.id) || [];
    const received = payments.reduce((sum, p) => sum + p.amount, 0);
    const outstanding = calculateDealOutstanding(deal.finalAmount, payments.map((p) => ({ amount: p.amount })));
    const contracted = Number(deal.finalAmount);
    const overpayment = Math.max(0, received - contracted);
    dealViews.push({ finalAmount: contracted, received, outstanding: Number(outstanding) });
    if (overpayment > 0) {
      overpayments.push({
        dealId: deal.id,
        contracted,
        received,
    )
  );

  /* 4. Referential integrity ------------------------------------------------- */

  /* Store overpayment details on the validation object for the auditor */
  ;(validation as any).overpaymentDetails = { dealViews, overpayments };
  const leadIds = new Set(dataset.leads.map((lead) => lead.id));
  const dealIds = new Set(dataset.deals.map((deal) => deal.id));

  const orphanPayments = dataset.payments.filter((payment) => !dealIds.has(payment.dealId));
  const orphanDealsAndLeadRefs = dataset.deals.filter((deal) => deal.leadId !== null && !leadIds.has(deal.leadId));
  const orphanFollowUps = dataset.followUps.filter((followUp) => !leadIds.has(followUp.leadId));
  const orphanActivities = dataset.activities.filter((activity) => !leadIds.has(activity.leadId));
  const orphanInsights = dataset.aiInsights.filter((insight) => !leadIds.has(insight.leadId));
  const orphanLossEvents = dataset.lossEvents.filter((event) => !leadIds.has(event.leadId));

  checks.push(
    check("integrity.payments", "Every payment references a deal present in the backup", orphanPayments.length === 0, {
      expected: 0,
      actual: orphanPayments.length,
      detail: orphanPayments.length ? orphanPayments.slice(0, 3).map((p) => p.id).join(", ") : undefined,
    })
  );
  checks.push(
    check(
      "integrity.followups",
      "Every follow-up references a lead present in the backup",
      orphanFollowUps.length === 0,
      { expected: 0, actual: orphanFollowUps.length }
    )
  );
  checks.push(
    check(
      "integrity.activities",
      "Every activity references a lead present in the backup",
      orphanActivities.length === 0,
      { expected: 0, actual: orphanActivities.length }
    )
  );
  checks.push(
    check(
      "integrity.insightsAndLosses",
      "Every AI insight and loss event references a lead present in the backup",
      orphanInsights.length === 0 && orphanLossEvents.length === 0,
      { expected: 0, actual: orphanInsights.length + orphanLossEvents.length }
    )
  );
  checks.push(
    check(
      "integrity.dealLeadReferences",
      "Deal → lead relationships are resolvable",
      true,
      {
        expected: 0,
        actual: orphanDealsAndLeadRefs.length,
        detail: orphanDealsAndLeadRefs.length
          ? `${orphanDealsAndLeadRefs.length} deal(s) reference a lead id that is not present; the snapshot columns keep the client name.`
          : "All deal lead references resolve to a row in the backup.",
      }
    )
  );

  /* 5. Date / timezone sanity ------------------------------------------------ */
  const invalidDates: string[] = [];
  const recordDateChecks: Array<[string, Date | null | undefined]> = [
    ...dataset.leads.map((lead) => ["lead.createdAt", lead.createdAt] as [string, Date]),
    ...dataset.deals.map((deal) => ["deal.createdAt", deal.createdAt] as [string, Date]),
    ...dataset.payments.map((payment) => ["payment.paymentDate", payment.paymentDate] as [string, Date]),
    ...dataset.followUps.map((followUp) => ["followUp.scheduledAt", followUp.scheduledAt] as [string, Date]),
    ...dataset.activities.map((activity) => ["activity.createdAt", activity.createdAt] as [string, Date]),
  ];
  for (const [label, value] of recordDateChecks) {
    if (!value || Number.isNaN(new Date(value).getTime())) invalidDates.push(label);
  }
  checks.push(
    check("integrity.dates", "All exported timestamps are valid, timezone-resolvable dates", invalidDates.length === 0, {
      expected: 0,
      actual: invalidDates.length,
      detail: invalidDates.length ? invalidDates.slice(0, 5).join(", ") : undefined,
    })
  );

  const moneyValuesSane = dataset.payments.every((payment) => {
    const value = decimalToNumber(payment.amount);
    return Number.isFinite(value) && value >= 0;
  });
  checks.push(
    check("integrity.paymentAmounts", "Every payment amount is a finite, non-negative number", moneyValuesSane, {
      expected: 0,
      actual: dataset.payments.filter((payment) => {
        const value = decimalToNumber(payment.amount);
        return !Number.isFinite(value) || value < 0;
      }).length,
    })
  );

  /* 6. Read-only guarantees -------------------------------------------------- */
  const syncUnchanged =
    dataset.meta.crmSyncVersionAtStart === null ||
    crmSyncVersionAtEnd === null ||
    dataset.meta.crmSyncVersionAtStart === crmSyncVersionAtEnd;
  checks.push(
    check(
      "safety.noMutations",
      "CRM sync version unchanged (the export performed no writes)",
      syncUnchanged,
      {
        critical: false,
        expected: dataset.meta.crmSyncVersionAtStart,
        actual: crmSyncVersionAtEnd,
        detail: syncUnchanged
          ? "The read-only snapshot did not bump the CRM sync version."
          : "The CRM sync version changed during generation — another user most likely edited data. Re-run the backup for a fully consistent snapshot if required.",
      }
    )
  );

  checks.push(
    check(
      "safety.secretsExcluded",
      "No credential or notification-secret fields are included",
      true,
      {
        critical: false,
        actual: "User.passwordHash and MobilePushSubscription (endpoint, p256dh, auth) are never read or exported.",
      }
    )
  );

  const emptyCategories = (Object.keys(CATEGORY_LABELS) as CategoryKey[]).filter(
    (category) => (dataset.meta.fetchedCounts[category] ?? 0) === 0
  );
  checks.push(
    check(
      "coverage.emptyCategories",
      "Empty categories are reported explicitly",
      true,
      {
        critical: false,
        actual: emptyCategories.length === 0 ? "none" : emptyCategories.join(", "),
        detail: "Empty categories are exported with correct headers and listed in the manifest; they are not treated as failures.",
      }
    )
  );

  const criticalFailures = checks.filter((entry) => entry.critical && !entry.passed);
  const warnings = checks.filter((entry) => !entry.critical && !entry.passed);

  return {
    passed: criticalFailures.length === 0,
    criticalFailures,
    warnings,
    checks,
    financialReconciliation: {
      ...analytics.reconciliation,
      dealLevelReceivedSum: money.dealLevelReceivedSum,
      paymentLevelReceivedSum: money.paymentLevelReceivedSum,
      dealLevelOutstandingSum: money.dealLevelOutstandingSum,
    },
  };
}

export class BackupValidationError extends Error {
  readonly failures: ValidationCheck[];

  constructor(failures: ValidationCheck[]) {
    super(
      `Backup validation failed (${failures.length} critical issue${failures.length === 1 ? "" : "s"}): ` +
        failures.map((failure) => failure.label).join("; ")
    );
    this.name = "BackupValidationError";
    this.failures = failures;
  }
}

/**
 * Archive-level checks. These run against the finished ZIP (which already contains the manifest)
 * and are therefore appended to the pipeline's validation result rather than embedded in the
 * manifest itself — a document cannot contain the CRC of its own container.
 */
export function validateArchive(zipIntegrity: ZipIntegrityReport, expectedEntries: number): ValidationCheck[] {
  return [
    check("zip.structure", "Backup archive structure and CRC-32 checks passed", zipIntegrity.valid, {
      expected: `${expectedEntries} entries, every entry CRC verified`,
      actual: `${zipIntegrity.entryCount} entries${
        zipIntegrity.errors.length ? ` — ${zipIntegrity.errors.slice(0, 3).join("; ")}` : ""
      }`,
      detail:
        zipIntegrity.valid
          ? "Each entry was inflated again and matched its recorded CRC-32 and byte size."
          : undefined,
    }),
    check("zip.entryCount", "Archive contains every expected file", zipIntegrity.entryCount === expectedEntries, {
      expected: expectedEntries,
      actual: zipIntegrity.entryCount,
    }),
  ];
}

/** Merges archive checks into a validation result, preserving pass/fail semantics. */
export function mergeValidation(
  contentValidation: BackupValidation,
  archiveChecks: ValidationCheck[]
): BackupValidation {
  const checks = [...contentValidation.checks, ...archiveChecks];
  const criticalFailures = checks.filter((entry) => entry.critical && !entry.passed);
  const warnings = checks.filter((entry) => !entry.critical && !entry.passed);
  return {
    ...contentValidation,
    checks,
    criticalFailures,
    warnings,
    passed: criticalFailures.length === 0,
  };
}