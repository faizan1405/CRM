"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { 
  SerializedDeal, 
  SerializedPayment,
  DealSummaryMetrics, 
  DealStatus, 
  PaymentType, 
  PaymentMethod 
} from "../types";
import { 
  DEAL_STATUS_LABELS, 
  PAYMENT_TYPE_LABELS,
  PAYMENT_METHOD_LABELS 
} from "../types";
import { formatCurrency, calculateDealMetrics } from "../calculations";
import { 
  addDealPayment, 
  updateDealPayment,
  deleteDealPayment,
  upsertLeadDeal,
  createOtherClientDeal,
  deleteDeal
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
  Trash2,
  ExternalLink, 
  X,
  CreditCard,
  ArrowUpDown,
  History,
  ChevronDown,
  ChevronUp,
  Building2,
  Phone,
  Mail,
  FolderKanban,
  FileText
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
  const [activeTab, setActiveTab] = useState<"all" | "crm" | "other">("all");
  const [filter, setFilter] = useState<"all" | "unpaid" | "partially_paid" | "paid" | "overdue">("all");
  const [sortBy, setSortBy] = useState<"highest_outstanding" | "nearest_due_date" | "latest_deal">("highest_outstanding");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal States
  const [isCreateOtherModalOpen, setIsCreateOtherModalOpen] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [activeDealForPayment, setActiveDealForPayment] = useState<SerializedDeal | null>(null);
  const [activeDealForHistory, setActiveDealForHistory] = useState<SerializedDeal | null>(null);
  const [activeDealForEdit, setActiveDealForEdit] = useState<SerializedDeal | null>(null);
  const [activeDealForDelete, setActiveDealForDelete] = useState<SerializedDeal | null>(null);
  const [activePaymentForEdit, setActivePaymentForEdit] = useState<{ deal: SerializedDeal; payment: SerializedPayment } | null>(null);
  const [activePaymentForDelete, setActivePaymentForDelete] = useState<{ deal: SerializedDeal; payment: SerializedPayment } | null>(null);
  const [saving, setSaving] = useState(false);

  // Filter deals based on active tab
  const tabScopedDeals = useMemo(() => {
    if (activeTab === "crm") {
      return deals.filter((d) => d.source === "CRM_LEAD");
    }
    if (activeTab === "other") {
      return deals.filter((d) => d.source === "OTHER_CLIENT");
    }
    return deals;
  }, [deals, activeTab]);

  // Tab-scoped summary metrics (recalculate whenever activeTab changes)
  const metrics = useMemo(() => {
    return calculateDealMetrics(tabScopedDeals);
  }, [tabScopedDeals]);

  // Counts for tabs
  const allCount = deals.length;
  const crmCount = deals.filter((d) => d.source === "CRM_LEAD").length;
  const otherCount = deals.filter((d) => d.source === "OTHER_CLIENT").length;

  // Dynamic filter, search, and sort within active tab
  const filteredAndSortedDeals = useMemo(() => {
    let result = [...tabScopedDeals];

    // Filter by payment status
    if (filter === "unpaid") {
      result = result.filter((d) => d.paymentStatus === "Unpaid");
    } else if (filter === "partially_paid") {
      result = result.filter((d) => d.paymentStatus === "Partially Paid");
    } else if (filter === "paid") {
      result = result.filter((d) => d.paymentStatus === "Paid");
    } else if (filter === "overdue") {
      result = result.filter((d) => d.paymentStatus === "Overdue");
    }

    // Search query matching
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((d) => {
        const name = (d.lead?.name || d.clientNameSnapshot || "").toLowerCase();
        const business = (d.lead?.business || d.companyNameSnapshot || "").toLowerCase();
        const project = (d.projectName || "").toLowerCase();
        const phone = (d.lead?.phone || d.clientPhone || "").toLowerCase();
        const email = (d.clientEmail || "").toLowerCase();
        const notes = (d.notes || "").toLowerCase();
        return (
          name.includes(q) ||
          business.includes(q) ||
          project.includes(q) ||
          phone.includes(q) ||
          email.includes(q) ||
          notes.includes(q)
        );
      });
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
      // latest_deal
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [tabScopedDeals, filter, sortBy, searchQuery]);

  // Handler: Create Other Client Deal
  const handleCreateOtherClientDeal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const clientName = String(formData.get("clientName") || "").trim();
    const finalAmount = Number(formData.get("finalAmount"));
    const companyName = formData.get("companyName") ? String(formData.get("companyName")).trim() : undefined;
    const clientPhone = formData.get("clientPhone") ? String(formData.get("clientPhone")).trim() : undefined;
    const clientEmail = formData.get("clientEmail") ? String(formData.get("clientEmail")).trim() : undefined;
    const projectName = formData.get("projectName") ? String(formData.get("projectName")).trim() : undefined;
    const currency = String(formData.get("currency") || "INR").trim();
    const status = (String(formData.get("status") || "CONFIRMED") as DealStatus);
    const nextPaymentDueDate = formData.get("nextPaymentDueDate") ? String(formData.get("nextPaymentDueDate")) : undefined;
    const nextPaymentDueAmount = formData.get("nextPaymentDueAmount") ? Number(formData.get("nextPaymentDueAmount")) : undefined;
    const notes = formData.get("notes") ? String(formData.get("notes")).trim() : undefined;

    const res = await createOtherClientDeal({
      clientName,
      finalAmount,
      companyName,
      clientPhone,
      clientEmail,
      projectName,
      currency,
      status,
      nextPaymentDueDate,
      nextPaymentDueAmount,
      notes,
    });

    setSaving(false);
    if (res.success) {
      showToast("Other Client deal created successfully", "success");
      setDeals((prev) => [res.data, ...prev]);
      setIsCreateOtherModalOpen(false);
      setShowMoreOptions(false);
      router.refresh();
    } else {
      showToast(res.error || "Failed to create deal", "error");
    }
  };

  // Handler: Record Payment
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

    const targetDealId = activeDealForPayment.id;
    const res = await addDealPayment({
      dealId: targetDealId,
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
      const newPayment = res.data;
      setDeals((prev) =>
        prev.map((d) => {
          if (d.id !== targetDealId) return d;
          const updatedPayments = [newPayment, ...d.payments];
          const newReceived = updatedPayments.reduce((s, p) => s + p.amount, 0);
          const newRemaining = Math.max(0, d.finalAmount - newReceived);
          let newStatus = d.paymentStatus;
          if (d.finalAmount > 0 && newReceived >= d.finalAmount) newStatus = "Paid";
          else if (newReceived > 0) newStatus = "Partially Paid";
          else newStatus = "Unpaid";

          const updatedDeal = {
            ...d,
            payments: updatedPayments,
            totalReceived: newReceived,
            remainingBalance: newRemaining,
            paymentStatus: newStatus,
          };
          if (activeDealForHistory && activeDealForHistory.id === targetDealId) {
            setActiveDealForHistory(updatedDeal);
          }
          return updatedDeal;
        })
      );
      setActiveDealForPayment(null);
      router.refresh();
    } else {
      showToast(res.error || "Failed to record payment", "error");
    }
  };

  // Handler: Edit Payment
  const handleEditPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activePaymentForEdit) return;
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get("amount"));
    const paymentDate = formData.get("paymentDate") ? String(formData.get("paymentDate")) : undefined;
    const type = String(formData.get("type") || "PARTIAL") as PaymentType;
    const customType = formData.get("customType") ? String(formData.get("customType")) : undefined;
    const method = String(formData.get("method") || "UPI") as PaymentMethod;
    const note = formData.get("note") ? String(formData.get("note")) : undefined;

    const { deal, payment } = activePaymentForEdit;
    const res = await updateDealPayment(payment.id, {
      amount,
      paymentDate,
      type,
      customType,
      method,
      note,
    });

    setSaving(false);
    if (res.success) {
      showToast("Payment updated successfully", "success");
      const updatedPayment = res.data;
      setDeals((prev) =>
        prev.map((d) => {
          if (d.id !== deal.id) return d;
          const updatedPayments = d.payments.map((p) => (p.id === payment.id ? updatedPayment : p));
          const newReceived = updatedPayments.reduce((s, p) => s + p.amount, 0);
          const newRemaining = Math.max(0, d.finalAmount - newReceived);
          let newStatus = d.paymentStatus;
          if (d.finalAmount > 0 && newReceived >= d.finalAmount) newStatus = "Paid";
          else if (newReceived > 0) newStatus = "Partially Paid";
          else newStatus = "Unpaid";

          const updatedDeal = {
            ...d,
            payments: updatedPayments,
            totalReceived: newReceived,
            remainingBalance: newRemaining,
            paymentStatus: newStatus,
          };
          if (activeDealForHistory && activeDealForHistory.id === deal.id) {
            setActiveDealForHistory(updatedDeal);
          }
          return updatedDeal;
        })
      );
      setActivePaymentForEdit(null);
      router.refresh();
    } else {
      showToast(res.error || "Failed to update payment", "error");
    }
  };

  // Handler: Delete Payment
  const handleDeletePayment = async () => {
    if (!activePaymentForDelete) return;
    setSaving(true);
    const { deal, payment } = activePaymentForDelete;
    const res = await deleteDealPayment(payment.id);
    setSaving(false);
    if (res.success) {
      showToast("Payment removed", "info");
      setDeals((prev) =>
        prev.map((d) => {
          if (d.id !== deal.id) return d;
          const updatedPayments = d.payments.filter((p) => p.id !== payment.id);
          const newReceived = updatedPayments.reduce((s, p) => s + p.amount, 0);
          const newRemaining = Math.max(0, d.finalAmount - newReceived);
          let newStatus = d.paymentStatus;
          if (d.finalAmount > 0 && newReceived >= d.finalAmount) newStatus = "Paid";
          else if (newReceived > 0) newStatus = "Partially Paid";
          else newStatus = "Unpaid";

          const updatedDeal = {
            ...d,
            payments: updatedPayments,
            totalReceived: newReceived,
            remainingBalance: newRemaining,
            paymentStatus: newStatus,
          };
          if (activeDealForHistory && activeDealForHistory.id === deal.id) {
            setActiveDealForHistory(updatedDeal);
          }
          return updatedDeal;
        })
      );
      setActivePaymentForDelete(null);
      router.refresh();
    } else {
      showToast(res.error || "Failed to delete payment", "error");
    }
  };

  // Handler: Edit Deal
  const handleEditDeal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeDealForEdit) return;
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const finalAmount = Number(formData.get("finalAmount")) || 0;
    const quoted = formData.get("quotedAmount") ? Number(formData.get("quotedAmount")) : null;
    const currency = String(formData.get("currency") || "INR");
    const status = String(formData.get("status") || "NEGOTIATING") as DealStatus;
    const nextDueDate = formData.get("nextPaymentDueDate") ? String(formData.get("nextPaymentDueDate")) : null;
    const nextDueAmount = formData.get("nextPaymentDueAmount") ? Number(formData.get("nextPaymentDueAmount")) : null;

    const isOtherClient = activeDealForEdit.source === "OTHER_CLIENT";
    const clientName = isOtherClient && formData.get("clientName") ? String(formData.get("clientName")).trim() : undefined;
    const companyName = isOtherClient && formData.get("companyName") ? String(formData.get("companyName")).trim() : undefined;
    const clientPhone = isOtherClient && formData.get("clientPhone") ? String(formData.get("clientPhone")).trim() : undefined;
    const clientEmail = isOtherClient && formData.get("clientEmail") ? String(formData.get("clientEmail")).trim() : undefined;
    const projectName = isOtherClient && formData.get("projectName") ? String(formData.get("projectName")).trim() : undefined;
    const notes = isOtherClient && formData.get("notes") ? String(formData.get("notes")).trim() : undefined;

    const res = await upsertLeadDeal({
      dealId: activeDealForEdit.id,
      leadId: activeDealForEdit.leadId,
      clientName,
      companyName,
      clientPhone,
      clientEmail,
      projectName,
      notes,
      quotedAmount: quoted,
      finalAmount,
      currency,
      status,
      nextPaymentDueDate: nextDueDate,
      nextPaymentDueAmount: nextDueAmount,
    });

    setSaving(false);
    if (res.success) {
      showToast("Deal updated successfully", "success");
      setDeals((prev) => prev.map((d) => (d.id === activeDealForEdit.id ? res.data : d)));
      setActiveDealForEdit(null);
      router.refresh();
    } else {
      showToast(res.error || "Failed to update deal", "error");
    }
  };

  // Handler: Delete Deal (Deliberate confirmation)
  const handleDeleteDeal = async () => {
    if (!activeDealForDelete) return;
    setSaving(true);
    const dealId = activeDealForDelete.id;
    const res = await deleteDeal(dealId);
    setSaving(false);
    if (res.success) {
      showToast("Financial record deleted successfully", "info");
      setDeals((prev) => prev.filter((d) => d.id !== dealId));
      setActiveDealForDelete(null);
      if (activeDealForHistory && activeDealForHistory.id === dealId) {
        setActiveDealForHistory(null);
      }
      router.refresh();
    } else {
      showToast(res.error || "Failed to delete financial record", "error");
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

  const renderSourceBadge = (deal: SerializedDeal) => {
    if (deal.source === "OTHER_CLIENT") {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
          Other Client
        </span>
      );
    }
    if (deal.source === "CRM_LEAD") {
      if (!deal.lead) {
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
            Lead deleted
          </span>
        );
      }
      if (activeTab === "all") {
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
            CRM Client
          </span>
        );
      }
    }
    return null;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header with Title and Add Other Client Deal Button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Receipt className="text-blue-600" size={26} />
            Deals &amp; Payment Tracker
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Track client deals, milestone payments, collections, and outstanding balances across CRM and standalone clients.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setShowMoreOptions(false);
              setIsCreateOtherModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs sm:text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Other Client Deal</span>
          </button>
        </div>
      </div>

      {/* TOP-LEVEL TABS */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 border ${
            activeTab === "all"
              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <span>All Deals</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
            activeTab === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
          }`}>
            {allCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("crm")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 border ${
            activeTab === "crm"
              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <span>CRM Clients</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
            activeTab === "crm" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
          }`}>
            {crmCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("other")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 border ${
            activeTab === "other"
              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <span>Other Clients</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
            activeTab === "other" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
          }`}>
            {otherCount}
          </span>
        </button>
      </div>

      {/* TAB-SCOPED SUMMARY METRICS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total Deal Value
          </span>
          <span className="mt-1 text-lg sm:text-2xl font-bold text-slate-900 block">
            {formatCurrency(metrics.totalDealValue)}
          </span>
          <span className="mt-1 text-xs text-slate-400 block font-medium">
            Across {metrics.totalDealsCount} {activeTab === "crm" ? "CRM" : activeTab === "other" ? "Other Client" : "active"} {metrics.totalDealsCount === 1 ? "deal" : "deals"}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block">
            Total Received
          </span>
          <span className="mt-1 text-lg sm:text-2xl font-bold text-emerald-700 block">
            {formatCurrency(metrics.totalReceived)}
          </span>
          <span className="mt-1 text-xs text-emerald-600/80 block font-medium">
            {metrics.totalDealValue > 0 
              ? `${Math.round((metrics.totalReceived / metrics.totalDealValue) * 100)}% collected` 
              : "0%"}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total Outstanding
          </span>
          <span className="mt-1 text-lg sm:text-2xl font-bold text-slate-900 block">
            {formatCurrency(metrics.totalOutstanding)}
          </span>
          <span className="mt-1 text-xs text-slate-400 block font-medium">
            Remaining client balances
          </span>
        </div>

        <div className={`rounded-xl border p-4 shadow-sm ${
          metrics.overdueAmount > 0 
            ? "border-rose-200 bg-rose-50/50" 
            : "border-slate-200 bg-white"
        }`}>
          <span className={`text-xs font-semibold uppercase tracking-wider block ${
            metrics.overdueAmount > 0 ? "text-rose-600" : "text-slate-500"
          }`}>
            Overdue Amount
          </span>
          <span className={`mt-1 text-lg sm:text-2xl font-bold block ${
            metrics.overdueAmount > 0 ? "text-rose-700" : "text-slate-900"
          }`}>
            {formatCurrency(metrics.overdueAmount)}
          </span>
          <span className={`mt-1 text-xs block font-medium ${
            metrics.overdueAmount > 0 ? "text-rose-600 font-semibold" : "text-slate-400"
          }`}>
            {metrics.overdueAmount > 0 ? "Pending overdue collections" : "Zero overdue payments"}
          </span>
        </div>
      </div>

      {/* CONTROLS: Filter Pills, Search, Sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {(
            [
              { id: "all", label: "All" },
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
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search client, business, project..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <ArrowUpDown size={14} className="text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="py-1.5 px-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:border-blue-500 focus:outline-none cursor-pointer"
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
          <Receipt size={36} className="mx-auto text-slate-300" />
          <h3 className="mt-2.5 text-sm font-bold text-slate-800">No deals found</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            {activeTab === "other"
              ? "No Other Client deals recorded yet. Click 'Add Other Client Deal' to record money from non-CRM clients."
              : activeTab === "crm"
              ? "No CRM Client deals found matching the current criteria."
              : "No deals matching the selected tab, filter, or search query."}
          </p>
          {activeTab === "other" && (
            <button
              type="button"
              onClick={() => {
                setShowMoreOptions(false);
                setIsCreateOtherModalOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus size={14} /> Add Other Client Deal
            </button>
          )}
        </div>
      ) : (
        <>
          {/* DESKTOP VIEW: Clean Table */}
          <div className="hidden md:block rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="px-5 py-3.5">Client</th>
                  <th className="px-4 py-3.5">Business / Project</th>
                  <th className="px-4 py-3.5">Deal Value</th>
                  <th className="px-4 py-3.5">Received</th>
                  <th className="px-4 py-3.5">Remaining</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Next Due</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedDeals.map((deal) => {
                  const percent = deal.finalAmount > 0 
                    ? Math.min(100, Math.round((deal.totalReceived / deal.finalAmount) * 100)) 
                    : 0;
                  const clientDisplayName = deal.lead?.name || deal.clientNameSnapshot || "Client";
                  const businessName = deal.lead?.business || deal.companyNameSnapshot;
                  const projectName = deal.projectName;

                  return (
                    <tr key={deal.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Client Column */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {deal.lead ? (
                            <button
                              type="button"
                              onClick={() => deal.lead && leadNavigation?.openLead(deal.lead.id)}
                              className="text-left font-bold text-slate-900 hover:text-blue-600 transition-colors flex items-center gap-1 group cursor-pointer"
                            >
                              <span>{clientDisplayName}</span>
                              <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 text-blue-600 transition-opacity" />
                            </button>
                          ) : (
                            <span className="font-bold text-slate-900">{clientDisplayName}</span>
                          )}
                          {renderSourceBadge(deal)}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                          {deal.lead?.phone || deal.clientPhone ? (
                            <span>{deal.lead?.phone || deal.clientPhone}</span>
                          ) : null}
                          {deal.clientEmail ? (
                            <span className="text-slate-400">· {deal.clientEmail}</span>
                          ) : null}
                        </div>
                      </td>

                      {/* Business / Project Column */}
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-800">
                          {businessName || "—"}
                        </div>
                        {projectName && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <FolderKanban size={11} className="text-slate-400" />
                            <span>{projectName}</span>
                          </div>
                        )}
                      </td>

                      {/* Deal Value */}
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        {formatCurrency(deal.finalAmount, deal.currency)}
                      </td>

                      {/* Received */}
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-emerald-700">
                          {formatCurrency(deal.totalReceived, deal.currency)}
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
                          {formatCurrency(deal.remainingBalance, deal.currency)}
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
                                {formatCurrency(deal.nextPaymentDueAmount, deal.currency)}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setActiveDealForPayment(deal)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold transition-colors cursor-pointer"
                            title="Record Payment"
                          >
                            <Plus size={12} /> Payment
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveDealForHistory(deal)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="View Payment History"
                            aria-label="Payment history"
                          >
                            <History size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveDealForEdit(deal)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Edit Deal"
                            aria-label="Edit deal"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveDealForDelete(deal)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Financial Record"
                            aria-label="Delete deal"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE VIEW: Cards */}
          <div className="md:hidden space-y-3">
            {filteredAndSortedDeals.map((deal) => {
              const percent = deal.finalAmount > 0 
                ? Math.min(100, Math.round((deal.totalReceived / deal.finalAmount) * 100)) 
                : 0;
              const clientDisplayName = deal.lead?.name || deal.clientNameSnapshot || "Client";
              const businessName = deal.lead?.business || deal.companyNameSnapshot;
              const projectName = deal.projectName;

              return (
                <div key={deal.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {deal.lead ? (
                          <button
                            type="button"
                            onClick={() => deal.lead && leadNavigation?.openLead(deal.lead.id)}
                            className="text-left font-bold text-slate-900 text-sm hover:text-blue-600 transition-colors"
                          >
                            {clientDisplayName}
                          </button>
                        ) : (
                          <span className="font-bold text-slate-900 text-sm">{clientDisplayName}</span>
                        )}
                        {renderSourceBadge(deal)}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 space-y-0.5">
                        {businessName && <p className="font-medium text-slate-700">{businessName}</p>}
                        {projectName && <p className="text-[11px] text-slate-400">Project: {projectName}</p>}
                        {(deal.lead?.phone || deal.clientPhone) && (
                          <p className="text-[11px] text-slate-400">{deal.lead?.phone || deal.clientPhone}</p>
                        )}
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadgeClass(deal.paymentStatus)} shrink-0`}>
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
                      <span className="font-bold text-slate-900 block mt-0.5">{formatCurrency(deal.finalAmount, deal.currency)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-700/70 block">Received</span>
                      <span className="font-bold text-emerald-700 block mt-0.5">{formatCurrency(deal.totalReceived, deal.currency)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Remaining</span>
                      <span className="font-bold text-slate-900 block mt-0.5">{formatCurrency(deal.remainingBalance, deal.currency)}</span>
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
                        <span className="font-bold">{formatCurrency(deal.nextPaymentDueAmount, deal.currency)}</span>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setActiveDealForPayment(deal)}
                      className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors text-center cursor-pointer"
                    >
                      + Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDealForHistory(deal)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                      title="Payment History"
                    >
                      History
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDealForEdit(deal)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                      title="Edit Deal"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDealForDelete(deal)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title="Delete Financial Record"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ADD OTHER CLIENT DEAL (Quick Create)            */}
      {/* ======================================================== */}
      {isCreateOtherModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Plus size={18} className="text-blue-600" />
                  Add Other Client Deal
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Record money from clients who are not website leads (no CRM lead created).
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateOtherModalOpen(false);
                  setShowMoreOptions(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateOtherClientDeal} className="mt-4 space-y-3.5 text-xs">
              {/* Basic Quick-Create Fields */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Client Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="clientName"
                  required
                  placeholder="e.g. John Doe / Acme Corp"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Final Deal Value (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  name="finalAmount"
                  step="0.01"
                  min="0"
                  required
                  placeholder="50000"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Business / Company Name <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  name="companyName"
                  placeholder="e.g. Apex Global Solutions"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Collapsible: More Options */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowMoreOptions(!showMoreOptions)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors py-1 cursor-pointer"
                >
                  {showMoreOptions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>{showMoreOptions ? "Fewer options" : "More options (Phone, Email, Project, Due Date, Notes)"}</span>
                </button>

                {showMoreOptions && (
                  <div className="mt-3 space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                        <input
                          type="tel"
                          name="clientPhone"
                          placeholder="+91 98765 43210"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                        <input
                          type="email"
                          name="clientEmail"
                          placeholder="client@example.com"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Project / Deal Name</label>
                        <input
                          type="text"
                          name="projectName"
                          placeholder="e.g. Website Redesign"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Currency</label>
                        <input
                          type="text"
                          name="currency"
                          defaultValue="INR"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Deal Status</label>
                      <select
                        name="status"
                        defaultValue="CONFIRMED"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none cursor-pointer"
                      >
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="NEGOTIATING">Negotiating</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="NO_DEAL">No Deal</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Next Payment Due Date</label>
                        <input
                          type="date"
                          name="nextPaymentDueDate"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Next Due Amount (₹)</label>
                        <input
                          type="number"
                          name="nextPaymentDueAmount"
                          step="0.01"
                          min="0"
                          placeholder="25000"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Internal Notes</label>
                      <textarea
                        name="notes"
                        rows={2}
                        placeholder="Additional details about this deal or payment terms..."
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOtherModalOpen(false);
                    setShowMoreOptions(false);
                  }}
                  className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {saving ? "Creating Deal..." : "Create Deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: RECORD PAYMENT                                  */}
      {/* ======================================================== */}
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
                  autoFocus
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
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none cursor-pointer"
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
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none cursor-pointer"
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
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {saving ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: PAYMENT HISTORY                                 */}
      {/* ======================================================== */}
      {activeDealForHistory && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <History size={18} className="text-blue-600" />
                  Payment History
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Client: <strong>{activeDealForHistory.lead?.name || activeDealForHistory.clientNameSnapshot || "Client"}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveDealForHistory(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Financial Overview inside History */}
            <div className="mt-4 grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Deal Value</span>
                <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                  {formatCurrency(activeDealForHistory.finalAmount, activeDealForHistory.currency)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-700/70 block">Received</span>
                <span className="font-bold text-emerald-700 text-sm mt-0.5 block">
                  {formatCurrency(activeDealForHistory.totalReceived, activeDealForHistory.currency)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Remaining</span>
                <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                  {formatCurrency(activeDealForHistory.remainingBalance, activeDealForHistory.currency)}
                </span>
              </div>
            </div>

            {/* Header with Add Payment inside History */}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Transactions ({activeDealForHistory.payments.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveDealForPayment(activeDealForHistory);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
              >
                <Plus size={14} /> Add Payment
              </button>
            </div>

            {/* Transactions List */}
            <div className="mt-2 divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-white">
              {activeDealForHistory.payments.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 italic">
                  No payment entries recorded yet.
                </div>
              ) : (
                activeDealForHistory.payments.map((p) => (
                  <div key={p.id} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/70 transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">
                          {formatCurrency(p.amount, activeDealForHistory.currency)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {p.type === "CUSTOM" && p.customType ? p.customType : PAYMENT_TYPE_LABELS[p.type]}
                        </span>
                        <span className="text-slate-400 text-[11px] font-medium">
                          {PAYMENT_METHOD_LABELS[p.method]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-slate-500 text-[11px]">
                        <span>{p.paymentDate}</span>
                        {p.note && <span className="truncate italic text-slate-400">“{p.note}”</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActivePaymentForEdit({ deal: activeDealForHistory, payment: p })}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Edit payment"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivePaymentForDelete({ deal: activeDealForHistory, payment: p })}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete payment"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-right">
              <button
                type="button"
                onClick={() => setActiveDealForHistory(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: EDIT PAYMENT                                    */}
      {/* ======================================================== */}
      {activePaymentForEdit && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Edit Payment</h3>
              <button
                type="button"
                onClick={() => setActivePaymentForEdit(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditPayment} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  min="0.01"
                  required
                  defaultValue={activePaymentForEdit.payment.amount}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Date *</label>
                  <input
                    type="date"
                    name="paymentDate"
                    required
                    defaultValue={activePaymentForEdit.payment.paymentDate}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method *</label>
                  <select
                    name="method"
                    defaultValue={activePaymentForEdit.payment.method}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none cursor-pointer"
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
                    defaultValue={activePaymentForEdit.payment.type}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none cursor-pointer"
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
                    defaultValue={activePaymentForEdit.payment.customType || ""}
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
                  defaultValue={activePaymentForEdit.payment.note || ""}
                  placeholder="Txn reference"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActivePaymentForEdit(null)}
                  className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {saving ? "Saving..." : "Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: DELETE PAYMENT CONFIRMATION                     */}
      {/* ======================================================== */}
      {activePaymentForDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 size={22} />
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">Delete Payment</h3>
            <p className="mt-1 text-xs text-slate-500">
              Are you sure you want to delete this payment of{" "}
              <strong>{formatCurrency(activePaymentForDelete.payment.amount)}</strong>? Deal totals will automatically recalculate.
            </p>
            <div className="mt-4 flex gap-2.5">
              <button
                type="button"
                onClick={() => setActivePaymentForDelete(null)}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleDeletePayment}
                className="flex-1 rounded-lg bg-rose-600 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {saving ? "Deleting..." : "Delete Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: EDIT CLIENT / DEAL                              */}
      {/* ======================================================== */}
      {activeDealForEdit && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Edit Deal &amp; Client
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeDealForEdit.source === "OTHER_CLIENT" ? "Other Client Deal" : "CRM Client Deal"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveDealForEdit(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditDeal} className="mt-4 space-y-3.5 text-xs">
              {/* Standalone client fields when deal is Other Client */}
              {activeDealForEdit.source === "OTHER_CLIENT" && (
                <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Client Name *</label>
                    <input
                      type="text"
                      name="clientName"
                      required
                      defaultValue={activeDealForEdit.clientNameSnapshot || ""}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Business / Company</label>
                      <input
                        type="text"
                        name="companyName"
                        defaultValue={activeDealForEdit.companyNameSnapshot || ""}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Project Name</label>
                      <input
                        type="text"
                        name="projectName"
                        defaultValue={activeDealForEdit.projectName || ""}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        name="clientPhone"
                        defaultValue={activeDealForEdit.clientPhone || ""}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Email</label>
                      <input
                        type="email"
                        name="clientEmail"
                        defaultValue={activeDealForEdit.clientEmail || ""}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                    <textarea
                      name="notes"
                      rows={2}
                      defaultValue={activeDealForEdit.notes || ""}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Financial fields */}
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
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="NEGOTIATING">Negotiating</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="NO_DEAL">No Deal</option>
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
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {saving ? "Saving..." : "Save Deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 7: DELETE DEAL (Deliberate Confirmation)           */}
      {/* ======================================================== */}
      {activeDealForDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">
              Delete Financial Record
            </h3>
            <p className="mt-2 text-xs text-slate-600">
              Are you sure you want to permanently delete the financial deal record for{" "}
              <strong>{activeDealForDelete.lead?.name || activeDealForDelete.clientNameSnapshot || "this client"}</strong>?
            </p>
            <div className="mt-3 bg-rose-50 border border-rose-200 rounded-xl p-3 text-left text-xs text-rose-800 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertCircle size={14} className="shrink-0 text-rose-600" />
                This action cannot be undone:
              </p>
              <ul className="list-disc list-inside pl-1 text-[11px] text-rose-700 space-y-0.5">
                <li>Deal value of {formatCurrency(activeDealForDelete.finalAmount, activeDealForDelete.currency)} will be deleted.</li>
                <li>All {activeDealForDelete.payments.length} payment records totaling {formatCurrency(activeDealForDelete.totalReceived, activeDealForDelete.currency)} will be permanently removed.</li>
              </ul>
            </div>
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setActiveDealForDelete(null)}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleDeleteDeal}
                className="flex-1 rounded-lg bg-rose-600 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {saving ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
