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

export interface SerializedPayment {
  id: string;
  dealId: string;
  amount: number;
  paymentDate: string; // ISO or YYYY-MM-DD
  type: PaymentType;
  customType?: string | null;
  method: PaymentMethod;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedDeal {
  id: string;
  leadId: string | null;
  clientNameSnapshot?: string | null;
  companyNameSnapshot?: string | null;
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
    status: string;
  } | null;
}

export interface DealSummaryMetrics {
  totalDealValue: number;
  totalReceived: number;
  totalOutstanding: number;
  overdueAmount: number;
  totalDealsCount: number;
}

export type DealActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface UpsertDealInput {
  leadId?: string | null;
  dealId?: string | null;
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
}
