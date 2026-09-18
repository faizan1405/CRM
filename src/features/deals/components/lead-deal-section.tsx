"use client";

import { useEffect, useState } from "react";
import { 
  getLeadDeal, 
  upsertLeadDeal, 
  addDealPayment, 
  updateDealPayment, 
  deleteDealPayment 
} from "@/app/actions/deals";
import type { 
  SerializedDeal, 
  SerializedPayment, 
  DealStatus, 
  PaymentType, 
  PaymentMethod 
} from "../types";
import { 
  DEAL_STATUS_LABELS, 
  PAYMENT_TYPE_LABELS, 
  PAYMENT_METHOD_LABELS 
} from "../types";
import { formatCurrency } from "../calculations";
import { 
  Receipt, 
  Plus, 
  Edit2, 
  Trash2, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  X,
  CreditCard
} from "lucide-react";
import { useToast } from "@/components/toast-provider";

interface LeadDealSectionProps {
  leadId: string;
  leadQuotedAmount?: number | null;
}

export function LeadDealSection({ leadId, leadQuotedAmount }: LeadDealSectionProps) {
  const [deal, setDeal] = useState<SerializedDeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<SerializedPayment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<SerializedPayment | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  // Load deal
  const loadDeal = async () => {
    try {
      const res = await getLeadDeal(leadId);
      if (res.success && res.data) {
        setDeal(res.data);
      } else {
        setDeal(null);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeal();
  }, [leadId]);

  const handleSaveDeal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const quoted = formData.get("quotedAmount") ? Number(formData.get("quotedAmount")) : null;
    const finalAmount = Number(formData.get("finalAmount")) || 0;
    const currency = String(formData.get("currency") || "INR");
    const status = String(formData.get("status") || "NEGOTIATING") as DealStatus;
    const nextDueDate = formData.get("nextPaymentDueDate") ? String(formData.get("nextPaymentDueDate")) : null;
    const nextDueAmount = formData.get("nextPaymentDueAmount") ? Number(formData.get("nextPaymentDueAmount")) : null;

    const res = await upsertLeadDeal({
      leadId,
      quotedAmount: quoted,
      finalAmount,
      currency,
      status,
      nextPaymentDueDate: nextDueDate,
      nextPaymentDueAmount: nextDueAmount,
    });

    setSaving(false);
    if (res.success) {
      setDeal(res.data);
      setDealModalOpen(false);
      showToast("Deal details updated", "success");
    } else {
      showToast(res.error || "Failed to update deal", "error");
    }
  };

  const handleSavePayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!deal) return;
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get("amount"));
    const paymentDate = formData.get("paymentDate") ? String(formData.get("paymentDate")) : undefined;
    const type = String(formData.get("type") || "PARTIAL") as PaymentType;
    const customType = formData.get("customType") ? String(formData.get("customType")) : undefined;
    const method = String(formData.get("method") || "UPI") as PaymentMethod;
    const note = formData.get("note") ? String(formData.get("note")).trim() : undefined;
    const reference = formData.get("reference") ? String(formData.get("reference")).trim() : undefined;

    if (editingPayment) {
      const res = await updateDealPayment(editingPayment.id, {
        amount,
        paymentDate,
        type,
        customType,
        method,
        note,
        reference,
      });
      setSaving(false);
      if (res.success) {
        await loadDeal();
        setPaymentModalOpen(false);
        setEditingPayment(null);
        showToast("Payment updated", "success");
      } else {
        showToast(res.error || "Failed to update payment", "error");
      }
    } else {
      const res = await addDealPayment({
        dealId: deal.id,
        amount,
        paymentDate,
        type,
        customType,
        method,
        note,
        reference,
      });
      setSaving(false);
      if (res.success) {
        await loadDeal();
        setPaymentModalOpen(false);
        showToast("Payment recorded", "success");
      } else {
        showToast(res.error || "Failed to record payment", "error");
      }
    }
  };

  const handleDeletePayment = async () => {
    if (!deletingPayment) return;
    setSaving(true);
    const res = await deleteDealPayment(deletingPayment.id);
    setSaving(false);
    if (res.success) {
      await loadDeal();
      setDeletingPayment(null);
      showToast("Payment removed", "info");
    } else {
      showToast(res.error || "Failed to delete payment", "error");
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-xs text-slate-400">
        Loading deal information...
      </div>
    );
  }

  const finalAmount = deal ? deal.finalAmount : 0;
  const totalReceived = deal ? deal.totalReceived : 0;
  const remaining = deal ? deal.remainingBalance : 0;
  const paymentStatus = deal ? deal.paymentStatus : "Unpaid";
  const percentPaid = finalAmount > 0 ? Math.min(100, Math.round((totalReceived / finalAmount) * 100)) : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Paid":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Partially Paid":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Overdue":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50/70 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Receipt size={17} className="text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Deal &amp; Payments</h3>
          {deal && (
            <span className="text-[11px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
              {DEAL_STATUS_LABELS[deal.status]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDealModalOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <Edit2 size={12} /> {deal ? "Edit Deal" : "Create Deal"}
          </button>
          {deal && (
            <button
              type="button"
              onClick={() => {
                setEditingPayment(null);
                setPaymentModalOpen(true);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
            >
              <Plus size={13} /> Add Payment
            </button>
          )}
        </div>
      </div>

      {/* Main Metrics */}
      {!deal ? (
        <div className="p-6 text-center">
          <p className="text-xs text-slate-500">No deal configured for this lead yet.</p>
          <button
            type="button"
            onClick={() => setDealModalOpen(true)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <Plus size={14} /> Set Deal Value &amp; Track Payments
          </button>
        </div>
      ) : (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Numbers Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Deal Value</span>
              <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                {formatCurrency(finalAmount)}
              </span>
              {deal.quotedAmount && deal.quotedAmount !== finalAmount && (
                <span className="text-[10px] text-slate-400 line-through block mt-0.5">
                  Quoted: {formatCurrency(deal.quotedAmount)}
                </span>
              )}
            </div>

            <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/70">
              <span className="text-[10px] uppercase font-bold text-emerald-700/70 block">Received</span>
              <span className="text-sm font-bold text-emerald-700 mt-0.5 block">
                {formatCurrency(totalReceived)}
              </span>
              <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">
                {percentPaid}% of total
              </span>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Remaining</span>
              <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                {formatCurrency(remaining)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {remaining === 0 ? "Fully cleared" : "Outstanding"}
              </span>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
              <div className="mt-1">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${getStatusBadge(paymentStatus)}`}>
                  {paymentStatus === "Paid" && <CheckCircle2 size={12} />}
                  {paymentStatus === "Overdue" && <AlertCircle size={12} />}
                  {paymentStatus === "Partially Paid" && <Clock size={12} />}
                  {paymentStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-medium text-slate-500">
              <span>Payment Progress</span>
              <span>{percentPaid}% collected</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  percentPaid >= 100 ? "bg-emerald-500" : percentPaid > 0 ? "bg-blue-600" : "bg-transparent"
                }`}
                style={{ width: `${percentPaid}%` }}
              />
            </div>
          </div>

          {/* Next Due Date Banner if applicable */}
          {deal.nextPaymentDueDate && remaining > 0 && (
            <div className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
              deal.paymentStatus === "Overdue" 
                ? "bg-rose-50/70 border-rose-200 text-rose-800" 
                : "bg-blue-50/60 border-blue-100 text-blue-800"
            }`}>
              <div className="flex items-center gap-2">
                <Calendar size={15} />
                <span>
                  Next Due: <strong>{deal.nextPaymentDueDate}</strong>
                  {deal.nextPaymentDueAmount ? ` · ${formatCurrency(deal.nextPaymentDueAmount)}` : ""}
                </span>
              </div>
              {deal.paymentStatus === "Overdue" && (
                <span className="font-bold text-[10px] uppercase tracking-wider bg-rose-200/80 px-2 py-0.5 rounded text-rose-900">
                  Overdue
                </span>
              )}
            </div>
          )}

          {/* Payment History */}
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Payment History ({deal.payments.length})
              </h4>
              <button
                type="button"
                onClick={() => {
                  setEditingPayment(null);
                  setPaymentModalOpen(true);
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} /> Record
              </button>
            </div>

            {deal.payments.length === 0 ? (
              <p className="text-xs text-slate-400 py-2 italic text-center">No payment entries yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {deal.payments.map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {formatCurrency(p.amount)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {p.type === "CUSTOM" && p.customType ? p.customType : PAYMENT_TYPE_LABELS[p.type]}
                        </span>
                        <span className="text-slate-400 text-[11px] font-medium">
                          {PAYMENT_METHOD_LABELS[p.method]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-slate-500 text-[11px] flex-wrap">
                        <span>{p.paymentDate}</span>
                        {p.reference && (
                          <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200">
                            Ref: {p.reference}
                          </span>
                        )}
                        {p.note && <span className="italic text-slate-600 font-medium">“{p.note}”</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPayment(p);
                          setPaymentModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        aria-label="Edit payment"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingPayment(p)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        aria-label="Delete payment"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Deal Settings */}
      {dealModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {deal ? "Edit Deal Details" : "Create Deal for Client"}
              </h3>
              <button
                type="button"
                onClick={() => setDealModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDeal} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Final Deal Value (₹) *</label>
                <input
                  type="number"
                  name="finalAmount"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={deal?.finalAmount ?? leadQuotedAmount ?? ""}
                  placeholder="30000"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quoted Amount (₹)</label>
                  <input
                    type="number"
                    name="quotedAmount"
                    step="0.01"
                    min="0"
                    defaultValue={deal?.quotedAmount ?? leadQuotedAmount ?? ""}
                    placeholder="35000"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Currency</label>
                  <input
                    type="text"
                    name="currency"
                    defaultValue={deal?.currency ?? "INR"}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deal Status</label>
                <select
                  name="status"
                  defaultValue={deal?.status ?? "NEGOTIATING"}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="NO_DEAL">No Deal</option>
                  <option value="NEGOTIATING">Negotiating</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Next Payment Due Date</label>
                  <input
                    type="date"
                    name="nextPaymentDueDate"
                    defaultValue={deal?.nextPaymentDueDate ?? ""}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Due Amount (₹)</label>
                  <input
                    type="number"
                    name="nextPaymentDueAmount"
                    step="0.01"
                    min="0"
                    defaultValue={deal?.nextPaymentDueAmount ?? ""}
                    placeholder="12000"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDealModalOpen(false)}
                  className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Saving..." : "Save Deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Record / Edit Payment */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard size={18} className="text-blue-600" />
                {editingPayment ? "Edit Payment Entry" : "Record Client Payment"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setPaymentModalOpen(false);
                  setEditingPayment(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  min="0.01"
                  required
                  defaultValue={editingPayment?.amount ?? (remaining > 0 ? remaining : "")}
                  placeholder="10000"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Date *</label>
                  <input
                    type="date"
                    name="paymentDate"
                    required
                    defaultValue={editingPayment?.paymentDate ?? new Date().toISOString().slice(0, 10)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method *</label>
                  <select
                    name="method"
                    defaultValue={editingPayment?.method ?? "UPI"}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="PAYPAL">PayPal</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Type</label>
                  <select
                    name="type"
                    defaultValue={editingPayment?.type ?? (totalReceived === 0 ? "ADVANCE" : remaining <= 0 ? "FINAL" : "PARTIAL")}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="ADVANCE">Advance</option>
                    <option value="PARTIAL">Partial Payment</option>
                    <option value="FINAL">Final Payment</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Custom Label (if Custom)</label>
                  <input
                    type="text"
                    name="customType"
                    defaultValue={editingPayment?.customType ?? ""}
                    placeholder="Milestone 2"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reference / Transaction ID</label>
                <input
                  type="text"
                  name="reference"
                  defaultValue={editingPayment?.reference ?? ""}
                  placeholder="Txn #987654 or UPI reference"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Note</label>
                <textarea
                  name="note"
                  rows={2}
                  defaultValue={editingPayment?.note ?? ""}
                  placeholder="e.g. Advance received for homepage and admin panel"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentModalOpen(false);
                    setEditingPayment(null);
                  }}
                  className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Saving..." : editingPayment ? "Update Payment" : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Safe Deletion Confirmation */}
      {deletingPayment && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95">
            <h4 className="text-base font-bold text-slate-900">Delete Payment Entry?</h4>
            <p className="mt-2 text-xs text-slate-500">
              Are you sure you want to delete this payment of{" "}
              <strong className="text-slate-900">{formatCurrency(deletingPayment.amount)}</strong> recorded on{" "}
              {deletingPayment.paymentDate}?
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Deal totals, received amounts, and remaining balance will be recalculated automatically.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                disabled={saving}
                onClick={() => setDeletingPayment(null)}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleDeletePayment}
                className="flex-1 rounded-lg bg-rose-600 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
              >
                {saving ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
