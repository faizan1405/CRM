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
import { buildCsvBuffer } from "@/lib/export/csv-builder";
import type { ColumnDefinition } from "@/lib/export/types";
import { decimalToNumber } from "@/lib/financial/calculations";
import { RAW_FOLDER, RECORD_FORMAT_VERSION, SCHEMA_BASELINE_MIGRATION, BACKUP_FORMAT_VERSION } from "./constants";
import type { BackupAnalytics } from "./analytics";
import type { BackupDataset, GeneratedRawFile } from "./types";

/* -------------------------------------------------------------------------- */
/*  Serialization helpers                                                      */
/* -------------------------------------------------------------------------- */

export type FlatRow = Record<string, string | number | null>;

/** Money: exact 2-decimal text (stable for import and free of floating point drift). */
function money(value: unknown): string {
  return decimalToNumber(value as never).toFixed(2);
}

function amount(value: unknown): number {
  return decimalToNumber(value as never);
}

/** Timestamps: ISO-8601 UTC so a restore keeps the exact instant. */
function iso(value: Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/** Calendar dates (Date columns) are exported as plain YYYY-MM-DD, untouched by timezones. */
function calendarDate(value: Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function text(value: string | null | undefined): string {
  return value ?? "";
}

function buildCsv(rows: FlatRow[], columns: Array<{ header: string; key: string }>): GeneratedRawFile["buffer"] {
  const definitions: ColumnDefinition<FlatRow>[] = columns.map((column) => ({
    header: column.header,
    key: column.key,
    getValue: (row) => (row[column.key] === undefined || row[column.key] === null ? "" : row[column.key]),
  }));
  return buildCsvBuffer(rows, definitions);
}

/* -------------------------------------------------------------------------- */
/*  Row mappers (raw schema values — ids and relationships preserved)          */
/* -------------------------------------------------------------------------- */

function leadRow(lead: Lead): FlatRow {
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: text(lead.email),
    business: text(lead.business),
    industry: text(lead.industry),
    lead_source: text(lead.leadSource),
    budget: lead.budget === null ? "" : money(lead.budget),
    quoted_amount: lead.quotedAmount === null ? "" : money(lead.quotedAmount),
    status: lead.status,
    quick_status: lead.quickStatus,
    is_waste: lead.isWaste ? "TRUE" : "FALSE",
    is_pinned: lead.isPinned ? "TRUE" : "FALSE",
    last_contact_date: calendarDate(lead.lastContactDate),
    next_follow_up_date: calendarDate(lead.nextFollowUpDate),
    notes: text(lead.notes),
    deleted_at: iso(lead.deletedAt),
    merged_into_lead_id: text(lead.mergedIntoLeadId),
    merged_at: iso(lead.mergedAt),
    created_at: iso(lead.createdAt),
    updated_at: iso(lead.updatedAt),
  };
}

function dealRow(deal: Deal): FlatRow {
  return {
    id: deal.id,
    source: deal.source,
    lead_id: text(deal.leadId),
    submission_id: text(deal.submissionId),
    client_name_snapshot: text(deal.clientNameSnapshot),
    company_name_snapshot: text(deal.companyNameSnapshot),
    client_phone: text(deal.clientPhone),
    client_email: text(deal.clientEmail),
    project_name: text(deal.projectName),
    notes: text(deal.notes),
    quoted_amount: deal.quotedAmount === null ? "" : money(deal.quotedAmount),
    final_amount: money(deal.finalAmount),
    currency: deal.currency,
    status: deal.status,
    next_payment_due_date: calendarDate(deal.nextPaymentDueDate),
    next_payment_due_amount: deal.nextPaymentDueAmount === null ? "" : money(deal.nextPaymentDueAmount),
    created_at: iso(deal.createdAt),
    updated_at: iso(deal.updatedAt),
  };
}

function paymentRow(payment: Payment): FlatRow {
  return {
    id: payment.id,
    deal_id: payment.dealId,
    amount: money(payment.amount),
    payment_date: iso(payment.paymentDate),
    type: payment.type,
    custom_type: text(payment.customType),
    method: payment.method,
    reference: text(payment.reference),
    note: text(payment.note),
    created_at: iso(payment.createdAt),
    updated_at: iso(payment.updatedAt),
  };
}

function followUpRow(followUp: FollowUp): FlatRow {
  return {
    id: followUp.id,
    lead_id: followUp.leadId,
    scheduled_at: iso(followUp.scheduledAt),
    type: followUp.type,
    status: followUp.status,
    note: text(followUp.note),
    completed_at: iso(followUp.completedAt),
    submission_id: text(followUp.submissionId),
    created_at: iso(followUp.createdAt),
    updated_at: iso(followUp.updatedAt),
  };
}

function activityRow(activity: LeadActivity): FlatRow {
  return {
    id: activity.id,
    lead_id: activity.leadId,
    type: activity.type,
    message: activity.message,
    metadata: activity.metadata === null || activity.metadata === undefined ? "" : JSON.stringify(activity.metadata),
    created_by_user_id: text(activity.createdByUserId),
    created_at: iso(activity.createdAt),
  };
}

function personalNoteRow(note: PersonalNote): FlatRow {
  return {
    source: "PERSONAL_NOTE",
    id: note.id,
    lead_id: "",
    user_id: note.userId,
    title: text(note.title),
    content: note.content,
    is_pinned: note.isPinned ? "TRUE" : "FALSE",
    created_at: iso(note.createdAt),
    updated_at: iso(note.updatedAt),
  };
}

function leadNoteRow(lead: Lead): FlatRow {
  return {
    source: "LEAD_NOTE",
    id: `lead-note:${lead.id}`,
    lead_id: lead.id,
    user_id: "",
    title: lead.name,
    content: text(lead.notes),
    is_pinned: lead.isPinned ? "TRUE" : "FALSE",
    created_at: iso(lead.createdAt),
    updated_at: iso(lead.updatedAt),
  };
}

function aiInsightRow(insight: LeadAIInsight): FlatRow {
  return {
    id: insight.id,
    lead_id: insight.leadId,
    score: insight.score,
    priority: insight.priority,
    score_reason: insight.scoreReason,
    recommended_action: insight.recommendedAction,
    recommended_action_type: text(insight.recommendedActionType),
    factor_breakdown: insight.factorBreakdown === null || insight.factorBreakdown === undefined
      ? ""
      : JSON.stringify(insight.factorBreakdown),
    needs_refresh: insight.needsRefresh ? "TRUE" : "FALSE",
    last_analyzed_at: iso(insight.lastAnalyzedAt),
    created_at: iso(insight.createdAt),
    updated_at: iso(insight.updatedAt),
  };
}

function lossEventRow(event: LeadLossEvent): FlatRow {
  return {
    id: event.id,
    lead_id: event.leadId,
    reason: event.reason,
    note: text(event.note),
    lost_at: iso(event.lostAt),
    created_by_user_id: text(event.createdByUserId),
    created_at: iso(event.createdAt),
  };
}

function packageRow(pkg: WebsitePackage): FlatRow {
  return {
    asset_type: "WEBSITE_PACKAGE",
    id: pkg.id,
    name: pkg.name,
    price: money(pkg.price),
    is_starting_price: pkg.isStartingPrice ? "TRUE" : "FALSE",
    inclusions: pkg.inclusions,
    hosting: text(pkg.hosting),
    domain: text(pkg.domain),
    is_active: pkg.isActive ? "TRUE" : "FALSE",
    sort_order: pkg.sortOrder,
    extra_url: "",
    extra_category: "",
    extra_type: "",
    created_at: iso(pkg.createdAt),
    updated_at: iso(pkg.updatedAt),
  };
}

function sampleRow(sample: WebsiteSample): FlatRow {
  return {
    asset_type: "WEBSITE_SAMPLE",
    id: sample.id,
    name: text(sample.label),
    price: "",
    is_starting_price: "",
    inclusions: "",
    hosting: "",
    domain: "",
    is_active: sample.isActive ? "TRUE" : "FALSE",
    sort_order: sample.sortOrder,
    extra_url: sample.url,
    extra_category: sample.category,
    extra_type: sample.type,
    created_at: iso(sample.createdAt),
    updated_at: iso(sample.updatedAt),
  };
}

function templateRow(template: WhatsAppTemplate): FlatRow {
  return {
    asset_type: "WHATSAPP_TEMPLATE",
    id: template.id,
    name: template.title,
    price: "",
    is_starting_price: "",
    inclusions: template.message,
    hosting: "",
    domain: "",
    is_active: template.isActive ? "TRUE" : "FALSE",
    sort_order: template.sortOrder,
    extra_url: "",
    extra_category: template.category,
    extra_type: "",
    created_at: iso(template.createdAt),
    updated_at: iso(template.updatedAt),
  };
}

function notificationRow(notification: SalesNotification): FlatRow {
  return {
    id: notification.id,
    user_id: text(notification.userId),
    lead_id: text(notification.leadId),
    type: notification.type,
    priority: notification.priority,
    title: notification.title,
    reason: notification.reason,
    recommended_action: notification.recommendedAction,
    status: notification.status,
    read_at: iso(notification.readAt),
    resolved_at: iso(notification.resolvedAt),
    created_at: iso(notification.createdAt),
    updated_at: iso(notification.updatedAt),
  };
}

function briefingRow(briefing: DailySalesBriefing): FlatRow {
  return {
    id: briefing.id,
    user_id: briefing.userId,
    briefing_date: briefing.briefingDate,
    summary: briefing.summary,
    metadata: JSON.stringify(briefing.metadata ?? {}),
    generated_at: iso(briefing.generatedAt),
  };
}

function userRow(user: BackupDataset["users"][number]): FlatRow {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    created_at: iso(user.createdAt),
    updated_at: iso(user.updatedAt),
  };
}

