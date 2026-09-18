export type DealStatus = "NO_DEAL" | "NEGOTIATING" | "CONFIRMED" | "COMPLETED";

export type PaymentStatus = "Unpaid" | "Partially Paid" | "Paid" | "Overdue";

export type PaymentType = "ADVANCE" | "PARTIAL" | "FINAL" | "CUSTOM";

export type PaymentMethod = "UPI" | "BANK_TRANSFER" | "CASH" | "CARD" | "PAYPAL" | "OTHER";

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  NO_DEAL: "No Deal",
  NEGOTIATING: "Negotiating",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  ADVANCE: "Advance",
  PARTIAL: "Partial Payment",
  FINAL: "Final Payment",
  CUSTOM: "Custom",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  UPI: "UPI",
  BANK_TRANSFER: "Bank Transfer",
  CASH: "Cash",
  CARD: "Card",
  PAYPAL: "PayPal",
  OTHER: "Other",
};

export type DealSource = "CRM_LEAD" | "OTHER_CLIENT";

export interface SerializedPayment {
  id: string;
  dealId: string;
  amount: number;
  paymentDate: string; // ISO or YYYY-MM-DD
  type: PaymentType;
  customType?: string | null;
  method: PaymentMethod;
  note?: string | null;
  reference?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedDeal {
  id: string;
  source: DealSource;
  leadId: string | null;
  clientNameSnapshot?: string | null;
  companyNameSnapshot?: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
  projectName?: string | null;
  notes?: string | null;
  quotedAmount: number | null;
  finalAmount: number;
  currency: string;
  status: DealStatus;
  nextPaymentDueDate: string | null; // YYYY-MM-DD
  nextPaymentDueAmount: number | null;
  payments: SerializedPayment[];
  createdAt: string;
  updatedAt: string;
  // Computed tracking properties
  totalReceived: number;
  remainingBalance: number;
  paymentStatus: PaymentStatus;
  lead?: {
    id: string;
    name: string;
    business?: string | null;
    phone: string;
    email?: string | null;
    status: string;
  } | null;
}

export interface DealSummaryMetrics {
  totalDealValue: number;
  totalReceived: number;
  totalOutstanding: number;
  overdueAmount: number;
  totalDealsCount: number;
  collectionRate?: number;
  paidDealsCount?: number;
  partiallyPaidDealsCount?: number;
  unpaidDealsCount?: number;
  overdueDealsCount?: number;
}

export type DealActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface CreateOtherClientDealInput {
  clientName: string;
  finalAmount: number;
  companyName?: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
  projectName?: string | null;
  currency?: string;
  status?: DealStatus;
  nextPaymentDueDate?: string | null;
  nextPaymentDueAmount?: number | null;
  notes?: string | null;
}

export interface UpsertDealInput {
  leadId?: string | null;
  dealId?: string | null;
  clientName?: string | null;
  companyName?: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
  projectName?: string | null;
  notes?: string | null;
  quotedAmount?: number | null;
  finalAmount: number;
  currency?: string;
  status?: DealStatus;
  nextPaymentDueDate?: string | null;
  nextPaymentDueAmount?: number | null;
}

export interface RecordPaymentInput {
  dealId: string;
  amount: number;
  paymentDate?: string;
  type: PaymentType;
  customType?: string;
  method: PaymentMethod;
  note?: string;
  reference?: string;
}

export type AnalyticsTimeFilter = "all_time" | "this_month" | "last_month" | "last_30_days" | "this_year";

export type TrendInterval = "daily" | "weekly" | "monthly";

export interface PaymentTrendPoint {
  key: string;
  label: string;
  amount: number;
  count: number;
}

export interface UpcomingPaymentItem {
  dealId: string;
  clientName: string;
  companyOrProject?: string | null;
  amountDue: number;
  dueDate: string;
  daysRemaining: number;
  currency: string;
}

export interface OverduePaymentItem {
  dealId: string;
  clientName: string;
  companyOrProject?: string | null;
  outstandingAmount: number;
  dueDate: string;
  daysOverdue: number;
  currency: string;
}

export interface TopClientRankingItem {
  clientName: string;
  companyOrProject?: string | null;
  dealCount: number;
  totalDealValue: number;
  totalReceived: number;
  totalOutstanding: number;
}

export interface ClientTypeComparison {
  dealValue: number;
  received: number;
  outstanding: number;
  dealsCount: number;
  collectionRate: number;
}

export interface DealsAnalyticsData {
  timeFilter: AnalyticsTimeFilter;
  // Core KPIs
  totalDealValue: number;
  totalReceived: number;
  totalOutstanding: number;
  overdueAmount: number;
  collectionRate: number;
  // Counts
  totalDealsCount: number;
  paidDealsCount: number;
  partiallyPaidDealsCount: number;
  unpaidDealsCount: number;
  overdueDealsCount: number;
  // Outstanding breakdown
  upcomingOutstanding: number;
  // Payment trend
  dailyTrend: PaymentTrendPoint[];
  weeklyTrend: PaymentTrendPoint[];
  monthlyTrend: PaymentTrendPoint[];
  // Lists
  upcomingPayments: UpcomingPaymentItem[];
  overduePayments: OverduePaymentItem[];
  // Top Clients
  topByDealValue: TopClientRankingItem[];
  topByReceived: TopClientRankingItem[];
  topByOutstanding: TopClientRankingItem[];
  // Payment Methods
  paymentMethodsBreakdown: Record<PaymentMethod, { amount: number; count: number; percentage: number }>;
  totalPaymentsCount: number;
  // Comparison (for All Deals)
  crmClients: ClientTypeComparison;
  otherClients: ClientTypeComparison;
}

