import type { Deal, Lead, Payment } from "@prisma/client";
import {
  calculateCollected,
  calculateCollectionRate,
  calculateDealOutstanding,
  calculateOpenPipelineValue,
  calculateTotalContractedDealValue,
  calculateTotalOutstanding,
  calculateWonDealValue,
  decimalToNumber,
  derivePaymentStatus,
  getOpportunityValue,
  getTodayIST,
  toDecimal,
} from "@/lib/financial/calculations";
import {
  calculateRemainingBalance,
  calculateTotalReceived,
  getDaysOverdue,
} from "@/features/deals/calculations";
import { BACKUP_TIMEZONE } from "./constants";
import type { BackupDataset, FinancialReconciliation } from "./types";

/* -------------------------------------------------------------------------- */
/*  View-model types                                                           */
/* -------------------------------------------------------------------------- */

export interface MonthlyPoint {
  key: string;
  label: string;
  count: number;
  amount: number;
}

export interface CountedBucket {
  key: string;
  count: number;
  amount: number;
}

export interface DealPaymentView {
  payment: Payment;
}

export interface DealView {
  deal: Deal;
  leadId: string | null;
  leadName: string | null;
  clientType: "CRM Client" | "Other Client" | "Archived CRM Client";
  clientName: string;
  company: string;
  phone: string;
  email: string;
  projectName: string;
  contracted: number;
  received: number;
  outstanding: number;
  paymentStatus: "Paid" | "Partially Paid" | "Overdue" | "Unpaid";
  daysOverdue: number;
  payments: Payment[];
}

export interface ClientGroup {
  key: string;
  type: "CRM Client" | "Other Client" | "Archived CRM Client";
  clientName: string;
  company: string;
  phone: string;
  email: string;
  deals: DealView[];
  dealCount: number;
  contracted: number;
  received: number;
  outstanding: number;
  collectionRate: number;
}

export interface OpportunityView {
  leadId: string;
  name: string;
  business: string;
  phone: string;
  status: string;
  quotedAmount: number | null;
  dealValue: number | null;
  opportunityValue: number;
  createdAt: string;
}

export interface LeadAnalytics {
  total: number;
  byStatus: CountedBucket[];
  current: number;
  historical: number;
  waste: number;
  archivedDeleted: number;
  merged: number;
  pinned: number;
  withQuotes: number;
  quotedValue: number;
  bySource: CountedBucket[];
  byIndustry: CountedBucket[];
  createdThisMonth: number;
  createdLast30Days: number;
  wonCount: number;
  lostCount: number;
  winRate: number;
}

export interface DealAnalytics {
  total: number;
  byStatus: CountedBucket[];
  bySource: CountedBucket[];
  contracted: number;
  received: number;
  outstanding: number;
  collectionRate: number;
  wonDealValue: number;
  openPipelineValue: number;
  paidDeals: number;
  partiallyPaidDeals: number;
  unpaidDeals: number;
  overdueDeals: number;
  crmClientDeals: number;
  otherClientDeals: number;
  orphanDeals: number;
}

export interface PaymentAnalytics {
  total: number;
  amount: number;
  byMethod: CountedBucket[];
  byType: CountedBucket[];
  last30DaysAmount: number;
  last30DaysCount: number;
  thisMonthAmount: number;
  firstPaymentDate: string | null;
  latestPaymentDate: string | null;
  averagePayment: number;
}

export interface ReceivablesAnalytics {
  outstanding: number;
  overdueAmount: number;
  upcomingAmount: number;
  overdueDealCount: number;
  dealsWithBalance: number;
  nextDueDate: string | null;
}

export interface FollowUpAnalytics {
  total: number;
  pending: number;
  completed: number;
  cancelled: number;
  overdue: number;
  dueToday: number;
  upcoming: number;
  leadsWithPending: number;
  byType: CountedBucket[];
  completionRate: number;
  latestScheduledAt: string | null;
}

export interface ActivityAnalytics {
  total: number;
  byType: CountedBucket[];
  last30Days: number;
  noteActivities: number;
  statusChangeActivities: number;
}

export interface NoteAnalytics {
  personalNotes: number;
  pinnedPersonalNotes: number;
  leadsWithNotes: number;
  leadNotesCharacters: number;
}