function undoActionRow(action: UndoAction): FlatRow {
  return {
    id: action.id,
    action_type: action.actionType,
    entity_type: action.entityType,
    entity_id: action.entityId,
    lead_id: text(action.leadId),
    description: action.description,
    before_snapshot: JSON.stringify(action.beforeSnapshot ?? null),
    after_snapshot: action.afterSnapshot === null || action.afterSnapshot === undefined
      ? ""
      : JSON.stringify(action.afterSnapshot),
    expected_updated_at: iso(action.expectedUpdatedAt),
    undone_at: iso(action.undoneAt),
    undone_by_user_id: text(action.undoneByUserId),
    created_by_user_id: text(action.createdByUserId),
    created_at: iso(action.createdAt),
    expires_at: iso(action.expiresAt),
  };
}

function mobileAlertRow(alert: DispatchedMobileAlert): FlatRow {
  return {
    id: alert.id,
    dedupe_key: alert.dedupeKey,
    user_id: text(alert.userId),
    lead_id: text(alert.leadId),
    category: alert.category,
    title: alert.title,
    body: alert.body,
    success: alert.success ? "TRUE" : "FALSE",
    dispatched_at: iso(alert.dispatchedAt),
  };
}

/* -------------------------------------------------------------------------- */
/*  File catalogue                                                             */
/* -------------------------------------------------------------------------- */

