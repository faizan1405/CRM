import { Prisma } from "@prisma/client";

/**
 * ==============================================================================
 * CANONICAL FINANCIAL DEFINITIONS & CALCULATION ENGINE
 * ==============================================================================
 *
 * This module is the single source of truth for all financial and pipeline calculations
 * across Scale Flow CRM (Dashboard, Analytics, Deals & Payments).
 *
 * All core math is computed using Prisma.Decimal to prevent floating-point drift
 * (e.g. 0.1 + 0.2 = 0.30000000000000004).
 *
 * CANONICAL RULES:
 * 1. WON DEAL VALUE
 *    - UI Label: "Won Deal Value"
 *    - Meaning: Total finalized contract value of WON CRM deals.
 *    - Source: Deal.finalAmount
 *    - Valid filters: Lead.status === "WON" && !isWaste && deletedAt === null && mergedIntoLeadId === null
 *    - Requires Deal to exist with finalAmount > 0.
 *    - If WON Lead has no Deal: contributes ₹0 (NEVER fallback to Lead.quotedAmount).
 *
 * 2. MONEY RECEIVED
 *    - UI Label: "Money Received"
 *    - Meaning: Actual cash/payment transactions recorded in CRM.
 *    - Source: SUM(Payment.amount)
 *    - Exclude: soft-deleted payments (deletedAt !== null, if present)
 *    - NEVER use Deal.finalAmount for Money Received.
 *
 * 3. OUTSTANDING
 *    - For each Deal:
 *        outstanding = MAX(Deal.finalAmount - SUM(active Payment.amount), 0)
 *    - Overpayments cap at 0 (never negative).
 *    - Summed across the target deal population.
 *
 * 4. COLLECTION RATE
 *    - collectionRate = (Money Received / Contracted Deal Value) * 100
 *    - If contracted amount <= 0: return 0 (never NaN or Infinity).
 *
 * 5. OPEN PIPELINE VALUE
 *    - UI Label: "Open Pipeline Value"
 *    - Meaning: Estimated value of opportunities still in the SALES pipeline.
 *    - Active Stages: NEW, CONTACTED, QUALIFIED, PROPOSAL_SENT
 *    - Excluded: WON, LOST, Waste, Deleted, Merged-away Leads
 *    - Priority:
 *        IF associated Deal exists and finalAmount > 0 -> Deal.finalAmount
 *        ELSE IF Lead.quotedAmount exists and > 0 -> Lead.quotedAmount
 *        ELSE -> 0
 *
 * 6. PIPELINE HEALTH
 *    - Represents sales opportunity value by stage.
 *    - Stages NEW, CONTACTED, QUALIFIED, PROPOSAL_SENT use opportunity value.
 *    - Stage WON uses Deal.finalAmount (0 if no deal).
 *    - Stage LOST contributes 0.
 * ==============================================================================
 */

export type DecimalLike = Prisma.Decimal | number | string | null | undefined;

/**
 * Converts any DecimalLike value to a Prisma.Decimal safely.
 * Returns Decimal(0) for null, undefined, empty, or invalid input.
 */
export function toDecimal(val: DecimalLike): Prisma.Decimal {
  if (val === null || val === undefined) return new Prisma.Decimal(0);
  if (val instanceof Prisma.Decimal) return val;
  if (typeof val === "number") {
    if (isNaN(val) || !isFinite(val)) return new Prisma.Decimal(0);
    return new Prisma.Decimal(val);
  }
  const str = String(val).trim();
  if (!str) return new Prisma.Decimal(0);
  try {
    return new Prisma.Decimal(str);
  } catch {
    return new Prisma.Decimal(0);
  }
}

/**
 * Converts a Prisma.Decimal or DecimalLike to a rounded JavaScript number for presentation.
 * Default rounding is 2 decimal places.
 */
export function decimalToNumber(val: DecimalLike, decimalPlaces = 2): number {
  const dec = toDecimal(val);
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(dec.toNumber() * factor) / factor;
}

export type LeadFinancialRecord = {
  id?: string;
  status: string;
  isWaste?: boolean | null;
  deletedAt?: Date | string | null;
  mergedIntoLeadId?: string | null;
  quotedAmount?: DecimalLike;
  deal?: {
    finalAmount?: DecimalLike;
    status?: string | null;
  } | null;
};

