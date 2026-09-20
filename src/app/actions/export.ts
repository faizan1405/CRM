"use server";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { LeadStatus as PrismaLeadStatus, ActivityType } from "@prisma/client";
import { statusFromDatabase, type DatabaseLeadStatus } from "@/features/leads/types";
import { computeLeadFactsSync } from "@/features/ai-attention/services/lead-facts";
import {
  calculateTotalReceived,
  calculateRemainingBalance,
  derivePaymentStatus,
  getDaysOverdue,
  getTodayIST,
} from "@/features/deals/calculations";
import {
  formatISTDate,
  formatISTDateTime,
  formatISTTime,
} from "@/lib/export/formatters";
import type {
  LeadExportRow,
  DealExportRow,
  PaymentExportRow,
  OutstandingBalanceExportRow,
  FollowUpExportRow,
  BusinessSummaryData,
} from "@/lib/export/types";

class UserFacingError extends Error {}

async function requireAuthenticatedUser() {
  const session = await getSession();
  if (!session || typeof session.id !== "string") {
    throw new UserFacingError("You must be signed in to perform exports.");
  }
  return session;
}

/**
 * Fetch and transform active leads for export.
 * Strictly avoids exposing passwords, sessions, or internal database metadata.
 */
export async function fetchLeadsForExport(): Promise<LeadExportRow[]> {
  await requireAuthenticatedUser();

  const leads = await db.lead.findMany({
    where: { deletedAt: null },
    include: {
      followUps: {
        where: { status: "PENDING" },
        orderBy: { scheduledAt: "asc" },
        take: 1,
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          type: true,
          message: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return leads.map((lead) => {
    // Centralized stale calculation
    const facts = computeLeadFactsSync({
      id: lead.id,
      name: lead.name,
      status: lead.status,
      budget: lead.budget,
      quotedAmount: lead.quotedAmount,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      lastContactDate: lead.lastContactDate,
      activities: lead.activities,
      followUps: lead.followUps,
    });

    const activeFollowUp = lead.followUps[0];
    const nextFollowUpStr = activeFollowUp
      ? formatISTDateTime(activeFollowUp.scheduledAt)
      : "—";

    const lastAct = lead.activities[0];
    const lastActivityStr = lastAct
      ? `${formatISTDate(lastAct.createdAt)}: ${lastAct.message}`
      : "—";

    return {
      name: lead.name,
      business: lead.business || "",
      phone: lead.phone,
      email: lead.email || "",
      industry: lead.industry || "",
      source: lead.leadSource || "",
      status: statusFromDatabase[lead.status as DatabaseLeadStatus] || lead.status,
      quotedAmount: lead.quotedAmount != null ? Number(lead.quotedAmount) : null,
      nextFollowUp: nextFollowUpStr,
      lastActivity: lastActivityStr,
      isPinned: Boolean(lead.isPinned),
      isStale: facts.isStale,
      createdAt: formatISTDateTime(lead.createdAt),
    };
  });
}

/**
 * Fetch and transform deals for export.
 */
export async function fetchDealsForExport(): Promise<DealExportRow[]> {
  await requireAuthenticatedUser();

  const deals = await db.deal.findMany({
    include: {
      payments: {
        orderBy: { paymentDate: "desc" },
      },
      lead: {
        select: {
          id: true,
          name: true,
          business: true,
          phone: true,
          email: true,
          status: true,
          deletedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const todayIST = getTodayIST();

  return deals.map((deal) => {
    let clientType: "CRM Client" | "Other Client" | "Lead Deleted" = "Other Client";
    let clientName = deal.clientNameSnapshot || deal.lead?.name || "Unnamed Client";
    let company = deal.companyNameSnapshot || deal.lead?.business || "";

    if (deal.source === "CRM_LEAD") {
      if (deal.lead && deal.lead.deletedAt === null) {
        clientType = "CRM Client";
        clientName = deal.lead.name;
        company = deal.lead.business || deal.companyNameSnapshot || "";
      } else {
        clientType = "Lead Deleted";
        clientName = deal.clientNameSnapshot || deal.lead?.name || "Preserved Client";
        company = deal.companyNameSnapshot || deal.lead?.business || "";
      }
    }
    const finalAmount = Number(deal.finalAmount) || 0;
    const totalReceived = calculateTotalReceived(deal.payments.map((p) => ({ amount: Number(p.amount) })));
    const remainingBalance = calculateRemainingBalance(finalAmount, totalReceived);
    const nextDueDateStr = deal.nextPaymentDueDate ? deal.nextPaymentDueDate.toISOString().slice(0, 10) : null;
    const paymentStatus = derivePaymentStatus(finalAmount, totalReceived, nextDueDateStr, todayIST);

    return {
      clientName,
      clientType,
      company,
      projectName: deal.projectName || "",
      finalAmount,
      currency: deal.currency || "INR",
      totalReceived,
      remainingBalance,
      paymentStatus,
      nextPaymentDueDate: deal.nextPaymentDueDate ? formatISTDate(deal.nextPaymentDueDate) : "—",
      nextPaymentDueAmount: deal.nextPaymentDueAmount != null ? Number(deal.nextPaymentDueAmount) : null,
      dealStatus: deal.status,
      createdAt: formatISTDate(deal.createdAt),
    };
  });
}

/**
 * Fetch and transform payments for export.
 * Emits each payment as a separate row.
 */
export async function fetchPaymentsForExport(): Promise<PaymentExportRow[]> {
  await requireAuthenticatedUser();

  const payments = await db.payment.findMany({
    include: {
      deal: {
        include: {
          lead: {
            select: {
              name: true,
              business: true,
            },
          },
        },
      },
    },
    orderBy: { paymentDate: "desc" },
  });

  return payments.map((p) => {
    const clientName = p.deal.lead?.name || p.deal.clientNameSnapshot || "Unnamed Client";
    const dealOrProject = p.deal.projectName || p.deal.companyNameSnapshot || "Deal";

    return {
      clientName,
      dealOrProject,
      amount: Number(p.amount) || 0,
      paymentDate: formatISTDate(p.paymentDate),
      paymentType: p.customType ? `${p.type} (${p.customType})` : p.type,
      paymentMethod: p.method,
      reference: p.reference || "",
      note: p.note || "",
      createdAt: formatISTDateTime(p.createdAt),
    };
  });
}

/**
 * Fetch and transform outstanding balances for export.
 * Includes ONLY deals where remaining balance > 0.
 */
export async function fetchOutstandingBalancesForExport(): Promise<OutstandingBalanceExportRow[]> {
  await requireAuthenticatedUser();

  const deals = await db.deal.findMany({
    include: {
      payments: true,
      lead: {
        select: {
          name: true,
          business: true,
          deletedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const todayIST = getTodayIST();
  const rows: OutstandingBalanceExportRow[] = [];

  for (const deal of deals) {
    const finalAmount = Number(deal.finalAmount) || 0;
    const totalReceived = calculateTotalReceived(deal.payments.map((p) => ({ amount: Number(p.amount) })));
    const remaining = calculateRemainingBalance(finalAmount, totalReceived);

    if (remaining <= 0) continue; // Skip fully paid

    const nextDueDateStr = deal.nextPaymentDueDate ? deal.nextPaymentDueDate.toISOString().slice(0, 10) : null;
    const paymentStatus = derivePaymentStatus(finalAmount, totalReceived, nextDueDateStr, todayIST);
    const clientName = deal.lead?.name || deal.clientNameSnapshot || "Unnamed Client";
    const business = deal.lead?.business || deal.companyNameSnapshot || "";
    const daysOverdue = paymentStatus === "Overdue" ? getDaysOverdue(nextDueDateStr, todayIST) : 0;

    rows.push({
      clientName,
      business,
      dealValue: finalAmount,
      received: totalReceived,
      remaining,
      paymentStatus,
      nextDueDate: deal.nextPaymentDueDate ? formatISTDate(deal.nextPaymentDueDate) : "—",
      nextDueAmount: deal.nextPaymentDueAmount != null ? Number(deal.nextPaymentDueAmount) : null,
      daysOverdue: daysOverdue > 0 ? daysOverdue : 0,
    });
  }

  return rows;
}

/**
 * Fetch and transform follow-ups for export.
 * Adheres strictly to canonical single active follow-up rule.
 * Excludes completed and cancelled follow-ups, and older superseded rows.
 */
export async function fetchFollowUpsForExport(): Promise<FollowUpExportRow[]> {
  await requireAuthenticatedUser();

  const followUps = await db.followUp.findMany({
    where: {
      status: "PENDING",
      lead: {
        deletedAt: null,
      },
    },
    include: {
      lead: {
        select: {
          name: true,
          phone: true,
          status: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { scheduledAt: "asc" }],
  });

  const todayIST = getTodayIST();
  const seenLeadIds = new Set<string>();
  const rows: FollowUpExportRow[] = [];

  for (const f of followUps) {
    // Only the single active follow-up per lead
    if (seenLeadIds.has(f.leadId)) continue;
    seenLeadIds.add(f.leadId);

    const fDateStr = formatISTDate(f.scheduledAt);
    const fTimeStr = formatISTTime(f.scheduledAt);

    // Compute timing state in IST
    const scheduledIsoDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(f.scheduledAt);

    let timingState: "Today" | "Upcoming" | "Overdue" = "Upcoming";
    if (scheduledIsoDate < todayIST) {
      timingState = "Overdue";
    } else if (scheduledIsoDate === todayIST) {
      timingState = "Today";
    }

    rows.push({
      leadName: f.lead.name,
      phone: f.lead.phone,
      status: statusFromDatabase[f.lead.status as DatabaseLeadStatus] || f.lead.status,
      followUpDate: fDateStr,
      followUpTime: fTimeStr,
      followUpType: f.type,
      followUpNote: f.note || "",
      timingState,
    });
  }

  // Sort: Overdue first, then Today, then Upcoming
  const orderRank = { Overdue: 0, Today: 1, Upcoming: 2 };
  rows.sort((a, b) => orderRank[a.timingState] - orderRank[b.timingState]);

  return rows;
}

/**
 * Generate canonical Business Summary.
 * Reuses existing analytics and financial rules without duplicating calculations.
 */
export async function fetchBusinessSummary(
  period: "all_time" | "this_month" = "all_time"
): Promise<BusinessSummaryData> {
  await requireAuthenticatedUser();

  const todayIST = getTodayIST();
  const [yearStr, monthStr] = todayIST.split("-");
  const monthStart = new Date(`${yearStr}-${monthStr}-01T00:00:00.000Z`);

  const dateFilter =
    period === "this_month"
      ? { gte: monthStart }
      : undefined;

  // 1. Leads
  const leads = await db.lead.findMany({
    where: {
      deletedAt: null,
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    },
    include: {
      activities: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { type: true, message: true, createdAt: true },
      },
      followUps: {
        where: { status: "PENDING" },
        orderBy: { scheduledAt: "asc" },
        take: 1,
      },
    },
  });

  const totalLeads = leads.length;
  const qualifiedLeads = leads.filter((l) => l.status === PrismaLeadStatus.QUALIFIED).length;

  // Stale leads count
  let staleLeads = 0;
  for (const lead of leads) {
    if (lead.status === PrismaLeadStatus.WON || lead.status === PrismaLeadStatus.LOST) continue;
    const facts = computeLeadFactsSync({
      id: lead.id,
      name: lead.name,
      status: lead.status,
      budget: lead.budget,
      quotedAmount: lead.quotedAmount,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      lastContactDate: lead.lastContactDate,
      activities: lead.activities,
      followUps: lead.followUps,
    });
    if (facts.isStale) {
      staleLeads++;
    }
  }

  // 2. Deals & Payments
  const deals = await db.deal.findMany({
    where: dateFilter ? { createdAt: dateFilter } : undefined,
    include: {
      payments: true,
      lead: {
        select: { status: true },
      },
    },
  });

  let wonDeals = 0;
  let totalDealValue = 0;
  let totalReceived = 0;
  let totalOutstanding = 0;
  let totalOverdue = 0;

  for (const deal of deals) {
    const finalAmount = Number(deal.finalAmount) || 0;
    const dealReceived = calculateTotalReceived(deal.payments.map((p) => ({ amount: Number(p.amount) })));
    const dealRemaining = calculateRemainingBalance(finalAmount, dealReceived);

    totalDealValue += finalAmount;
    totalReceived += dealReceived;
    totalOutstanding += dealRemaining;

    const nextDueDateStr = deal.nextPaymentDueDate ? deal.nextPaymentDueDate.toISOString().slice(0, 10) : null;
    const status = derivePaymentStatus(finalAmount, dealReceived, nextDueDateStr, todayIST);
    if (status === "Overdue") {
      totalOverdue += dealRemaining;
    }

    if (deal.status === "CONFIRMED" || deal.status === "COMPLETED" || deal.lead?.status === "WON") {
      wonDeals++;
    }
  }

  // 3. Follow-ups Due (Today + Overdue)
  const activeFollowUps = await db.followUp.findMany({
    where: {
      status: "PENDING",
      lead: { deletedAt: null },
    },
    select: {
      leadId: true,
      scheduledAt: true,
    },
    orderBy: { scheduledAt: "asc" },
  });

  const seenFollowUpLeads = new Set<string>();
  let followUpsDue = 0;

  for (const f of activeFollowUps) {
    if (seenFollowUpLeads.has(f.leadId)) continue;
    seenFollowUpLeads.add(f.leadId);

    const fIsoDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(f.scheduledAt);

    if (fIsoDate <= todayIST) {
      followUpsDue++;
    }
  }

  return {
    period,
    periodLabel: period === "this_month" ? "This Month" : "All Time",
    totalLeads,
    qualifiedLeads,
    wonDeals,
    totalDealValue: Math.round(totalDealValue * 100) / 100,
    paymentsReceived: Math.round(totalReceived * 100) / 100,
    outstanding: Math.round(totalOutstanding * 100) / 100,
    overdue: Math.round(totalOverdue * 100) / 100,
    followUpsDue,
    staleLeads,
  };
}