export interface BackupAnalytics {
  todayIst: string;
  leads: LeadAnalytics;
  deals: DealAnalytics;
  payments: PaymentAnalytics;
  receivables: ReceivablesAnalytics;
  followUps: FollowUpAnalytics;
  activities: ActivityAnalytics;
  notes: NoteAnalytics;
  monthly: {
    leads: MonthlyPoint[];
    deals: MonthlyPoint[];
    payments: MonthlyPoint[];
  };
  clientGroups: ClientGroup[];
  clientsWithMultipleDeals: ClientGroup[];
  topClientsByReceived: ClientGroup[];
  topClientsByOutstanding: ClientGroup[];
  opportunities: OpportunityView[];
  lossReasons: CountedBucket[];
  reconciliation: FinancialReconciliation;
  dealsById: Map<string, DealView>;
  paymentCount: number;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function monthKey(date: Date, timeZone = BACKUP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map((part) => Number(part));
  if (!year || !month) return key;
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short", year: "numeric" }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
}

function istDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BACKUP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildMonthly<T>(
  rows: T[],
  getDate: (row: T) => Date,
  getAmount: (row: T) => number
): MonthlyPoint[] {
  const map = new Map<string, { count: number; amount: number }>();
  for (const row of rows) {
    const raw = getDate(row);
    if (!raw || Number.isNaN(new Date(raw).getTime())) continue;
    const key = monthKey(new Date(raw));
    const bucket = map.get(key) ?? { count: 0, amount: 0 };
    bucket.count += 1;
    bucket.amount += getAmount(row);
    map.set(key, bucket);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => ({ key, label: monthLabel(key), count: value.count, amount: round2(value.amount) }));
}

function countBy<T>(rows: T[], getKey: (row: T) => string | null | undefined, getAmount?: (row: T) => number): CountedBucket[] {
  const map = new Map<string, { count: number; amount: number }>();
  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    const bucket = map.get(key) ?? { count: 0, amount: 0 };
    bucket.count += 1;
    bucket.amount += getAmount ? getAmount(row) : 0;
    map.set(key, bucket);
  }
  return [...map.entries()]
    .map(([key, value]) => ({ key, count: value.count, amount: round2(value.amount) }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function formatEnumLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatDealStatusLabel(value: string): string {
  return formatEnumLabel(value);
}

export function formatPaymentMethodLabel(value: string): string {
  return formatEnumLabel(value);
}

export function formatPaymentTypeLabel(value: string): string {
  return formatEnumLabel(value);
}

/* -------------------------------------------------------------------------- */
/*  Main builder                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Builds every figure rendered by the PDF reports. All money math delegates to the canonical
 * financial engine (`@/lib/financial/calculations`) so the backup can never disagree with the
 * Dashboard, Analytics or Deals screens.
 */
export function buildBackupAnalytics(dataset: BackupDataset): BackupAnalytics {
  const todayIst = getTodayIST();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const currentMonthKey = monthKey(now);

  const leads = dataset.leads;
  const deals = dataset.deals;
  const payments = dataset.payments;

  const leadsById = new Map<string, Lead>(leads.map((lead) => [lead.id, lead]));
  const paymentsByDeal = new Map<string, Payment[]>();
  for (const payment of payments) {
    const list = paymentsByDeal.get(payment.dealId) ?? [];
    list.push(payment);
    paymentsByDeal.set(payment.dealId, list);
  }
  const dealsByLead = new Map<string, Deal[]>();
  for (const deal of deals) {
    if (!deal.leadId) continue;
    const list = dealsByLead.get(deal.leadId) ?? [];
    list.push(deal);
    dealsByLead.set(deal.leadId, list);
  }

  /* ------------------------------- Deal views ------------------------------ */

  const dealViews: DealView[] = deals.map((deal) => {
    const lead = deal.leadId ? leadsById.get(deal.leadId) ?? null : null;
    const dealPayments = paymentsByDeal.get(deal.id) ?? [];
    const contracted = decimalToNumber(deal.finalAmount);
    const received = calculateTotalReceived(dealPayments.map((p) => ({ amount: p.amount })));
    const outstanding = calculateRemainingBalance(contracted, received);
    const dueDateStr = deal.nextPaymentDueDate
      ? new Date(deal.nextPaymentDueDate).toISOString().slice(0, 10)
      : null;

    let clientType: DealView["clientType"];
    if (deal.source === "CRM_LEAD") {
      clientType = lead && lead.deletedAt === null ? "CRM Client" : "Archived CRM Client";
    } else {
      clientType = "Other Client";
    }

    const clientName =
      clientType === "CRM Client"
        ? lead?.name ?? deal.clientNameSnapshot ?? "Unnamed Client"
        : deal.clientNameSnapshot || lead?.name || "Unnamed Client";
    const company =
      clientType === "CRM Client"
        ? lead?.business || deal.companyNameSnapshot || ""
        : deal.companyNameSnapshot || lead?.business || "";

    return {
      deal,
      leadId: deal.leadId,
      leadName: lead?.name ?? null,
      clientType,
      clientName,
      company,
      phone: lead?.phone || deal.clientPhone || "",
      email: lead?.email || deal.clientEmail || "",
      projectName: deal.projectName || "General project",
      contracted,
      received,
      outstanding,
      paymentStatus: derivePaymentStatus(contracted, received, dueDateStr, todayIst),
      daysOverdue: outstanding > 0 ? getDaysOverdue(dueDateStr, todayIst) : 0,
      payments: [...dealPayments].sort(
        (a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
      ),
    };
  });

  const dealsById = new Map<string, DealView>(dealViews.map((view) => [view.deal.id, view]));

  /* ------------------------------ Client groups ---------------------------- */

  const groupMap = new Map<string, ClientGroup>();
  for (const view of dealViews) {
    const key =
      view.clientType === "Other Client"
        ? `other:${(view.clientName || "unknown").trim().toLowerCase()}|${(view.company || "").trim().toLowerCase()}`
        : `lead:${view.leadId ?? "unknown"}`;

    let group = groupMap.get(key);
    if (!group) {
      group = {
        key,
        type: view.clientType,
        clientName: view.clientName,
        company: view.company,
        phone: view.phone,
        email: view.email,
        deals: [],
        dealCount: 0,
        contracted: 0,
        received: 0,
        outstanding: 0,
        collectionRate: 0,
      };
      groupMap.set(key, group);
    }
    group.deals.push(view);
    group.dealCount += 1;
    group.contracted = round2(group.contracted + view.contracted);
    group.received = round2(group.received + view.received);
    group.outstanding = round2(group.outstanding + view.outstanding);
  }

  const clientGroups = [...groupMap.values()].map((group) => ({
    ...group,
    deals: group.deals.sort(
      (a, b) => new Date(a.deal.createdAt).getTime() - new Date(b.deal.createdAt).getTime()
    ),
    received: round2(group.received),
    outstanding: round2(group.outstanding),
    collectionRate: decimalToNumber(calculateCollectionRate(group.received, group.contracted)),
  }));
  clientGroups.sort((a, b) => b.contracted - a.contracted || a.clientName.localeCompare(b.clientName));

  const clientsWithMultipleDeals = clientGroups.filter((group) => group.dealCount > 1);
  const topClientsByReceived = [...clientGroups]
    .sort((a, b) => b.received - a.received || a.clientName.localeCompare(b.clientName))
    .slice(0, 10);
  const topClientsByOutstanding = [...clientGroups]
    .filter((group) => group.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding || a.clientName.localeCompare(b.clientName))
    .slice(0, 10);

  /* --------------------------------- Leads --------------------------------- */

  const activeLeads = leads.filter(
    (lead) => !lead.isWaste && lead.deletedAt === null && lead.mergedIntoLeadId === null
  );
  const quotedLeads = leads.filter((lead) => lead.quotedAmount !== null && decimalToNumber(lead.quotedAmount) > 0);
  const wonCount = activeLeads.filter((lead) => lead.status === "WON").length;
  const lostCount = activeLeads.filter((lead) => lead.status === "LOST").length;

  const leadsAnalytics: LeadAnalytics = {
    total: leads.length,
    byStatus: countBy(
      leads,
      (lead) => lead.status,
      (lead) => decimalToNumber(lead.quotedAmount)
    ).map((bucket) => ({ ...bucket, key: formatEnumLabel(bucket.key) })),
    current: activeLeads.length,
    historical:
      leads.filter((lead) => lead.isWaste || lead.deletedAt !== null || lead.mergedIntoLeadId !== null).length,
    waste: leads.filter((lead) => lead.isWaste).length,
    archivedDeleted: leads.filter((lead) => lead.deletedAt !== null).length,
    merged: leads.filter((lead) => lead.mergedIntoLeadId !== null).length,
    pinned: leads.filter((lead) => lead.isPinned).length,
    withQuotes: quotedLeads.length,
    quotedValue: round2(quotedLeads.reduce((sum, lead) => sum + decimalToNumber(lead.quotedAmount), 0)),
    bySource: countBy(leads, (lead) => lead.leadSource || "Unspecified"),
    byIndustry: countBy(leads, (lead) => (lead.industry || "Unspecified").trim() || "Unspecified"),
    createdThisMonth: leads.filter((lead) => monthKey(new Date(lead.createdAt)) === currentMonthKey).length,
    createdLast30Days: leads.filter((lead) => new Date(lead.createdAt).getTime() >= thirtyDaysAgo.getTime()).length,
    wonCount,
    lostCount,
    winRate: wonCount + lostCount > 0 ? round2((wonCount / (wonCount + lostCount)) * 100) : 0,
  };

  /* ------------------------------ Opportunities ---------------------------- */

  const opportunities: OpportunityView[] = activeLeads
    .filter((lead) => ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT"].includes(lead.status))
    .map((lead) => {
      const leadDeals = dealsByLead.get(lead.id) ?? [];
      const dealValue = leadDeals.length
        ? round2(leadDeals.reduce((sum, deal) => sum + decimalToNumber(deal.finalAmount), 0))
        : null;
      return {
        leadId: lead.id,
        name: lead.name,
        business: lead.business || "",
        phone: lead.phone,
        status: lead.status,
        quotedAmount: lead.quotedAmount !== null ? decimalToNumber(lead.quotedAmount) : null,
        dealValue,
        opportunityValue: decimalToNumber(
          getOpportunityValue(
            {
              status: lead.status,
              isWaste: lead.isWaste,
              deletedAt: lead.deletedAt,
              mergedIntoLeadId: lead.mergedIntoLeadId,
              quotedAmount: lead.quotedAmount,
            },
            leadDeals
          )
        ),
        createdAt: new Date(lead.createdAt).toISOString(),
      };
    })
    .sort((a, b) => b.opportunityValue - a.opportunityValue || a.name.localeCompare(b.name));

  /* -------------------------- Canonical financials ------------------------- */

  const leadsWithDeals = leads.map((lead) => ({
    id: lead.id,
    status: lead.status,
    isWaste: lead.isWaste,
    deletedAt: lead.deletedAt,
    mergedIntoLeadId: lead.mergedIntoLeadId,
    quotedAmount: lead.quotedAmount,
    deals: (dealsByLead.get(lead.id) ?? []).map((deal) => ({
      id: deal.id,
      finalAmount: deal.finalAmount,
      status: deal.status,
      createdAt: deal.createdAt,
    })),
  }));

  const dealFinancialRecords = deals.map((deal) => ({
    id: deal.id,
    finalAmount: deal.finalAmount,
    status: deal.status,
    payments: (paymentsByDeal.get(deal.id) ?? []).map((payment) => ({
      id: payment.id,
      dealId: payment.dealId,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
    })),
  }));

  const contractedDecimal = calculateTotalContractedDealValue(dealFinancialRecords);
  const receivedDecimal = calculateCollected(
    payments.map((payment) => ({ id: payment.id, dealId: payment.dealId, amount: payment.amount }))
  );
  const outstandingDecimal = calculateTotalOutstanding(dealFinancialRecords);
  const wonDealDecimal = calculateWonDealValue(leadsWithDeals);
  const openPipelineDecimal = calculateOpenPipelineValue(
    leadsWithDeals.map((lead) => ({
      id: lead.id,
      status: lead.status,
      isWaste: lead.isWaste,
      deletedAt: lead.deletedAt,
      mergedIntoLeadId: lead.mergedIntoLeadId,
      quotedAmount: lead.quotedAmount,
      deals: lead.deals,
    }))
  );

  const dealLevelReceivedSum = round2(
    dealViews.reduce((sum, view) => sum + calculateTotalReceived(view.payments.map((p) => ({ amount: p.amount }))), 0)
  );
  const dealLevelOutstandingSum = round2(
    dealViews.reduce(
      (sum, view) => sum + decimalToNumber(calculateDealOutstanding(view.deal.finalAmount, view.payments.map((p) => ({ amount: p.amount })))),
      0
    )
  );
  const paymentLevelReceivedSum = round2(
    payments.reduce((sum, payment) => sum + Math.max(0, decimalToNumber(payment.amount)), 0)
  );

  const reconciliation: FinancialReconciliation = {
    contractedDealValue: decimalToNumber(contractedDecimal),
    moneyReceived: decimalToNumber(receivedDecimal),
    outstanding: decimalToNumber(outstandingDecimal),
    collectionRate: decimalToNumber(calculateCollectionRate(receivedDecimal, contractedDecimal)),
    wonDealValue: decimalToNumber(wonDealDecimal),
    dealLevelReceivedSum,
    paymentLevelReceivedSum,
    dealLevelOutstandingSum,
    clientsWithMultipleDeals: clientsWithMultipleDeals.length,
    crmClientDeals: dealViews.filter((view) => view.clientType !== "Other Client").length,
    otherClientDeals: dealViews.filter((view) => view.clientType === "Other Client").length,
  };

  /* --------------------------------- Deals --------------------------------- */

  const overdueDeals = dealViews.filter((view) => view.paymentStatus === "Overdue");
  const dealsAnalytics: DealAnalytics = {
    total: dealViews.length,
    byStatus: countBy(
      dealViews,
      (view) => formatEnumLabel(view.deal.status),
      (view) => view.contracted
    ),
    bySource: [
      {
        key: "CRM Client projects",
        count: reconciliation.crmClientDeals,
        amount: round2(
          dealViews.filter((v) => v.clientType !== "Other Client").reduce((sum, v) => sum + v.contracted, 0)
        ),
      },
      {
        key: "Other client projects",
        count: reconciliation.otherClientDeals,
        amount: round2(
          dealViews.filter((v) => v.clientType === "Other Client").reduce((sum, v) => sum + v.contracted, 0)
        ),
      },
    ],
    contracted: reconciliation.contractedDealValue,
    received: reconciliation.moneyReceived,
    outstanding: reconciliation.outstanding,
    collectionRate: reconciliation.collectionRate,
    wonDealValue: reconciliation.wonDealValue,
    openPipelineValue: decimalToNumber(openPipelineDecimal),
    paidDeals: dealViews.filter((view) => view.paymentStatus === "Paid").length,
    partiallyPaidDeals: dealViews.filter((view) => view.paymentStatus === "Partially Paid").length,
    unpaidDeals: dealViews.filter((view) => view.paymentStatus === "Unpaid").length,
    overdueDeals: overdueDeals.length,
    crmClientDeals: reconciliation.crmClientDeals,
    otherClientDeals: reconciliation.otherClientDeals,
    orphanDeals: dealViews.filter((view) => view.deal.leadId && !leadsById.has(view.deal.leadId)).length,
  };

  /* -------------------------------- Payments ------------------------------- */

  const sortedPayments = [...payments].sort(
    (a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
  );
  const paymentsAnalytics: PaymentAnalytics = {
    total: payments.length,
    amount: reconciliation.moneyReceived,
    byMethod: countBy(
      payments,
      (payment) => formatPaymentMethodLabel(payment.method),
      (payment) => decimalToNumber(payment.amount)
    ),
    byType: countBy(
      payments,
      (payment) => formatPaymentTypeLabel(payment.type),
      (payment) => decimalToNumber(payment.amount)
    ),
    last30DaysAmount: round2(
      payments
        .filter((payment) => new Date(payment.paymentDate).getTime() >= thirtyDaysAgo.getTime())
        .reduce((sum, payment) => sum + decimalToNumber(payment.amount), 0)
    ),
    last30DaysCount: payments.filter(
      (payment) => new Date(payment.paymentDate).getTime() >= thirtyDaysAgo.getTime()
    ).length,
    thisMonthAmount: round2(
      payments
        .filter((payment) => monthKey(new Date(payment.paymentDate)) === currentMonthKey)
        .reduce((sum, payment) => sum + decimalToNumber(payment.amount), 0)
    ),
    firstPaymentDate: sortedPayments.length ? new Date(sortedPayments[0].paymentDate).toISOString() : null,
    latestPaymentDate: sortedPayments.length
      ? new Date(sortedPayments[sortedPayments.length - 1].paymentDate).toISOString()
      : null,
    averagePayment: payments.length ? round2(reconciliation.moneyReceived / payments.length) : 0,
  };

  const receivables: ReceivablesAnalytics = {
    outstanding: reconciliation.outstanding,
    overdueAmount: round2(overdueDeals.reduce((sum, view) => sum + view.outstanding, 0)),
    upcomingAmount: round2(
      dealViews
        .filter((view) => view.paymentStatus !== "Overdue" && view.outstanding > 0)
        .reduce((sum, view) => sum + view.outstanding, 0)
    ),
    overdueDealCount: overdueDeals.length,
    dealsWithBalance: dealViews.filter((view) => view.outstanding > 0).length,
    nextDueDate:
      dealViews
        .filter((view) => view.deal.nextPaymentDueDate && view.outstanding > 0)
        .map((view) => new Date(view.deal.nextPaymentDueDate as Date).toISOString())
        .sort()[0] ?? null,
  };

  /* ------------------------------- Follow-ups ------------------------------ */

  const followUps = dataset.followUps;
  const pendingFollowUps = followUps.filter((f) => f.status === "PENDING");
  const completedFollowUps = followUps.filter((f) => f.status === "COMPLETED");
  const overdueFollowUps = pendingFollowUps.filter((f) => istDateString(new Date(f.scheduledAt)) < todayIst);
  const dueTodayFollowUps = pendingFollowUps.filter((f) => istDateString(new Date(f.scheduledAt)) === todayIst);

  const followUpAnalytics: FollowUpAnalytics = {
    total: followUps.length,
    pending: pendingFollowUps.length,
    completed: completedFollowUps.length,
    cancelled: followUps.filter((f) => f.status === "CANCELLED").length,
    overdue: overdueFollowUps.length,
    dueToday: dueTodayFollowUps.length,
    upcoming: pendingFollowUps.length - overdueFollowUps.length - dueTodayFollowUps.length,
    leadsWithPending: new Set(pendingFollowUps.map((f) => f.leadId)).size,
    byType: countBy(followUps, (f) => formatEnumLabel(f.type)),
    completionRate: followUps.length
      ? round2((completedFollowUps.length / followUps.length) * 100)
      : 0,
    latestScheduledAt: followUps.length
      ? new Date(
          followUps.reduce(
            (latest, f) => (new Date(f.scheduledAt).getTime() > new Date(latest.scheduledAt).getTime() ? f : latest),
            followUps[0]
          ).scheduledAt
        ).toISOString()
      : null,
  };

  /* ------------------------------- Activities ------------------------------ */

  const activities = dataset.activities;
  const activityAnalytics: ActivityAnalytics = {
    total: activities.length,
    byType: countBy(activities, (activity) => formatEnumLabel(activity.type)),
    last30Days: activities.filter((activity) => new Date(activity.createdAt).getTime() >= thirtyDaysAgo.getTime())
      .length,
    noteActivities: activities.filter((activity) => activity.type === "NOTE_ADDED").length,
    statusChangeActivities: activities.filter((activity) => activity.type === "STATUS_CHANGED").length,
  };

  const noteAnalytics: NoteAnalytics = {
    personalNotes: dataset.personalNotes.length,
    pinnedPersonalNotes: dataset.personalNotes.filter((note) => note.isPinned).length,
    leadsWithNotes: leads.filter((lead) => Boolean(lead.notes && lead.notes.trim())).length,
    leadNotesCharacters: leads.reduce((sum, lead) => sum + (lead.notes?.length ?? 0), 0),
  };

  /* ---------------------------------- Losses ------------------------------- */

  const lossReasons = countBy(dataset.lossEvents, (event) => formatEnumLabel(event.reason));

  return {
    todayIst,
    leads: leadsAnalytics,
    deals: dealsAnalytics,
    payments: paymentsAnalytics,
    receivables,
    followUps: followUpAnalytics,
    activities: activityAnalytics,
    notes: noteAnalytics,
    monthly: {
      leads: buildMonthly(leads, (lead) => new Date(lead.createdAt), () => 0),
      deals: buildMonthly(deals, (deal) => new Date(deal.createdAt), (deal) => decimalToNumber(deal.finalAmount)),
      payments: buildMonthly(payments, (payment) => new Date(payment.paymentDate), (payment) =>
        decimalToNumber(payment.amount)
      ),
    },
    clientGroups,
    clientsWithMultipleDeals,
    topClientsByReceived,
    topClientsByOutstanding,
    opportunities,
    lossReasons,
    reconciliation,
    dealsById,
    paymentCount: payments.length,
  };
}

/** Exposed for reporting code that needs a Decimal-safe currency parse. */
export function safeAmount(value: unknown): number {
  return decimalToNumber(toDecimal(value as never));
}