import type {
  PaymentStatus,
  DealSummaryMetrics,
  SerializedDeal,
  SerializedPayment,
  PaymentMethod,
  AnalyticsTimeFilter,
  PaymentTrendPoint,
  UpcomingPaymentItem,
  OverduePaymentItem,
  TopClientRankingItem,
  ClientTypeComparison,
  DealsAnalyticsData,
} from "./types";

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
 * Calculates collection rate as a percentage:
 * Collection Rate = Total Received / Total Deal Value * 100
 * Rounded to 2 decimal places. Returns 0 if totalDealValue is 0.
 */
export function calculateCollectionRate(totalReceived: number, totalDealValue: number): number {
  const dealVal = Number(totalDealValue) || 0;
  const recVal = Number(totalReceived) || 0;
  if (dealVal <= 0) return 0;
  const rate = (recVal / dealVal) * 100;
  return Math.round(rate * 100) / 100;
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
 * Checks if a due date (YYYY-MM-DD or ISO string) is strictly in the past compared to today in IST.
 */
export function isDueDatePassed(dueDateStr: string | null, referenceTodayStr?: string): boolean {
  if (!dueDateStr) return false;
  const datePart = dueDateStr.split("T")[0];
  const todayStr = referenceTodayStr || getTodayIST();
  return datePart < todayStr;
}

/**
 * Calculates how many days overdue a due date is relative to today in IST.
 * Returns 0 if not overdue.
 */
export function getDaysOverdue(dueDateStr: string | null, referenceTodayStr?: string): number {
  if (!dueDateStr) return 0;
  const datePart = dueDateStr.split("T")[0];
  const todayStr = referenceTodayStr || getTodayIST();
  if (datePart >= todayStr) return 0;

  const due = new Date(`${datePart}T00:00:00Z`);
  const today = new Date(`${todayStr}T00:00:00Z`);
  const diffMs = today.getTime() - due.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Calculates days remaining until a due date relative to today in IST.
 * Returns 0 if already due today or in the past.
 */
export function getDaysUntilDue(dueDateStr: string | null, referenceTodayStr?: string): number {
  if (!dueDateStr) return 0;
  const datePart = dueDateStr.split("T")[0];
  const todayStr = referenceTodayStr || getTodayIST();
  if (datePart < todayStr) return 0;

  const due = new Date(`${datePart}T00:00:00Z`);
  const today = new Date(`${todayStr}T00:00:00Z`);
  const diffMs = due.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
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
  nextPaymentDueDate: string | null,
  referenceTodayStr?: string
): PaymentStatus {
  const finalVal = Number(finalAmount) || 0;
  const receivedVal = Number(totalReceived) || 0;
  const remaining = calculateRemainingBalance(finalVal, receivedVal);

  if (finalVal > 0 && receivedVal >= finalVal) {
    return "Paid";
  }

  const isOverdue = remaining > 0 && isDueDatePassed(nextPaymentDueDate, referenceTodayStr);
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
  let paidDealsCount = 0;
  let partiallyPaidDealsCount = 0;
  let unpaidDealsCount = 0;
  let overdueDealsCount = 0;

  for (const deal of deals) {
    const finalVal = Number(deal.finalAmount) || 0;
    const recVal = Number(deal.totalReceived) || 0;
    const remVal = Number(deal.remainingBalance) || 0;

    totalDealValue += finalVal;
    totalReceived += recVal;
    totalOutstanding += remVal;

    if (deal.paymentStatus === "Paid") {
      paidDealsCount++;
    } else if (deal.paymentStatus === "Partially Paid") {
      partiallyPaidDealsCount++;
    } else if (deal.paymentStatus === "Overdue") {
      overdueAmount += remVal;
      overdueDealsCount++;
    } else {
      unpaidDealsCount++;
    }
  }

  const roundedDealValue = Math.round(totalDealValue * 100) / 100;
  const roundedReceived = Math.round(totalReceived * 100) / 100;
  const roundedOutstanding = Math.round(totalOutstanding * 100) / 100;
  const roundedOverdue = Math.round(overdueAmount * 100) / 100;
  const collectionRate = calculateCollectionRate(roundedReceived, roundedDealValue);

  return {
    totalDealValue: roundedDealValue,
    totalReceived: roundedReceived,
    totalOutstanding: roundedOutstanding,
    overdueAmount: roundedOverdue,
    totalDealsCount: deals.length,
    collectionRate,
    paidDealsCount,
    partiallyPaidDealsCount,
    unpaidDealsCount,
    overdueDealsCount,
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

export interface DateRange {
  start?: string; // YYYY-MM-DD
  end?: string;   // YYYY-MM-DD
}

/**
 * Returns the date boundary for a given AnalyticsTimeFilter in IST.
 */
export function getDateRangeForFilter(filter: AnalyticsTimeFilter, referenceToday?: string): DateRange {
  const todayStr = referenceToday || getTodayIST();
  const parts = todayStr.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);

  if (filter === "this_month") {
    const start = `${parts[0]}-${parts[1]}-01`;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const end = `${parts[0]}-${parts[1]}-${String(lastDay).padStart(2, "0")}`;
    return { start, end };
  }

  if (filter === "last_month") {
    const prevMonthYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevMonthStr = String(prevMonth).padStart(2, "0");
    const start = `${prevMonthYear}-${prevMonthStr}-01`;
    const lastDay = new Date(Date.UTC(prevMonthYear, prevMonth, 0)).getUTCDate();
    const end = `${prevMonthYear}-${prevMonthStr}-${String(lastDay).padStart(2, "0")}`;
    return { start, end };
  }

  if (filter === "last_30_days") {
    const end = todayStr;
    const todayDate = new Date(`${todayStr}T00:00:00Z`);
    const startDate = new Date(todayDate.getTime() - 29 * 24 * 60 * 60 * 1000);
    const start = startDate.toISOString().slice(0, 10);
    return { start, end };
  }

  if (filter === "this_year") {
    return {
      start: `${parts[0]}-01-01`,
      end: `${parts[0]}-12-31`,
    };
  }

  // "all_time"
  return {};
}

/**
 * Checks if a given date string (YYYY-MM-DD or ISO) is within a DateRange inclusive.
 */
export function isDateInRange(dateStr: string | null | undefined, range: DateRange): boolean {
  if (!dateStr) return false;
  const d = dateStr.split("T")[0];
  if (range.start && d < range.start) return false;
  if (range.end && d > range.end) return false;
  return true;
}

/**
 * Format a date string YYYY-MM-DD into a clean short readable label (e.g. "20 Sep").
 */
export function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const clean = dateStr.split("T")[0];
    const [year, month, day] = clean.split("-");
    const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  } catch {
    return dateStr.split("T")[0];
  }
}

/**
 * Comprehensive Deals & Payments Analytics calculation.
 * Accurately calculates money received strictly from Payment records,
 * computes outstanding/overdue, upcoming payments, top clients,
 * payment method breakdown, payment trends, and CRM vs Other comparison.
 */
export function calculateDealsAnalytics(
  deals: SerializedDeal[],
  timeFilter: AnalyticsTimeFilter = "all_time",
  referenceTodayStr?: string
): DealsAnalyticsData {
  const todayStr = referenceTodayStr || getTodayIST();
  const dateRange = getDateRangeForFilter(timeFilter, todayStr);

  // 1. Gather all payments from all scoped deals
  const allScopedPayments: Array<SerializedPayment & { dealClientName: string; dealCurrency: string; source: string }> = [];
  
  for (const deal of deals) {
    const clientName = deal.lead?.name || deal.clientNameSnapshot || "Unnamed Client";
    for (const p of deal.payments) {
      allScopedPayments.push({
        ...p,
        dealClientName: clientName,
        dealCurrency: deal.currency || "INR",
        source: deal.source,
      });
    }
  }

  // Filter payments by timeFilter (using payment.paymentDate)
  const filteredPayments = timeFilter === "all_time"
    ? allScopedPayments
    : allScopedPayments.filter((p) => isDateInRange(p.paymentDate, dateRange));

  // 2. Deals in timeFilter scope (using deal.createdAt for period deal metrics, or all for all_time)
  const filteredDeals = timeFilter === "all_time"
    ? deals
    : deals.filter((d) => isDateInRange(d.createdAt, dateRange));

  // 3. Core KPIs
  // Deal Value from scoped deals
  const totalDealValue = filteredDeals.reduce((sum, d) => sum + (Number(d.finalAmount) || 0), 0);

  // Total Received MUST strictly come from Payment records
  const totalReceived = filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Total Outstanding across all currently active scoped deals: max(0, finalDealValue - paymentSum)
  let totalOutstanding = 0;
  let overdueAmount = 0;
  let paidDealsCount = 0;
  let partiallyPaidDealsCount = 0;
  let unpaidDealsCount = 0;
  let overdueDealsCount = 0;

  for (const deal of filteredDeals) {
    const dealReceived = calculateTotalReceived(deal.payments);
    const dealRemaining = calculateRemainingBalance(deal.finalAmount, dealReceived);
    totalOutstanding += dealRemaining;

    const status = derivePaymentStatus(deal.finalAmount, dealReceived, deal.nextPaymentDueDate, todayStr);
    if (status === "Paid") {
      paidDealsCount++;
    } else if (status === "Partially Paid") {
      partiallyPaidDealsCount++;
    } else if (status === "Overdue") {
      overdueAmount += dealRemaining;
      overdueDealsCount++;
    } else {
      unpaidDealsCount++;
    }
  }

  const roundedDealValue = Math.round(totalDealValue * 100) / 100;
  const roundedReceived = Math.round(totalReceived * 100) / 100;
  const roundedOutstanding = Math.round(totalOutstanding * 100) / 100;
  const roundedOverdue = Math.round(overdueAmount * 100) / 100;
  const upcomingOutstanding = Math.max(0, Math.round((roundedOutstanding - roundedOverdue) * 100) / 100);
  const collectionRate = calculateCollectionRate(roundedReceived, roundedDealValue);

  // 4. Upcoming Payments: deals with remaining balance > 0 and nextPaymentDueDate >= today
  const upcomingPaymentsList: UpcomingPaymentItem[] = [];
  const overduePaymentsList: OverduePaymentItem[] = [];

  // Evaluate across scoped deals to catch upcoming and overdue obligations
  for (const deal of deals) {
    const dealRec = calculateTotalReceived(deal.payments);
    const remaining = calculateRemainingBalance(deal.finalAmount, dealRec);
    if (remaining <= 0) continue;

    const clientName = deal.lead?.name || deal.clientNameSnapshot || "Unnamed Client";
    const companyOrProject = deal.lead?.business || deal.companyNameSnapshot || deal.projectName || null;

    if (deal.nextPaymentDueDate) {
      const isOverdue = isDueDatePassed(deal.nextPaymentDueDate, todayStr);
      if (isOverdue) {
        overduePaymentsList.push({
          dealId: deal.id,
          clientName,
          companyOrProject,
          outstandingAmount: remaining,
          dueDate: deal.nextPaymentDueDate,
          daysOverdue: getDaysOverdue(deal.nextPaymentDueDate, todayStr),
          currency: deal.currency || "INR",
        });
      } else {
        const amountDue = deal.nextPaymentDueAmount && deal.nextPaymentDueAmount > 0
          ? Math.min(deal.nextPaymentDueAmount, remaining)
          : remaining;
        upcomingPaymentsList.push({
          dealId: deal.id,
          clientName,
          companyOrProject,
          amountDue,
          dueDate: deal.nextPaymentDueDate,
          daysRemaining: getDaysUntilDue(deal.nextPaymentDueDate, todayStr),
          currency: deal.currency || "INR",
        });
      }
    }
  }

  // Sort upcoming payments: nearest due date first
  upcomingPaymentsList.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // Sort overdue payments: highest days overdue first, then highest outstanding
  overduePaymentsList.sort((a, b) => {
    if (b.daysOverdue !== a.daysOverdue) {
      return b.daysOverdue - a.daysOverdue;
    }
    return b.outstandingAmount - a.outstandingAmount;
  });

  // 5. Payment Trends (Daily, Weekly, Monthly) from filteredPayments
  const dailyMap = new Map<string, { amount: number; count: number }>();
  const weeklyMap = new Map<string, { amount: number; count: number; sortKey: string }>();
  const monthlyMap = new Map<string, { amount: number; count: number; sortKey: string }>();

  for (const p of filteredPayments) {
    const pDate = p.paymentDate.split("T")[0];
    const amt = Number(p.amount) || 0;

    // Daily
    const curDaily = dailyMap.get(pDate) || { amount: 0, count: 0 };
    dailyMap.set(pDate, { amount: curDaily.amount + amt, count: curDaily.count + 1 });

    // Weekly
    try {
      const [y, m, d] = pDate.split("-").map(Number);
      const dateObj = new Date(Date.UTC(y, m - 1, d));
      const dayOfWeek = dateObj.getUTCDay();
      const diffToMonday = (dayOfWeek + 6) % 7;
      const monday = new Date(dateObj.getTime() - diffToMonday * 24 * 60 * 60 * 1000);
      const monStr = monday.toISOString().slice(0, 10);
      const label = `${formatShortDate(monStr)} - ${formatShortDate(new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))}`;

      const curWeekly = weeklyMap.get(label) || { amount: 0, count: 0, sortKey: monStr };
      weeklyMap.set(label, { amount: curWeekly.amount + amt, count: curWeekly.count + 1, sortKey: monStr });
    } catch {
      // fallback
    }

    // Monthly
    const monthKey = pDate.slice(0, 7); // YYYY-MM
    try {
      const [y, m] = monthKey.split("-").map(Number);
      const dateObj = new Date(Date.UTC(y, m - 1, 1));
      const monthLabel = dateObj.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
      const curMonthly = monthlyMap.get(monthLabel) || { amount: 0, count: 0, sortKey: monthKey };
      monthlyMap.set(monthLabel, { amount: curMonthly.amount + amt, count: curMonthly.count + 1, sortKey: monthKey });
    } catch {
      // fallback
    }
  }

  const dailyTrend: PaymentTrendPoint[] = Array.from(dailyMap.entries())
    .map(([key, data]) => ({
      key,
      label: formatShortDate(key),
      amount: Math.round(data.amount * 100) / 100,
      count: data.count,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const weeklyTrend: PaymentTrendPoint[] = Array.from(weeklyMap.entries())
    .map(([label, data]) => ({
      key: data.sortKey,
      label,
      amount: Math.round(data.amount * 100) / 100,
      count: data.count,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const monthlyTrend: PaymentTrendPoint[] = Array.from(monthlyMap.entries())
    .map(([label, data]) => ({
      key: data.sortKey,
      label,
      amount: Math.round(data.amount * 100) / 100,
      count: data.count,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  // 6. Top Clients aggregations
  const clientAggMap = new Map<string, TopClientRankingItem>();

  for (const deal of filteredDeals) {
    const clientName = (deal.lead?.name || deal.clientNameSnapshot || "Unnamed Client").trim();
    const companyOrProject = deal.lead?.business || deal.companyNameSnapshot || deal.projectName || null;
    const dealReceived = calculateTotalReceived(deal.payments);
    const dealOutstanding = calculateRemainingBalance(deal.finalAmount, dealReceived);

    const existing = clientAggMap.get(clientName) || {
      clientName,
      companyOrProject,
      dealCount: 0,
      totalDealValue: 0,
      totalReceived: 0,
      totalOutstanding: 0,
    };

    clientAggMap.set(clientName, {
      ...existing,
      companyOrProject: existing.companyOrProject || companyOrProject,
      dealCount: existing.dealCount + 1,
      totalDealValue: Math.round((existing.totalDealValue + deal.finalAmount) * 100) / 100,
      totalReceived: Math.round((existing.totalReceived + dealReceived) * 100) / 100,
      totalOutstanding: Math.round((existing.totalOutstanding + dealOutstanding) * 100) / 100,
    });
  }

  const allClients = Array.from(clientAggMap.values());
  const topByDealValue = [...allClients].sort((a, b) => b.totalDealValue - a.totalDealValue);
  const topByReceived = [...allClients].sort((a, b) => b.totalReceived - a.totalReceived);
  const topByOutstanding = [...allClients].sort((a, b) => b.totalOutstanding - a.totalOutstanding);

  // 7. Payment Methods Breakdown
  const methodTotals: Record<PaymentMethod, { amount: number; count: number; percentage: number }> = {
    UPI: { amount: 0, count: 0, percentage: 0 },
    BANK_TRANSFER: { amount: 0, count: 0, percentage: 0 },
    CASH: { amount: 0, count: 0, percentage: 0 },
    CARD: { amount: 0, count: 0, percentage: 0 },
    PAYPAL: { amount: 0, count: 0, percentage: 0 },
    OTHER: { amount: 0, count: 0, percentage: 0 },
  };

  for (const p of filteredPayments) {
    const method = (p.method in methodTotals ? p.method : "OTHER") as PaymentMethod;
    const amt = Number(p.amount) || 0;
    methodTotals[method].amount += amt;
    methodTotals[method].count += 1;
  }

  for (const key of Object.keys(methodTotals) as PaymentMethod[]) {
    methodTotals[key].amount = Math.round(methodTotals[key].amount * 100) / 100;
    methodTotals[key].percentage = roundedReceived > 0
      ? Math.round((methodTotals[key].amount / roundedReceived) * 10000) / 100
      : 0;
  }

  // 8. CRM vs Other Clients Comparison (computed across filteredDeals)
  const crmDeals = filteredDeals.filter((d) => d.source === "CRM_LEAD");
  const otherDeals = filteredDeals.filter((d) => d.source === "OTHER_CLIENT");

  const calcClientComparison = (dealList: SerializedDeal[]): ClientTypeComparison => {
    let dealValue = 0;
    let received = 0;
    let outstanding = 0;

    for (const d of dealList) {
      dealValue += Number(d.finalAmount) || 0;
      const rec = calculateTotalReceived(d.payments);
      received += rec;
      outstanding += calculateRemainingBalance(d.finalAmount, rec);
    }

    const roundedVal = Math.round(dealValue * 100) / 100;
    const roundedRec = Math.round(received * 100) / 100;
    const roundedOut = Math.round(outstanding * 100) / 100;
    const rate = calculateCollectionRate(roundedRec, roundedVal);

    return {
      dealValue: roundedVal,
      received: roundedRec,
      outstanding: roundedOut,
      dealsCount: dealList.length,
      collectionRate: rate,
    };
  };

  const crmClients = calcClientComparison(crmDeals);
  const otherClients = calcClientComparison(otherDeals);

  return {
    timeFilter,
    totalDealValue: roundedDealValue,
    totalReceived: roundedReceived,
    totalOutstanding: roundedOutstanding,
    overdueAmount: roundedOverdue,
    collectionRate,
    totalDealsCount: filteredDeals.length,
    paidDealsCount,
    partiallyPaidDealsCount,
    unpaidDealsCount,
    overdueDealsCount,
    upcomingOutstanding,
    dailyTrend,
    weeklyTrend,
    monthlyTrend,
    upcomingPayments: upcomingPaymentsList,
    overduePayments: overduePaymentsList,
    topByDealValue,
    topByReceived,
    topByOutstanding,
    paymentMethodsBreakdown: methodTotals,
    totalPaymentsCount: filteredPayments.length,
    crmClients,
    otherClients,
  };
}

/**
 * Formats date into "18 Sep 2026" format safely across timezones.
 */
export function formatDisplayDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const raw = typeof dateStr === "string" ? (dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00Z`) : dateStr;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: typeof dateStr === "string" && !dateStr.includes("T") ? "UTC" : undefined,
    });
  } catch {
    return String(dateStr);
  }
}

/**
 * Formats timestamp into "18 Sep 2026, 09:30 AM" format.
 */
export function formatDisplayDateTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(dateStr);
  }
}

/**
 * Calculates remaining balance after a specific payment in chronological sequence.
 */
export function calculateRemainingAfterPayment(
  dealFinalAmount: number,
  payments: Array<{ id: string; amount: number; paymentDate: string; createdAt?: string }>,
  currentPaymentId: string
): number {
  const finalVal = Number(dealFinalAmount) || 0;
  const sorted = [...payments].sort((a, b) => {
    const dateA = new Date(a.paymentDate).getTime();
    const dateB = new Date(b.paymentDate).getTime();
    if (dateA !== dateB) return dateA - dateB;
    const createA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const createB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return createA - createB;
  });

  let cumulative = 0;
  for (const p of sorted) {
    cumulative += Number(p.amount) || 0;
    if (p.id === currentPaymentId) {
      break;
    }
  }

  const remaining = Math.max(0, finalVal - cumulative);
  return Math.round(remaining * 100) / 100;
}