interface FileSpec {
  name: string;
  rows: FlatRow[];
  columns: Array<{ header: string; key: string }>;
}

function columnsOf(rows: FlatRow[], fallback: string[]): Array<{ header: string; key: string }> {
  const keys = rows.length > 0 ? Object.keys(rows[0]) : fallback;
  return keys.map((key) => ({ header: key, key }));
}

/**
 * Builds every machine-readable backup file. Values are the raw database values (ids, enums,
 * ISO-8601 UTC timestamps, 2-decimal money strings) so a future restore can replay them exactly.
 */
export function buildRawDataFiles(dataset: BackupDataset): GeneratedRawFile[] {
  const leadNotes = dataset.leads
    .filter((lead) => Boolean(lead.notes && lead.notes.trim()))
    .map(leadNoteRow);
  const noteRows: FlatRow[] = [...dataset.personalNotes.map(personalNoteRow), ...leadNotes];

  const assetRows: FlatRow[] = [
    ...dataset.packages.map(packageRow),
    ...dataset.samples.map(sampleRow),
    ...dataset.templates.map(templateRow),
  ];

  const specs: FileSpec[] = [
    {
      name: "leads.csv",
      rows: dataset.leads.map(leadRow),
      columns: columnsOf(dataset.leads.map(leadRow), [
        "id",
        "name",
        "phone",
        "email",
        "business",
        "industry",
        "lead_source",
        "budget",
        "quoted_amount",
        "status",
        "quick_status",
        "is_waste",
        "is_pinned",
        "last_contact_date",
        "next_follow_up_date",
        "notes",
        "deleted_at",
        "merged_into_lead_id",
        "merged_at",
        "created_at",
        "updated_at",
      ]),
    },
    {
      name: "deals.csv",
      rows: dataset.deals.map(dealRow),
      columns: columnsOf(dataset.deals.map(dealRow), [
        "id",
        "source",
        "lead_id",
        "submission_id",
        "client_name_snapshot",
        "company_name_snapshot",
        "client_phone",
        "client_email",
        "project_name",
        "notes",
        "quoted_amount",
        "final_amount",
        "currency",
        "status",
        "next_payment_due_date",
        "next_payment_due_amount",
        "created_at",
        "updated_at",
      ]),
    },
    {
      name: "payments.csv",
      rows: dataset.payments.map(paymentRow),
      columns: columnsOf(dataset.payments.map(paymentRow), [
        "id",
        "deal_id",
        "amount",
        "payment_date",
        "type",
        "custom_type",
        "method",
        "reference",
        "note",
        "created_at",
        "updated_at",
      ]),
    },
    {
      name: "followups.csv",
      rows: dataset.followUps.map(followUpRow),
      columns: columnsOf(dataset.followUps.map(followUpRow), [
        "id",
        "lead_id",
        "scheduled_at",
        "type",
        "status",
        "note",
        "completed_at",
        "submission_id",
        "created_at",
        "updated_at",
      ]),
    },
    {
      name: "activities.csv",
      rows: dataset.activities.map(activityRow),
      columns: columnsOf(dataset.activities.map(activityRow), [
        "id",
        "lead_id",
        "type",
        "message",
        "metadata",
        "created_by_user_id",
        "created_at",
      ]),
    },
    {
      name: "notes.csv",
      rows: noteRows,
      columns: columnsOf(noteRows, [
        "source",
        "id",
        "lead_id",
        "user_id",
        "title",
        "content",
        "is_pinned",
        "created_at",
        "updated_at",
      ]),
    },
    {
      name: "ai_insights.csv",
      rows: dataset.aiInsights.map(aiInsightRow),
      columns: columnsOf(dataset.aiInsights.map(aiInsightRow), [
        "id",
        "lead_id",
        "score",
        "priority",
        "score_reason",
        "recommended_action",
        "recommended_action_type",
        "factor_breakdown",
        "needs_refresh",
        "last_analyzed_at",
        "created_at",
        "updated_at",
      ]),
    },
    {
      name: "loss_events.csv",
      rows: dataset.lossEvents.map(lossEventRow),
      columns: columnsOf(dataset.lossEvents.map(lossEventRow), [
        "id",
        "lead_id",
        "reason",
        "note",
        "lost_at",
        "created_by_user_id",
        "created_at",
      ]),
    },
    {
      name: "sales_assets.csv",
      rows: assetRows,
      columns: columnsOf(assetRows, [
        "asset_type",
        "id",
        "name",
        "price",
        "is_starting_price",
        "inclusions",
        "hosting",
        "domain",
        "is_active",
        "sort_order",
        "extra_url",
        "extra_category",
        "extra_type",
        "created_at",
        "updated_at",
      ]),
    },
    {
      name: "notifications.csv",
      rows: dataset.notifications.map(notificationRow),
      columns: columnsOf(dataset.notifications.map(notificationRow), [
        "id",
        "user_id",
        "lead_id",
        "type",
        "priority",
        "title",
        "reason",
        "recommended_action",
        "status",
        "read_at",
        "resolved_at",
        "created_at",
        "updated_at",
      ]),
    },
    {
      name: "daily_briefings.csv",
      rows: dataset.briefings.map(briefingRow),
      columns: columnsOf(dataset.briefings.map(briefingRow), [
        "id",
        "user_id",
        "briefing_date",
        "summary",
        "metadata",
        "generated_at",
      ]),
    },
    {
      name: "users.csv",
      rows: dataset.users.map(userRow),
      columns: columnsOf(dataset.users.map(userRow), ["id", "name", "email", "role", "created_at", "updated_at"]),
    },
    {
      name: "undo_actions.csv",
      rows: dataset.undoActions.map(undoActionRow),
      columns: columnsOf(dataset.undoActions.map(undoActionRow), [
        "id",
        "action_type",
        "entity_type",
        "entity_id",
        "lead_id",
        "description",
        "before_snapshot",
        "after_snapshot",
        "expected_updated_at",
        "undone_at",
        "undone_by_user_id",
        "created_by_user_id",
        "created_at",
        "expires_at",
      ]),
    },
    {
      name: "mobile_alert_log.csv",
      rows: dataset.mobileAlerts.map(mobileAlertRow),
      columns: columnsOf(dataset.mobileAlerts.map(mobileAlertRow), [
        "id",
        "dedupe_key",
        "user_id",
        "lead_id",
        "category",
        "title",
        "body",
        "success",
        "dispatched_at",
      ]),
    },
  ];

  return specs.map((spec) => ({
    path: `${RAW_FOLDER}/${spec.name}`,
    buffer: buildCsv(spec.rows, spec.columns),
    rows: spec.rows.length,
  }));
}