export type PaymentFinancialRecord = {
  id?: string;
  dealId?: string;
  amount: DecimalLike;
  deletedAt?: Date | string | null;
  paymentDate?: Date | string | null;
};

export type DealFinancialRecord = {
  id: string;
  finalAmount: DecimalLike;
  status?: string | null;
  payments?: PaymentFinancialRecord[];
};

/**
 * Checks if a lead is an active legitimate business lead (not waste, deleted, or merged).
 */
export function isValidActiveLead(lead: {
  isWaste?: boolean | null;
  deletedAt?: Date | string | null;
  mergedIntoLeadId?: string | null;
}): boolean {
  if (lead.isWaste === true) return false;
  if (lead.deletedAt !== null && lead.deletedAt !== undefined) return false;
  if (lead.mergedIntoLeadId !== null && lead.mergedIntoLeadId !== undefined) return false;
  return true;
}

/**
 * 1. WON DEAL VALUE
 * Total finalized contract value of WON CRM deals.
 * Only include WON leads that are active, non-waste, non-deleted, non-merged.
 * Strictly uses Deal.finalAmount (₹0 if lead has no deal or deal amount is zero).
 */
export function calculateWonDealValue(leads: LeadFinancialRecord[]): Prisma.Decimal {
  let total = new Prisma.Decimal(0);
  for (const lead of leads) {
    if (lead.status !== "WON" || !isValidActiveLead(lead)) {
      continue;
    }
    if (lead.deal && lead.deal.finalAmount !== undefined && lead.deal.finalAmount !== null) {
      const dealAmount = toDecimal(lead.deal.finalAmount);
      if (dealAmount.gt(0)) {
        total = total.add(dealAmount);
      }
    }
  }
  return total;
}

/**
 * 2. MONEY RECEIVED (Collected)
 * Sum of all valid payment transactions.
 * Excludes soft-deleted payments (deletedAt != null).
 */
export function calculateCollected(payments: PaymentFinancialRecord[]): Prisma.Decimal {
  let total = new Prisma.Decimal(0);
  for (const payment of payments) {
    // Exclude soft-deleted payments if deletedAt property exists
    if (payment.deletedAt !== null && payment.deletedAt !== undefined) {
      continue;
    }
    const amt = toDecimal(payment.amount);
    if (amt.gt(0)) {
      total = total.add(amt);
    }
  }
  return total;
}

export const calculateMoneyReceived = calculateCollected;

/**
 * 3. OUTSTANDING PER DEAL
 * outstanding = MAX(finalAmount - activePayments, 0)
 * Overpayment is capped at 0 (never negative).
 */
export function calculateDealOutstanding(
  finalAmount: DecimalLike,
  paymentsOrCollected: PaymentFinancialRecord[] | DecimalLike
): Prisma.Decimal {
  const finalVal = toDecimal(finalAmount);
  let collectedVal: Prisma.Decimal;

  if (Array.isArray(paymentsOrCollected)) {
    collectedVal = calculateCollected(paymentsOrCollected);
  } else {
    collectedVal = toDecimal(paymentsOrCollected);
  }

  const remaining = finalVal.sub(collectedVal);
  return remaining.gt(0) ? remaining : new Prisma.Decimal(0);
}

/**
 * 3b. TOTAL OUTSTANDING
 * Sum of outstanding amounts across all deals in the population.
 */
export function calculateTotalOutstanding(deals: DealFinancialRecord[]): Prisma.Decimal {
  let total = new Prisma.Decimal(0);
  for (const deal of deals) {
    const outstanding = calculateDealOutstanding(deal.finalAmount, deal.payments || []);
    total = total.add(outstanding);
  }
  return total;
}

export const calculateOutstanding = calculateTotalOutstanding;

/**
 * 4. COLLECTION RATE
 * collectionRate = (Money Received / Contracted Deal Value) * 100
 * If contracted amount <= 0: return 0.
 */
