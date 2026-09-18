"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { 
  SerializedDeal, 
  DealSummaryMetrics, 
  DealStatus, 
  PaymentType, 
  PaymentMethod 
} from "../types";
import { 
  DEAL_STATUS_LABELS, 
  PAYMENT_TYPE_LABELS 
} from "../types";
import { formatCurrency } from "../calculations";
import { 
  addDealPayment, 
  upsertLeadDeal 
} from "@/app/actions/deals";
import { useLeadNavigation } from "@/features/leads/lead-navigation-provider";
import { useToast } from "@/components/toast-provider";
import { 
  Receipt, 
  Plus, 
  Search, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Edit2, 
  ExternalLink, 
  X,
  CreditCard,
  ArrowUpDown,
  Filter
} from "lucide-react";

interface DealsWorkspaceProps {
  initialDeals: SerializedDeal[];
  initialMetrics: DealSummaryMetrics;
}

export function DealsWorkspace({ initialDeals, initialMetrics }: DealsWorkspaceProps) {
  const router = useRouter();
  const leadNavigation = useLeadNavigation();
  const { showToast } = useToast();

  const [deals, setDeals] = useState<SerializedDeal[]>(initialDeals);
  const [filter, setFilter] = useState<"all" | "unpaid" | "partially_paid" | "paid" | "overdue">("all");
  const [sortBy, setSortBy] = useState<"highest_outstanding" | "nearest_due_date" | "latest_deal">("highest_outstanding");
  const [searchQuery, setSearchQuery] = useState("");

  // Payment Recording Modal State
  const [activeDealForPayment, setActiveDealForPayment] = useState<SerializedDeal | null>(null);
  const [activeDealForEdit, setActiveDealForEdit] = useState<SerializedDeal | null>(null);
  const [saving, setSaving] = useState(false);

  // Dynamic filter and sort
  const filteredAndSortedDeals = useMemo(() => {
    let result = [...deals];

    // Filter
    if (filter === "unpaid") {
      result = result.filter((d) => d.paymentStatus === "Unpaid");
    } else if (filter === "partially_paid") {
      result = result.filter((d) => d.paymentStatus === "Partially Paid");
    } else if (filter === "paid") {
      result = result.filter((d) => d.paymentStatus === "Paid");
    } else if (filter === "overdue") {
      result = result.filter((d) => d.paymentStatus === "Overdue");
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (d) =>
          (d.lead?.name || d.clientNameSnapshot || "").toLowerCase().includes(q) ||
          (d.lead?.business || d.companyNameSnapshot || "").toLowerCase().includes(q) ||
          (d.lead?.phone || "").includes(q)
      );
    }

    // Sort
    if (sortBy === "highest_outstanding") {
      result.sort((a, b) => b.remainingBalance - a.remainingBalance);
    } else if (sortBy === "nearest_due_date") {
      result.sort((a, b) => {
        if (!a.nextPaymentDueDate && !b.nextPaymentDueDate) return 0;
        if (!a.nextPaymentDueDate) return 1;
        if (!b.nextPaymentDueDate) return -1;
        return a.nextPaymentDueDate.localeCompare(b.nextPaymentDueDate);
      });
    } else {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [deals, filter, sortBy, searchQuery]);

  const handleRecordPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeDealForPayment) return;
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get("amount"));
    const paymentDate = formData.get("paymentDate") ? String(formData.get("paymentDate")) : undefined;
    const type = String(formData.get("type") || "PARTIAL") as PaymentType;
    const customType = formData.get("customType") ? String(formData.get("customType")) : undefined;
    const method = String(formData.get("method") || "UPI") as PaymentMethod;
    const note = formData.get("note") ? String(formData.get("note")) : undefined;

    const res = await addDealPayment({
      dealId: activeDealForPayment.id,
      amount,
      paymentDate,
      type,
      customType,
      method,
      note,
    });

    setSaving(false);
    if (res.success) {
      showToast("Payment recorded successfully", "success");
      setActiveDealForPayment(null);
      router.refresh();
    } else {
      showToast(res.error || "Failed to record payment", "error");
    }
  };

  const handleEditDeal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeDealForEdit) return;
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const quoted = formData.get("quotedAmount") ? Number(formData.get("quotedAmount")) : null;
    const finalAmount = Number(formData.get("finalAmount")) || 0;
    const currency = String(formData.get("currency") || "INR");
    const status = String(formData.get("status") || "NEGOTIATING") as DealStatus;
    const nextDueDate = formData.get("nextPaymentDueDate") ? String(formData.get("nextPaymentDueDate")) : null;
    const nextDueAmount = formData.get("nextPaymentDueAmount") ? Number(formData.get("nextPaymentDueAmount")) : null;

    const res = await upsertLeadDeal({
      dealId: activeDealForEdit.id,
      leadId: activeDealForEdit.leadId,
      quotedAmount: quoted,
      finalAmount,
      currency,
      status,
      nextPaymentDueDate: nextDueDate,
      nextPaymentDueAmount: nextDueAmount,
    });

    setSaving(false);
    if (res.success) {
      showToast("Deal updated", "success");
      setActiveDealForEdit(null);
      router.refresh();
    } else {
      showToast(res.error || "Failed to update deal", "error");
    }
  };

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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Receipt className="text-blue-600" size={26} />
            Deals &amp; Payment Tracker
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Track client deal values, payment milestones, collected amounts, and upcoming balances.
          </p>
        </div>
      </div>

      {/* G. SUMMARY METRICS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total Deal Value
          </span>
          <span className="mt-1 text-lg sm:text-2xl font-bold text-slate-900 block">
            {formatCurrency(initialMetrics.totalDealValue)}
          </span>
          <span className="mt-1 text-xs text-slate-400 block font-medium">
            Across {initialMetrics.totalDealsCount} active deals
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block">
            Total Received
          </span>
          <span className="mt-1 text-lg sm:text-2xl font-bold text-emerald-700 block">
            {formatCurrency(initialMetrics.totalReceived)}
          </span>
          <span className="mt-1 text-xs text-emerald-600/80 block font-medium">
            {initialMetrics.totalDealValue > 0 
              ? `${Math.round((initialMetrics.totalReceived / initialMetrics.totalDealValue) * 100)}% collected` 
              : "0%"}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total Outstanding
          </span>
          <span className="mt-1 text-lg sm:text-2xl font-bold text-slate-900 block">
            {formatCurrency(initialMetrics.totalOutstanding)}
          </span>
          <span className="mt-1 text-xs text-slate-400 block font-medium">
            Remaining client balances
          </span>
        </div>

        <div className={`rounded-xl border p-4 shadow-sm ${
          initialMetrics.overdueAmount > 0 
            ? "border-rose-200 bg-rose-50/50" 
            : "border-slate-200 bg-white"
        }`}>
          <span className={`text-xs font-semibold uppercase tracking-wider block ${
            initialMetrics.overdueAmount > 0 ? "text-rose-600" : "text-slate-500"
          }`}>
            Overdue Amount
          </span>
          <span className={`mt-1 text-lg sm:text-2xl font-bold block ${
            initialMetrics.overdueAmount > 0 ? "text-rose-700" : "text-slate-900"
          }`}>
            {formatCurrency(initialMetrics.overdueAmount)}
          </span>
          <span className={`mt-1 text-xs block font-medium ${
            initialMetrics.overdueAmount > 0 ? "text-rose-600 font-semibold" : "text-slate-400"
          }`}>
            {initialMetrics.overdueAmount > 0 ? "Pending overdue collections" : "Zero overdue payments"}
          </span>
        </div>
      </div>

      {/* CONTROLS: Filter Pills, Search, Sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {(
            [
              { id: "all", label: "All Deals" },
              { id: "unpaid", label: "Unpaid" },
              { id: "partially_paid", label: "Partially Paid" },
              { id: "paid", label: "Paid" },
              { id: "overdue", label: "Overdue" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                filter === item.id
                  ? item.id === "overdue"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Search & Sort */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search client, business..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <ArrowUpDown size={14} className="text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="py-1.5 px-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:border-blue-500 focus:outline-none"
            >
              <option value="highest_outstanding">Highest Outstanding</option>
              <option value="nearest_due_date">Nearest Due Date</option>
              <option value="latest_deal">Latest Deal</option>
            </select>
          </div>
        </div>
      </div>

      {/* DEALS LIST / TABLE */}
      {filteredAndSortedDeals.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <Receipt size={32} className="mx-auto text-slate-300" />
          <h3 className="mt-2 text-sm font-bold text-slate-800">No deals found</h3>
          <p className="mt-1 text-xs text-slate-500">
            {deals.length === 0
              ? "No deals created yet. Open any lead detail to set up its deal value and start tracking payments."
              : "No deals matching the selected filter or search query."}
          </p>
        </div>
      ) : (
        <>
          {/* DESKTOP VIEW: Clean Table */}
          <div className="hidden md:block rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="px-5 py-3.5">Client</th>
                  <th className="px-4 py-3.5">Deal Value</th>
                  <th className="px-4 py-3.5">Received</th>
                  <th className="px-4 py-3.5">Remaining</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Next Due Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedDeals.map((deal) => {
                  const percent = deal.finalAmount > 0 
                    ? Math.min(100, Math.round((deal.totalReceived / deal.finalAmount) * 100)) 
                    : 0;
                  return (
                    <tr key={deal.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Client */}
                      <td className="px-5 py-3.5">
                        {deal.lead ? (
                          <button
                            type="button"
                            onClick={() => deal.lead && leadNavigation?.openLead(deal.lead.id)}
                            className="text-left font-bold text-slate-900 hover:text-blue-600 transition-colors flex items-center gap-1.5 group cursor-pointer"
                          >
                            <span>{deal.lead.name}</span>
                            <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 text-blue-600 transition-opacity" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{deal.clientNameSnapshot || "Client"}</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              Lead deleted
                            </span>
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {deal.lead ? (deal.lead.business || deal.lead.phone) : (deal.companyNameSnapshot || null)}
                        </div>
                      </td>

                      {/* Deal Value */}
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        {formatCurrency(deal.finalAmount)}
                      </td>

                      {/* Received */}
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-emerald-700">
                          {formatCurrency(deal.totalReceived)}
                        </span>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${percent >= 100 ? "bg-emerald-500" : "bg-blue-600"}`} 
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold">{percent}%</span>
                        </div>
                      </td>

                      {/* Remaining */}
                      <td className="px-4 py-3.5">
                        <span className={`font-bold ${deal.remainingBalance > 0 ? "text-slate-900" : "text-slate-400"}`}>
                          {formatCurrency(deal.remainingBalance)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${getStatusBadgeClass(deal.paymentStatus)}`}>
                          {deal.paymentStatus === "Paid" && <CheckCircle2 size={12} />}
                          {deal.paymentStatus === "Overdue" && <AlertCircle size={12} />}
                          {deal.paymentStatus === "Partially Paid" && <Clock size={12} />}
                          {deal.paymentStatus}
                        </span>
                      </td>

                      {/* Next Due Date */}
                      <td className="px-4 py-3.5 text-slate-600">
                        {deal.nextPaymentDueDate ? (
                          <div>
                            <span className={`font-medium ${deal.paymentStatus === "Overdue" ? "text-rose-600 font-bold" : ""}`}>
                              {deal.nextPaymentDueDate}
                            </span>
                            {deal.nextPaymentDueAmount ? (
                              <div className="text-[11px] text-slate-400">
                                {formatCurrency(deal.nextPaymentDueAmount)}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setActiveDealForPayment(deal)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold transition-colors cursor-pointer"
                          >
                            <Plus size={12} /> Add Payment
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveDealForEdit(deal)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            aria-label="Edit deal"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE VIEW: Easy-to-Scan Cards */}
          <div className="md:hidden space-y-3">
            {filteredAndSortedDeals.map((deal) => {
              const percent = deal.finalAmount > 0 
                ? Math.min(100, Math.round((deal.totalReceived / deal.finalAmount) * 100)) 
                : 0;
              return (
                <div key={deal.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {deal.lead ? (
                        <button
                          type="button"
                          onClick={() => deal.lead && leadNavigation?.openLead(deal.lead.id)}
                          className="text-left font-bold text-slate-900 text-sm hover:text-blue-600 transition-colors"
                        >
                          {deal.lead.name}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{deal.clientNameSnapshot || "Client"}</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                            Lead deleted
                          </span>
                        </div>
                      )}
                      <p className="text-xs text-slate-500 mt-0.5">
                        {deal.lead ? (deal.lead.business || deal.lead.phone) : (deal.companyNameSnapshot || null)}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadgeClass(deal.paymentStatus)}`}>
                      {deal.paymentStatus === "Paid" && <CheckCircle2 size={12} />}
                      {deal.paymentStatus === "Overdue" && <AlertCircle size={12} />}
                      {deal.paymentStatus === "Partially Paid" && <Clock size={12} />}
                      {deal.paymentStatus}
                    </span>
                  </div>

                  {/* Numbers Grid */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Deal</span>
                      <span className="font-bold text-slate-900 block mt-0.5">{formatCurrency(deal.finalAmount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-700/70 block">Received</span>
                      <span className="font-bold text-emerald-700 block mt-0.5">{formatCurrency(deal.totalReceived)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Remaining</span>
                      <span className="font-bold text-slate-900 block mt-0.5">{formatCurrency(deal.remainingBalance)}</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                      <span>Progress</span>
                      <span>{percent}% collected</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${percent >= 100 ? "bg-emerald-500" : "bg-blue-600"}`} 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Due Date Info */}
                  {deal.nextPaymentDueDate && deal.remainingBalance > 0 && (
                    <div className={`p-2 rounded-lg text-xs flex items-center justify-between border ${
                      deal.paymentStatus === "Overdue" 
                        ? "bg-rose-50 text-rose-800 border-rose-200" 
                        : "bg-blue-50 text-blue-800 border-blue-100"
                    }`}>
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} />
                        Next Due: <strong>{deal.nextPaymentDueDate}</strong>
                      </span>
                      {deal.nextPaymentDueAmount && (
                        <span className="font-bold">{formatCurrency(deal.nextPaymentDueAmount)}</span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setActiveDealForPayment(deal)}
                      className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors text-center cursor-pointer"
                    >
                      + Add Payment
                    </button>
                    {deal.lead && (
                      <button
                        type="button"
                        onClick={() => leadNavigation?.openLead(deal.lead!.id)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Details
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* MODAL: Record Payment */}
      {activeDealForPayment && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard size={18} className="text-blue-600" />
                  Record Payment
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Client: <strong>{activeDealForPayment.lead?.name || activeDealForPayment.clientNameSnapshot || "Client"}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveDealForPayment(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  min="0.01"
                  required
                  defaultValue={activeDealForPayment.remainingBalance > 0 ? activeDealForPayment.remainingBalance : ""}
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
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method *</label>
                  <select
                    name="method"
                    defaultValue="UPI"
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
                    defaultValue={activeDealForPayment.totalReceived === 0 ? "ADVANCE" : "PARTIAL"}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="ADVANCE">Advance</option>
                    <option value="PARTIAL">Partial Payment</option>
                    <option value="FINAL">Final Payment</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Custom Label</label>
                  <input
                    type="text"
                    name="customType"
                    placeholder="Milestone 2"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Optional Note / Ref ID</label>
                <input
                  type="text"
                  name="note"
                  placeholder="Txn #12345 or UPI reference"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveDealForPayment(null)}
                  className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Deal */}
      {activeDealForEdit && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Edit Deal for {activeDealForEdit.lead?.name || activeDealForEdit.clientNameSnapshot || "Client"}
              </h3>
              <button
                type="button"
                onClick={() => setActiveDealForEdit(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditDeal} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Final Deal Value (₹) *</label>
                <input
                  type="number"
                  name="finalAmount"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={activeDealForEdit.finalAmount}
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
                    defaultValue={activeDealForEdit.quotedAmount ?? ""}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Currency</label>
                  <input
                    type="text"
                    name="currency"
                    defaultValue={activeDealForEdit.currency}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deal Status</label>
                <select
                  name="status"
                  defaultValue={activeDealForEdit.status}
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
                    defaultValue={activeDealForEdit.nextPaymentDueDate ?? ""}
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
                    defaultValue={activeDealForEdit.nextPaymentDueAmount ?? ""}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveDealForEdit(null)}
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
    </div>
  );
}
