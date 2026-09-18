import type { PaymentStatus, DealSummaryMetrics } from "./types";

/**
 * Calculates total received from a list of payment records.
 * Sums amounts accurately without floating point drift.
 */
export function calculateTotalReceived(payments: Array<{ amount: number }>): number {
  if (!payments || payments.length === 0) return 0;
  const total = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  return Math.round(total * 100) / 100;
}

/**
 * Calculates remaining balance:
 * Remaining = Final Deal Value - Total Payments Received
 * Never returns negative if overpaid (caps at 0).
 */
export function calculateRemainingBalance(finalAmount: number, totalReceived: number): number {
  const finalVal = Number(finalAmount) || 0;
  const receivedVal = Number(totalReceived) || 0;
  const remaining = Math.max(0, finalVal - receivedVal);
  return Math.round(remaining * 100) / 100;
}

/**
 * Checks if a due date (YYYY-MM-DD or ISO string) is strictly in the past compared to today.
 */
export function isDueDatePassed(dueDateStr: string | null): boolean {
  if (!dueDateStr) return false;
  // Parse YYYY-MM-DD
  const datePart = dueDateStr.split("T")[0];
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;
  return datePart < todayStr;
}

/**
 * Derives payment status:
 * - Paid: totalReceived >= finalAmount (where finalAmount > 0)
 * - Overdue: remainingBalance > 0 AND nextPaymentDueDate is in past
 * - Partially Paid: totalReceived > 0 AND remainingBalance > 0 AND not overdue
 * - Unpaid: totalReceived === 0 AND not overdue
 */
export function derivePaymentStatus(
  finalAmount: number,
  totalReceived: number,
  nextPaymentDueDate: string | null
): PaymentStatus {
  const finalVal = Number(finalAmount) || 0;
  const receivedVal = Number(totalReceived) || 0;
  const remaining = calculateRemainingBalance(finalVal, receivedVal);

  if (finalVal > 0 && receivedVal >= finalVal) {
    return "Paid";
  }

  const isOverdue = remaining > 0 && isDueDatePassed(nextPaymentDueDate);
  if (isOverdue) {
    return "Overdue";
  }

  if (receivedVal > 0 && remaining > 0) {
    return "Partially Paid";
  }

  return "Unpaid";
}

/**
 * Calculates summary metrics for the Deal / Payments overview page.
 */
export function calculateDealMetrics(
  deals: Array<{
    finalAmount: number;
    totalReceived: number;
    remainingBalance: number;
    paymentStatus: PaymentStatus;
  }>
): DealSummaryMetrics {
  let totalDealValue = 0;
  let totalReceived = 0;
  let totalOutstanding = 0;
  let overdueAmount = 0;

  for (const deal of deals) {
    totalDealValue += Number(deal.finalAmount) || 0;
    totalReceived += Number(deal.totalReceived) || 0;
    totalOutstanding += Number(deal.remainingBalance) || 0;
    if (deal.paymentStatus === "Overdue") {
      overdueAmount += Number(deal.remainingBalance) || 0;
    }
  }

  return {
    totalDealValue: Math.round(totalDealValue * 100) / 100,
    totalReceived: Math.round(totalReceived * 100) / 100,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    overdueAmount: Math.round(overdueAmount * 100) / 100,
    totalDealsCount: deals.length,
  };
}

/**
 * Formats Indian Currency with ₹ prefix.
 */
export function formatCurrency(amount: number | null | undefined, currency = "INR"): string {
  if (amount === null || amount === undefined) return "—";
  const num = Number(amount);
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  return `${symbol}${num.toLocaleString("en-IN")}`;
}