export function calculateCollectionRate(
  moneyReceived: DecimalLike,
  contractedDealValue: DecimalLike
): Prisma.Decimal {
  const received = toDecimal(moneyReceived);
  const contracted = toDecimal(contractedDealValue);

  if (contracted.lte(0)) {
    return new Prisma.Decimal(0);
  }

  return received.div(contracted).mul(100);
}

/**
 * 5. GET OPPORTUNITY VALUE (for a single lead)
 * For active sales pipeline stages (NEW, CONTACTED, QUALIFIED, PROPOSAL_SENT):
 * - If associated Deal exists and finalAmount > 0 -> Deal.finalAmount
 * - Else if Lead.quotedAmount exists and > 0 -> Lead.quotedAmount
 * - Else -> 0
 * All other stages (WON, LOST, etc.) or inactive leads return 0.
 */
export function getOpportunityValue(
  lead: {
    status: string;
    isWaste?: boolean | null;
    deletedAt?: Date | string | null;
    mergedIntoLeadId?: string | null;
    quotedAmount?: DecimalLike;
  },
  deal?: {
    finalAmount?: DecimalLike;
  } | null
): Prisma.Decimal {
  if (!isValidActiveLead(lead)) {
    return new Prisma.Decimal(0);
  }

  const activeStages = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT"];
  if (!activeStages.includes(lead.status)) {
    return new Prisma.Decimal(0);
  }

  // 1. Prefer associated Deal finalAmount if > 0
  if (deal && deal.finalAmount !== undefined && deal.finalAmount !== null) {
    const dealAmount = toDecimal(deal.finalAmount);
    if (dealAmount.gt(0)) {
      return dealAmount;
    }
  }

  // 2. Fall back to Lead quotedAmount if > 0
  if (lead.quotedAmount !== undefined && lead.quotedAmount !== null) {
    const quoteAmount = toDecimal(lead.quotedAmount);
    if (quoteAmount.gt(0)) {
      return quoteAmount;
    }
  }

  return new Prisma.Decimal(0);
}

/**
 * 5b. OPEN PIPELINE VALUE
 * Total estimated value of all active pipeline opportunities.
 */
export function calculateOpenPipelineValue(leads: LeadFinancialRecord[]): Prisma.Decimal {
  let total = new Prisma.Decimal(0);
  for (const lead of leads) {
    total = total.add(getOpportunityValue(lead, lead.deal));
  }
  return total;
}

/**
 * Derives payment status for a deal:
 * - Paid: finalAmount > 0 && totalReceived >= finalAmount
 * - Overdue: remainingBalance > 0 && nextPaymentDueDate is in past
 * - Partially Paid: totalReceived > 0 && remainingBalance > 0
 * - Unpaid: totalReceived === 0
 */
export function derivePaymentStatus(
  finalAmount: DecimalLike,
  totalReceived: DecimalLike,
  nextPaymentDueDate: string | Date | null | undefined,
  referenceTodayStr?: string
): "Paid" | "Partially Paid" | "Overdue" | "Unpaid" {
  const finalVal = toDecimal(finalAmount);
  const recVal = toDecimal(totalReceived);
  const remaining = finalVal.sub(recVal);

  if (finalVal.gt(0) && recVal.gte(finalVal)) {
    return "Paid";
  }

  if (remaining.gt(0) && nextPaymentDueDate) {
    const dateStr = typeof nextPaymentDueDate === "string"
      ? nextPaymentDueDate.split("T")[0]
      : nextPaymentDueDate.toISOString().slice(0, 10);
    const today = referenceTodayStr || getTodayIST();
    if (dateStr < today) {
      return "Overdue";
    }
  }

  if (recVal.gt(0) && remaining.gt(0)) {
    return "Partially Paid";
  }

  return "Unpaid";
}

/**
 * Returns today's date in Indian Standard Time (IST, Asia/Kolkata) as YYYY-MM-DD.
 */
export function getTodayIST(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  }
}

/**
 * Formats Indian Currency with ₹ prefix cleanly.
 */
export function formatCurrency(amount: DecimalLike, currency = "INR"): string {
  if (amount === null || amount === undefined) return "—";
  const num = decimalToNumber(amount);
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  return `${symbol}${num.toLocaleString("en-IN")}`;
}
