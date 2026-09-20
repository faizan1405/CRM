export type ExportFormat = "csv" | "xlsx";

export type ExportTarget =
  | "leads"
  | "deals"
  | "payments"
  | "outstanding"
  | "followups"
  | "business-summary";

export interface ColumnDefinition<T> {
  header: string;
  key: string;
  width?: number;
  isNumeric?: boolean;
  numFmt?: string;
  getValue: (item: T) => string | number | null | undefined;
}

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  rowCount: number;
}

export interface LeadExportRow {
  name: string;
  business: string;
  phone: string;
  email: string;
  industry: string;
  source: string;
  status: string;
  quotedAmount: number | null;
  nextFollowUp: string;
  lastActivity: string;
  isPinned: boolean;
  isStale: boolean;
  createdAt: string;
}

export interface DealExportRow {
  clientName: string;
  clientType: "CRM Client" | "Other Client" | "Lead Deleted";
  company: string;
  projectName: string;
  finalAmount: number;
  currency: string;
  totalReceived: number;
  remainingBalance: number;
  paymentStatus: string;
  nextPaymentDueDate: string;
  nextPaymentDueAmount: number | null;
  dealStatus: string;
  createdAt: string;
}

export interface PaymentExportRow {
  clientName: string;
  dealOrProject: string;
  amount: number;
  paymentDate: string;
  paymentType: string;
  paymentMethod: string;
  reference: string;
  note: string;
  createdAt: string;
}

export interface OutstandingBalanceExportRow {
  clientName: string;
  business: string;
  dealValue: number;
  received: number;
  remaining: number;
  paymentStatus: string;
  nextDueDate: string;
  nextDueAmount: number | null;
  daysOverdue: number | string;
}

export interface FollowUpExportRow {
  leadName: string;
  phone: string;
  status: string;
  followUpDate: string;
  followUpTime: string;
  followUpType: string;
  followUpNote: string;
  timingState: "Today" | "Upcoming" | "Overdue";
}

export interface BusinessSummaryData {
  period: "all_time" | "this_month";
  periodLabel: string;
  totalLeads: number;
  qualifiedLeads: number;
  wonDeals: number;
  totalDealValue: number;
  paymentsReceived: number;
  outstanding: number;
  overdue: number;
  followUpsDue: number;
  staleLeads: number;
}

export interface BusinessSummaryMetricRow {
  metric: string;
  value: number | string;
  notes?: string;
}
