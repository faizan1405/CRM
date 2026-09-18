"use client";

import { useEffect, useRef } from "react";
import type { 
  SerializedDeal, 
  SerializedPayment,
} from "../types";
import { 
  DEAL_STATUS_LABELS, 
  PAYMENT_TYPE_LABELS, 
  PAYMENT_METHOD_LABELS 
} from "../types";
import { formatCurrency } from "../calculations";
import { 
  X, 
  Building2, 
  Phone, 
  Mail, 
  ExternalLink, 
  CreditCard, 
  Edit2, 
  Trash2, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FolderKanban, 
  FileText, 
  Plus, 
  History, 
  Receipt,
  User,
  ShieldAlert,
  Percent,
  Copy
} from "lucide-react";
import { useToast } from "@/components/toast-provider";

interface DealDetailPanelProps {
  deal: SerializedDeal | null;
  onClose: () => void;
  onRecordPayment: (deal: SerializedDeal) => void;
  onEditDeal: (deal: SerializedDeal) => void;
  onEditPayment?: (deal: SerializedDeal, payment: SerializedPayment) => void;
  onDeletePayment?: (deal: SerializedDeal, payment: SerializedPayment) => void;
  onDeleteDeal?: (deal: SerializedDeal) => void;
  onOpenLead?: (leadId: string) => void;
}