/* -------------------------------------------------------------------------- */
/*  Complete JSON export                                                       */
/* -------------------------------------------------------------------------- */

export interface CompleteExportJsonInput {
  dataset: BackupDataset;
  analytics: BackupAnalytics;
  generatedAt: string;
  generatedBy: { id: string; name: string; email: string; role: string };
}

/**
 * A single self-describing JSON document with every record set, stable ids, relationship
 * keys and the derived financial totals used for reconciliation.
 */
export function buildCompleteExportJson(input: CompleteExportJsonInput): string {
  const { dataset, analytics } = input;

  const payload = {
    meta: {
      application: "Scale Flow CRM",
      backupFormatVersion: BACKUP_FORMAT_VERSION,
      recordFormatVersion: RECORD_FORMAT_VERSION,
      schemaBaselineMigration: SCHEMA_BASELINE_MIGRATION,
      generatedAt: input.generatedAt,
      generatedBy: input.generatedBy,
      scope: "all-time-complete",
      dateFilter: "none",
      snapshot: {
        mode: dataset.meta.snapshotMode,
        note: dataset.meta.snapshotNote,
        batchSize: dataset.meta.batchSize,
        batches: dataset.meta.batchCount,
        crmSyncVersionAtStart: dataset.meta.crmSyncVersionAtStart,
      },
      recordCounts: dataset.meta.fetchedCounts,
      databaseCounts: dataset.meta.databaseCounts,
      warnings: dataset.meta.warnings,
      relationships: {
        "Deal.leadId": "Lead.id",
        "Payment.dealId": "Deal.id",
        "FollowUp.leadId": "Lead.id",
        "LeadActivity.leadId": "Lead.id",
        "LeadAIInsight.leadId": "Lead.id",
        "LeadLossEvent.leadId": "Lead.id",
        "PersonalNote.userId": "User.id",
        "SalesNotification.leadId": "Lead.id",
        "SalesNotification.userId": "User.id",
        "Lead.mergedIntoLeadId": "Lead.id",
      },
      excludedCategories: [
        { key: "userCredentials", detail: "User.passwordHash is never exported." },
        { key: "mobilePushSubscriptions", detail: "Web-push endpoint/p256dh/auth are never exported." },
      ],
    },
    totals: {
      leads: dataset.leads.length,
      deals: dataset.deals.length,
      payments: dataset.payments.length,
      followUps: dataset.followUps.length,
      activities: dataset.activities.length,
      personalNotes: dataset.personalNotes.length,
      totalRecords:
        dataset.users.length +
        dataset.leads.length +
        dataset.deals.length +
        dataset.payments.length +
        dataset.followUps.length +
        dataset.activities.length +
        dataset.aiInsights.length +
        dataset.lossEvents.length +
        dataset.personalNotes.length +
        dataset.packages.length +
        dataset.samples.length +
        dataset.templates.length +
        dataset.notifications.length +
        dataset.briefings.length +
        dataset.undoActions.length +
        dataset.mobileAlerts.length,
    },
    financials: analytics.reconciliation,
    tables: {
      users: dataset.users,
      leads: dataset.leads,
      deals: dataset.deals,
      payments: dataset.payments,
      followUps: dataset.followUps,
      activities: dataset.activities,
      aiInsights: dataset.aiInsights,
      lossEvents: dataset.lossEvents,
      personalNotes: dataset.personalNotes,
      websitePackages: dataset.packages,
      websiteSamples: dataset.samples,
      whatsappTemplates: dataset.templates,
      salesNotifications: dataset.notifications,
      dailyBriefings: dataset.briefings,
      undoActions: dataset.undoActions,
      dispatchedMobileAlerts: dataset.mobileAlerts,
    },
  };

  return JSON.stringify(payload, null, 2);
}

/** Row counts for CSV entries, used by the manifest and coverage validation. */
export function rawFileRowCounts(files: GeneratedRawFile[]): Record<string, number> {
  return files.reduce<Record<string, number>>((acc, file) => {
    acc[file.path] = file.rows;
    return acc;
  }, {});
}

/** Money helper shared with reporting code. */
export function toAmount(value: unknown): number {
  return amount(value);
}