export function DealDetailPanel({
  deal,
  onClose,
  onRecordPayment,
  onEditDeal,
  onEditPayment,
  onDeletePayment,
  onDeleteDeal,
  onOpenLead,
}: DealDetailPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!deal) return null;

  const isCRMClient = deal.source === "CRM_LEAD";
  const hasLiveLead = isCRMClient && Boolean(deal.lead);
  const isDeletedLead = isCRMClient && !deal.lead;
  const isOtherClient = deal.source === "OTHER_CLIENT";

  const clientDisplayName = deal.lead?.name || deal.clientNameSnapshot || "Client";
  const companyDisplayName = deal.lead?.business || deal.companyNameSnapshot || "—";
  const phoneDisplay = deal.lead?.phone || deal.clientPhone || null;
  const emailDisplay = deal.lead?.email || deal.clientEmail || null;

  const percent = deal.finalAmount > 0 
    ? Math.min(100, Math.round((deal.totalReceived / deal.finalAmount) * 100)) 
    : 0;

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Paid":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Partially Paid":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Overdue":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard`, "info");
  };

  const formatDisplayDate = (isoStr?: string | null) => {
    if (!isoStr) return "—";
    try {
      const d = new Date(isoStr);
      if (Number.isNaN(d.getTime())) return isoStr;
      return d.toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-dvh">
      {/* Backdrop */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close deal details"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/45 transition-opacity"
      />

      {/* Slide-over panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="deal-detail-title"
        className="absolute inset-y-0 right-0 flex h-full min-h-0 w-full max-w-2xl flex-col bg-slate-50 shadow-2xl border-l border-slate-200 motion-safe:animate-[lead-panel-in_180ms_ease-out]"
      >
        {/* Header */}
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="deal-detail-title"
                className="truncate text-lg sm:text-xl font-bold tracking-tight text-slate-950"
              >
                {clientDisplayName}
              </h2>

              {/* Source Badge */}
              {isOtherClient && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                  Other Client
                </span>
              )}
              {hasLiveLead && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  CRM Client
                </span>
              )}
              {isDeletedLead && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <ShieldAlert size={12} /> Lead deleted
                </span>
              )}

              {/* Payment Status Badge */}
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadgeClass(deal.paymentStatus)}`}>
                {deal.paymentStatus === "Paid" && <CheckCircle2 size={12} />}
                {deal.paymentStatus === "Overdue" && <AlertCircle size={12} />}
                {deal.paymentStatus === "Partially Paid" && <Clock size={12} />}
                {deal.paymentStatus}
              </span>
            </div>

            <p className="mt-1 text-xs sm:text-sm text-slate-500 flex items-center gap-2">
              {deal.projectName ? (
                <span className="font-medium text-slate-700">Project: {deal.projectName}</span>
              ) : companyDisplayName !== "—" ? (
                <span>{companyDisplayName}</span>
              ) : (
                <span>Client Financial Record</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close deal details"
              className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <X aria-hidden="true" size={20} />
            </button>
          </div>
        </header>

        {/* Primary Action Bar (Low-Click UX) */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white/90 backdrop-blur-sm px-5 py-2.5 sm:px-6">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onRecordPayment(deal)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold transition-colors cursor-pointer shadow-sm"
              title="Record a new payment for this deal"
            >
              <CreditCard size={14} />
              <span>Record Payment</span>
            </button>

            <button
              type="button"
              onClick={() => onEditDeal(deal)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer shadow-sm"
              title="Edit deal and client information"
            >
              <Edit2 size={13} />
              <span>Edit Deal / Client</span>
            </button>

            {hasLiveLead && deal.lead && onOpenLead && (
              <button
                type="button"
                onClick={() => deal.lead && onOpenLead(deal.lead.id)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-blue-700 hover:bg-blue-50 text-xs font-semibold transition-colors cursor-pointer"
                title="View full lead record in CRM"
              >
                <span>View CRM Lead</span>
                <ExternalLink size={12} />
              </button>
            )}
          </div>

          {onDeleteDeal && (
            <button
              type="button"
              onClick={() => onDeleteDeal(deal)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Delete Financial Record"
              aria-label="Delete deal"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Preserved Deleted Lead Banner */}
          {isDeletedLead && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 flex items-start gap-3">
              <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block text-amber-900">
                  Lead Deleted (Financial Record Preserved)
                </strong>
                <p className="mt-0.5 text-amber-800 leading-relaxed">
                  The original CRM lead was deleted, but this client deal and its complete transaction history are permanently preserved. Historical client snapshots are displayed below.
                </p>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 1. CLIENT INFORMATION SECTION                            */}
          {/* ======================================================== */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <User size={15} className="text-blue-600" />
                Client Information
              </h3>
              {hasLiveLead && (
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Live Lead Connected
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <dt className="text-slate-400 uppercase text-[10px] font-bold">Client Name</dt>
                <dd className="mt-1 text-sm font-bold text-slate-900 flex items-center gap-2">
                  {clientDisplayName}
                </dd>
              </div>

              <div>
                <dt className="text-slate-400 uppercase text-[10px] font-bold">Business / Company</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  <Building2 size={13} className="text-slate-400 shrink-0" />
                  <span>{companyDisplayName}</span>
                </dd>
              </div>

              <div>
                <dt className="text-slate-400 uppercase text-[10px] font-bold">Phone</dt>
                <dd className="mt-1 text-sm font-medium text-slate-800 flex items-center gap-2">
                  {phoneDisplay ? (
                    <>
                      <a 
                        href={`tel:${phoneDisplay}`} 
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Phone size={12} className="shrink-0" />
                        <span>{phoneDisplay}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(phoneDisplay, "Phone number")}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                        title="Copy phone"
                      >
                        <Copy size={11} />
                      </button>
                    </>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-slate-400 uppercase text-[10px] font-bold">Email</dt>
                <dd className="mt-1 text-sm font-medium text-slate-800 flex items-center gap-2">
                  {emailDisplay ? (
                    <>
                      <a 
                        href={`mailto:${emailDisplay}`} 
                        className="text-blue-600 hover:underline flex items-center gap-1 truncate max-w-[200px]"
                      >
                        <Mail size={12} className="shrink-0" />
                        <span className="truncate">{emailDisplay}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(emailDisplay, "Email address")}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                        title="Copy email"
                      >
                        <Copy size={11} />
                      </button>
                    </>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </dd>
              </div>

              {/* CRM Live Lead Status & Link */}
              {hasLiveLead && deal.lead && (
                <div className="sm:col-span-2 pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400">CRM Lead Status:</span>
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800">
                      {deal.lead.status}
                    </span>
                  </div>
                  {onOpenLead && (
                    <button
                      type="button"
                      onClick={() => deal.lead && onOpenLead(deal.lead.id)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Open CRM Lead Details</span>
                      <ExternalLink size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ======================================================== */}
          {/* 2. DEAL INFORMATION SECTION                              */}
          {/* ======================================================== */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <FolderKanban size={15} className="text-blue-600" />
                Deal Information
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {DEAL_STATUS_LABELS[deal.status] || deal.status}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-slate-400 uppercase text-[10px] font-bold">Project / Deal Name</dt>
                <dd className="mt-1 text-sm font-bold text-slate-900">
                  {deal.projectName || "—"}
                </dd>
              </div>

              <div>
                <dt className="text-slate-400 uppercase text-[10px] font-bold">Quoted Amount</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-700">
                  {deal.quotedAmount ? formatCurrency(deal.quotedAmount, deal.currency) : "—"}
                </dd>
              </div>

              <div>
                <dt className="text-slate-400 uppercase text-[10px] font-bold">Final Deal Value</dt>
                <dd className="mt-1 text-sm font-bold text-slate-900">
                  {formatCurrency(deal.finalAmount, deal.currency)}
                </dd>
              </div>

              <div>
                <dt className="text-slate-400 uppercase text-[10px] font-bold">Currency</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-800">
                  {deal.currency || "INR"}
                </dd>
              </div>

              <div>
                <dt className="text-slate-400 uppercase text-[10px] font-bold">Created Date</dt>
                <dd className="mt-1 text-xs font-medium text-slate-600">
                  {formatDisplayDate(deal.createdAt)}
                </dd>
              </div>

              <div>
                <dt className="text-slate-400 uppercase text-[10px] font-bold">Last Updated</dt>
                <dd className="mt-1 text-xs font-medium text-slate-600">
                  {formatDisplayDate(deal.updatedAt)}
                </dd>
              </div>
            </div>
          </section>

          {/* ======================================================== */}
          {/* 3. PAYMENT SUMMARY                                       */}
          {/* ======================================================== */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Receipt size={15} className="text-emerald-600" />
                Payment Summary
              </h3>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadgeClass(deal.paymentStatus)}`}>
                {deal.paymentStatus}
              </span>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Deal Value</span>
                <span className="text-base sm:text-lg font-bold text-slate-900 mt-1 block">
                  {formatCurrency(deal.finalAmount, deal.currency)}
                </span>
              </div>

              <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">Received</span>
                <span className="text-base sm:text-lg font-bold text-emerald-700 mt-1 block">
                  {formatCurrency(deal.totalReceived, deal.currency)}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Remaining</span>
                <span className={`text-base sm:text-lg font-bold mt-1 block ${deal.remainingBalance > 0 ? "text-slate-900" : "text-slate-400"}`}>
                  {formatCurrency(deal.remainingBalance, deal.currency)}
                </span>
              </div>
            </div>

            {/* Collection Percentage Bar */}
            <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex justify-between text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1">
                  <Percent size={13} className="text-slate-400" />
                  Collection Percentage
                </span>
                <span className="text-slate-900 font-bold">{percent}%</span>
              </div>
              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${percent >= 100 ? "bg-emerald-500" : "bg-blue-600"}`} 
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>

            {/* Next Due Date Card */}
            {deal.nextPaymentDueDate && deal.remainingBalance > 0 && (
              <div className={`p-3 rounded-xl text-xs flex items-center justify-between border ${
                deal.paymentStatus === "Overdue" 
                  ? "bg-rose-50 text-rose-900 border-rose-200" 
                  : "bg-blue-50 text-blue-900 border-blue-100"
              }`}>
                <span className="flex items-center gap-2">
                  <Calendar size={15} className={deal.paymentStatus === "Overdue" ? "text-rose-600" : "text-blue-600"} />
                  <span>
                    Next Payment Due: <strong>{deal.nextPaymentDueDate}</strong>
                  </span>
                </span>
                {deal.nextPaymentDueAmount && (
                  <span className="font-bold text-sm">
                    {formatCurrency(deal.nextPaymentDueAmount, deal.currency)}
                  </span>
                )}
              </div>
            )}
          </section>

          {/* ======================================================== */}
          {/* 4. BUSINESS NOTES SECTION (Explicitly Isolated)          */}
          {/* ======================================================== */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <FileText size={15} className="text-blue-600" />
                Business &amp; Deal Notes
              </h3>
              <span className="text-[10px] text-slate-400 font-medium">Deal Scope / Terms</span>
            </div>

            <p className="text-[11px] text-slate-400 italic">
              These notes describe project scope and commercial terms. They remain permanent and separate from individual payment transaction notes.
            </p>

            {deal.notes && deal.notes.trim() ? (
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                {deal.notes}
              </div>
            ) : (
              <div className="bg-slate-50/50 rounded-xl p-3 border border-dashed border-slate-200 text-xs text-slate-400 italic flex items-center justify-between">
                <span>No deal notes recorded.</span>
                <button
                  type="button"
                  onClick={() => onEditDeal(deal)}
                  className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                >
                  + Add Notes
                </button>
              </div>
            )}
          </section>

          {/* ======================================================== */}
          {/* 5. PAYMENT HISTORY SECTION (Embedded Directly)           */}
          {/* ======================================================== */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History size={15} className="text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Payment History
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                  {deal.payments.length}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onRecordPayment(deal)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
              >
                <Plus size={13} /> Record Payment
              </button>
            </div>

            {deal.payments.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 space-y-2">
                <Receipt size={24} className="mx-auto text-slate-300" />
                <p className="italic">No payment transactions recorded yet.</p>
                <button
                  type="button"
                  onClick={() => onRecordPayment(deal)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer shadow-sm"
                >
                  <Plus size={13} /> Record First Payment
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-white">
                {deal.payments.map((payment) => (
                  <div 
                    key={payment.id} 
                    className="p-3.5 flex items-start justify-between gap-3 text-xs hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">
                          {formatCurrency(payment.amount, deal.currency)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {payment.type === "CUSTOM" && payment.customType 
                            ? payment.customType 
                            : PAYMENT_TYPE_LABELS[payment.type]}
                        </span>
                        <span className="text-slate-500 text-[11px] font-medium">
                          via {PAYMENT_METHOD_LABELS[payment.method]}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          • {payment.paymentDate}
                        </span>
                      </div>

                      {/* Individual Payment Note (distinct from Deal Note!) */}
                      {payment.note && (
                        <div className="text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100 inline-block mt-1">
                          <span className="text-slate-400 font-semibold mr-1">Payment Note:</span>
                          <span className="italic font-medium text-slate-700">“{payment.note}”</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      {onEditPayment && (
                        <button
                          type="button"
                          onClick={() => onEditPayment(deal, payment)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Edit payment"
                          aria-label="Edit payment"
                        >
                          <Edit2 size={13} />
                        </button>
                      )}
                      {onDeletePayment && (
                        <button
                          type="button"
                          onClick={() => onDeletePayment(deal, payment)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete payment"
                          aria-label="Delete payment"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
