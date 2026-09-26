"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
import {
  formatCurrency,
  calculateDealMetrics,
  formatDisplayDate,
  formatDisplayDateTime,
  derivePaymentStatus
} from "../calculations";
import {
  addDealPayment,
  updateDealPayment,
  deleteDealPayment,
  upsertLeadDeal,
  createOtherClientDeal,
  deleteDeal,
  createCrmClientDeal
} from "@/app/actions/deals";
import { useLeadNavigation } from "@/features/leads/lead-navigation-provider";
import { useToast } from "@/components/toast-provider";
import { PaymentAnalytics } from "./payment-analytics";
import { DealDetailPanel } from "./deal-detail-panel";
import { AiNoteEditor } from "@/components/ui/ai-note-editor";
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
  FileText,
  Eye,
  User,
  ArrowLeft,
  Users,
  Store,
  Loader2,
  UserCheck
} from "lucide-react";

// ─── Debounce hook ───────────────────────────────────────────────────────────
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface DealsWorkspaceProps {
  initialDeals?: SerializedDeal[];
  initialMetrics?: Partial<DealSummaryMetrics>;
  deals?: any[];
  leads?: any[];
  summary?: any;
}

function PaymentNote({ note }: { note: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = note.length > 90 || note.includes("\n");

  return (
    <div className="mt-2 text-xs text-slate-700 bg-slate-50/90 border-l-2 border-blue-500 rounded-r-lg p-2.5">
      <p className={expanded || !isLong ? "whitespace-pre-wrap break-words italic text-slate-700 font-normal leading-relaxed" : "line-clamp-2 whitespace-pre-wrap break-words italic text-slate-700 font-normal leading-relaxed"}>
        &ldquo;{note}&rdquo;
      </p>
      {isLong && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="mt-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

// ─── Lead Search Result ──────────────────────────────────────────────────────
function LeadSearchItem({ lead, onSelect, disabled }: { lead: any; onSelect: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="w-full text-left px-3 py-3 rounded-xl hover:bg-blue-50 transition-colors flex items-start gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-blue-200"
    >
      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
        <User className="text-blue-600" size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 truncate">{lead.name}</p>
        {lead.business && (
          <p className="text-xs text-slate-500 truncate">{lead.business}</p>
        )}
        <div className="flex items-center gap-3 mt-1">
          {lead.phone && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
              <Phone size={11} />
              {lead.phone}
            </span>
          )}
          {lead.email && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
              <Mail size={11} />
              {lead.email}
            </span>
          )}
        </div>
      </div>
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
        lead.status === "CONVERTED" || lead.status === "WON"
          ? "bg-emerald-50 text-emerald-700"
          : lead.status === "NEGOTIATING"
            ? "bg-blue-50 text-blue-700"
            : "bg-slate-100 text-slate-600"
      }`}>
        {lead.status}
      </span>
    </button>
  );
}

export function DealsWorkspace({ initialDeals = [], initialMetrics }: DealsWorkspaceProps) {
  const router = useRouter();
  const leadNavigation = useLeadNavigation();
  const { showToast, showUndoToast } = useToast();

  const [deals, setDeals] = useState<SerializedDeal[]>(initialDeals);

  // Sync deals with incoming data on revalidation / route refresh
  useEffect(() => {
    setDeals(initialDeals);
    setSelectedDealForDetail((prev) => {
      if (!prev) return null;
      const updated = initialDeals.find((d) => d.id === prev.id);
      return updated || prev;
    });
  }, [initialDeals]);
  const [activeTab, setActiveTab] = useState<"all" | "crm" | "other">("all");
  const [filter, setFilter] = useState<"all" | "unpaid" | "partially_paid" | "paid" | "overdue">("all");
  const [sortBy, setSortBy] = useState<"highest_outstanding" | "nearest_due_date" | "latest_deal">("highest_outstanding");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal States
  const [selectedDealForDetail, setSelectedDealForDetail] = useState<SerializedDeal | null>(null);
  const [isAddDealFlowOpen, setIsAddDealFlowOpen] = useState(false);
  // "add_deal_type": user chooses between CRM / Other
  // "create_crm_deal": searching leads + form
  const [addDealStep, setAddDealStep] = useState<"type" | "crm_search" | "crm_form" | "other_form">("type");
  const [selectedLeadForDeal, setSelectedLeadForDeal] = useState<any | null>(null);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [activeDealForPayment, setActiveDealForPayment] = useState<SerializedDeal | null>(null);
  const [activeDealForHistory, setActiveDealForHistory] = useState<SerializedDeal | null>(null);
  const [activeTransactionDetail, setActiveTransactionDetail] = useState<{ deal: SerializedDeal; payment: SerializedPayment } | null>(null);
  const [activeDealForEdit, setActiveDealForEdit] = useState<SerializedDeal | null>(null);
  const [activeDealForDelete, setActiveDealForDelete] = useState<SerializedDeal | null>(null);
  const [activePaymentForEdit, setActivePaymentForEdit] = useState<{ deal: SerializedDeal; payment: SerializedPayment } | null>(null);
  const [activePaymentForDelete, setActivePaymentForDelete] = useState<{ deal: SerializedDeal; payment: SerializedPayment } | null>(null);
  const [saving, setSaving] = useState(false);

  // CRM lead search
  const [leadSearchQuery, setLeadSearchQuery] = useState("");
  const [leadSearchResults, setLeadSearchResults] = useState<any[]>([]);
  const [leadSearchLoading, setLeadSearchLoading] = useState(false);
  const [leadSearchError, setLeadSearchError] = useState<string | null>(null);
  const debouncedLeadQuery = useDebouncedValue(leadSearchQuery, 300);
  const searchAbortRef = useRef<AbortController | null>(null);

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

    // Search query matching (includes client name, company, project, phone, email, deal notes)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((d) => {
        const names = [d.lead?.name, d.clientNameSnapshot].filter(Boolean).join(" ").toLowerCase();
        const businesses = [d.lead?.business, d.companyNameSnapshot].filter(Boolean).join(" ").toLowerCase();
        const phones = [d.lead?.phone, d.clientPhone].filter(Boolean).join(" ").toLowerCase();
        const emails = [d.lead?.email, d.clientEmail].filter(Boolean).join(" ").toLowerCase();
        const project = (d.projectName || "").toLowerCase();
        const notes = (d.notes || "").toLowerCase();
        return (
          names.includes(q) ||
          businesses.includes(q) ||
          project.includes(q) ||
          phones.includes(q) ||
          emails.includes(q) ||
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

  // ─── Lead search effect ───────────────────────────────────────────────────
  useEffect(() => {
    if (addDealStep !== "crm_search" || !debouncedLeadQuery.trim()) {
      setLeadSearchResults([]);
      setLeadSearchError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    searchAbortRef.current = controller;

    const run = async () => {
      setLeadSearchLoading(true);
      setLeadSearchError(null);
      try {
        // Use the server action via dynamic import to avoid bundling issues
        const { searchLeadsForWhatsApp } = await import("@/app/actions/lead-search");
        const result = await searchLeadsForWhatsApp(debouncedLeadQuery.trim());
        if (!cancelled && result.success && Array.isArray(result.data)) {
          setLeadSearchResults(result.data as any[]);
        } else if (!cancelled) {
          setLeadSearchResults([]);
        }
      } catch (e) {
        if (!cancelled) {
          setLeadSearchError("Search failed. Please try again.");
          setLeadSearchResults([]);
        }
      } finally {
        if (!cancelled) setLeadSearchLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debouncedLeadQuery, addDealStep]);

  // ─── Handler: Create CRM Client Deal ─────────────────────────────────────
  const handleCreateCrmClientDeal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedLeadForDeal) return;
    setSaving(true);
    const res = await createCrmClientDeal(selectedLeadForDeal.id);

    setSaving(false);
    if (res.success) {
      if (res.alreadyExists) {
        showToast("This CRM client already has a deal", "info");
        setDeals((prev) => {
          const exists = prev.find((d) => d.id === res.data.id);
          if (exists) return prev;
          return [res.data, ...prev];
        });
      } else if (res.undoId) {
        showUndoToast("CRM Client deal created successfully", res.undoId);
        setDeals((prev) => [res.data, ...prev]);
      } else {
        showToast("CRM Client deal created successfully", "success");
        setDeals((prev) => [res.data, ...prev]);
      }
      closeAddDealFlow();
      router.refresh();
    } else {
      showToast(res.error || "Failed to create deal", "error");
    }
  };

  // ─── Handler: Create Other Client Deal ───────────────────────────────────
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
      if (res.undoId) {
        showUndoToast("Other Client deal created successfully", res.undoId);
      } else {
        showToast("Other Client deal created successfully", "success");
      }
      setDeals((prev) => [res.data, ...prev]);
      closeAddDealFlow();
      router.refresh();
    } else {
      showToast(res.error || "Failed to create deal", "error");
    }
  };

  // ─── Handler: Record Payment ─────────────────────────────────────────────
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
      if (res.undoId) {
        showUndoToast("Payment recorded successfully", res.undoId);
      } else {
        showToast("Payment recorded successfully", "success");
      }
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
          if (selectedDealForDetail && selectedDealForDetail.id === targetDealId) {
            setSelectedDealForDetail(updatedDeal);
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

  // ─── Handler: Edit Payment ───────────────────────────────────────────────
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
      if (res.undoId) {
        showUndoToast("Payment updated successfully", res.undoId);
      } else {
        showToast("Payment updated successfully", "success");
      }
      const updatedPayment = res.data;
      setDeals((prev) =>
        prev.map((d) => {
          if (d.id !== deal.id) return d;
          const updatedPayments = d.payments.map((p) =>
            p.id === updatedPayment.id ? updatedPayment : p
          );
          const newReceived = updatedPayments.reduce((s, p) => s + p.amount, 0);
          const newRemaining = Math.max(0, d.finalAmount - newReceived);
          let newStatus = d.paymentStatus;
          if (d.finalAmount > 0 && newReceived >= d.finalAmount) newStatus = "Paid";
          else if (newReceived > 0) newStatus = "Partially Paid";
          else newStatus = "Unpaid";

          const updated = {
            ...d,
            payments: updatedPayments,
            totalReceived: newReceived,
            remainingBalance: newRemaining,
            paymentStatus: newStatus,
          };
          if (selectedDealForDetail && selectedDealForDetail.id === d.id) {
            setSelectedDealForDetail(updated);
          }
          if (activeDealForHistory && activeDealForHistory.id === d.id) {
            setActiveDealForHistory(updated);
          }
          return updated;
        })
      );
      setActivePaymentForEdit(null);
      router.refresh();
    } else {
      showToast(res.error || "Failed to update payment", "error");
    }
  };

  // ─── Handler: Delete Payment ─────────────────────────────────────────────
  const handleDeletePayment = async () => {
    if (!activePaymentForDelete) return;
    setSaving(true);
    const { deal, payment } = activePaymentForDelete;
    const res = await deleteDealPayment(payment.id);

    setSaving(false);
    if (res.success) {
      if (res.undoId) {
        showUndoToast("Payment deleted successfully", res.undoId);
      } else {
        showToast("Payment deleted successfully", "info");
      }
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

          const updated = {
            ...d,
            payments: updatedPayments,
            totalReceived: newReceived,
            remainingBalance: newRemaining,
            paymentStatus: newStatus,
          };
          if (selectedDealForDetail && selectedDealForDetail.id === d.id) {
            setSelectedDealForDetail(updated);
          }
          if (activeDealForHistory && activeDealForHistory.id === d.id) {
            setActiveDealForHistory(updated);
          }
          return updated;
        })
      );
      setActivePaymentForDelete(null);
      router.refresh();
    } else {
      showToast(res.error || "Failed to delete payment", "error");
    }
  };

  // ─── Handler: Update Deal ────────────────────────────────────────────────
  const handleUpdateDeal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeDealForEdit) return;
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const dealId = activeDealForEdit.id;
    const finalAmount = Number(formData.get("finalAmount"));
    const status = String(formData.get("status") || activeDealForEdit.status) as DealStatus;
    const nextPaymentDueDate = formData.get("nextPaymentDueDate") ? String(formData.get("nextPaymentDueDate")) : undefined;
    const nextPaymentDueAmount = formData.get("nextPaymentDueAmount") ? Number(formData.get("nextPaymentDueAmount")) : undefined;
    const notes = formData.get("notes") ? String(formData.get("notes")).trim() : undefined;
    const projectName = formData.get("projectName") ? String(formData.get("projectName")).trim() : undefined;
    const clientName = formData.get("clientName") ? String(formData.get("clientName")).trim() : undefined;
    const clientPhone = formData.get("clientPhone") ? String(formData.get("clientPhone")).trim() : undefined;
    const clientEmail = formData.get("clientEmail") ? String(formData.get("clientEmail")).trim() : undefined;
    const companyName = formData.get("companyName") ? String(formData.get("companyName")).trim() : undefined;
    const currency = String(formData.get("currency") || activeDealForEdit.currency) as any;

    const res = await upsertLeadDeal({
      dealId,
      finalAmount,
      status,
      nextPaymentDueDate,
      nextPaymentDueAmount,
      notes,
      projectName,
      clientName,
      clientPhone,
      clientEmail,
      companyName,
      currency,
    });

    setSaving(false);
    if (res.success) {
      if (res.undoId) {
        showUndoToast("Deal updated successfully", res.undoId);
      } else {
        showToast("Deal updated successfully", "success");
      }
      setDeals((prev) =>
        prev.map((d) => {
          if (d.id !== res.data.id) return d;
          const newReceived = res.data.payments.reduce((s: number, p: SerializedPayment) => s + p.amount, 0);
          return {
            ...res.data,
            totalReceived: newReceived,
            remainingBalance: Math.max(0, res.data.finalAmount - newReceived),
            paymentStatus: derivePaymentStatus(res.data.finalAmount, newReceived, res.data.nextPaymentDueDate),
          };
        })
      );
      setActiveDealForEdit(null);
      router.refresh();
    } else {
      showToast(res.error || "Failed to update deal", "error");
    }
  };

  // ─── Handler: Delete Deal ────────────────────────────────────────────────
  const handleDeleteDeal = async () => {
    if (!activeDealForDelete) return;
    setSaving(true);
    const dealId = activeDealForDelete.id;
    const res = await deleteDeal(dealId);
    setSaving(false);
    if (res.success) {
      if (res.undoId) {
        showUndoToast("Financial record deleted successfully", res.undoId);
      } else {
        showToast("Financial record deleted successfully", "info");
      }
      setDeals((prev) => prev.filter((d) => d.id !== dealId));
      setActiveDealForDelete(null);
      if (selectedDealForDetail && selectedDealForDetail.id === dealId) {
        setSelectedDealForDetail(null);
      }
      if (activeDealForHistory && activeDealForHistory.id === dealId) {
        setActiveDealForHistory(null);
      }
      router.refresh();
    } else {
      showToast(res.error || "Failed to delete financial record", "error");
    }
  };

  // ─── Flow control ────────────────────────────────────────────────────────
  const closeAddDealFlow = () => {
    setIsAddDealFlowOpen(false);
    setAddDealStep("type");
    setSelectedLeadForDeal(null);
    setLeadSearchQuery("");
    setLeadSearchResults([]);
    setLeadSearchError(null);
  };

  const openAddDealFlow = (defaultType: "crm" | "other" = "crm") => {
    setIsAddDealFlowOpen(true);
    setSelectedLeadForDeal(null);
    setLeadSearchQuery("");
    setLeadSearchResults([]);
    setLeadSearchError(null);
    if (defaultType === "crm") {
      setAddDealStep("crm_search");
    } else {
      setAddDealStep("other_form");
    }
  };

  const selectLeadForDeal = (lead: any) => {
    setSelectedLeadForDeal(lead);
    setAddDealStep("crm_form");
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
      {/* ─── Header with Title and Add Deal Button ───────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Receipt className="text-blue-600" size={26} />
            Deals &amp; Payments
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Track deals, milestone payments, collections, and outstanding balances.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openAddDealFlow(activeTab === "other" ? "other" : "crm")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs sm:text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Deal</span>
          </button>
        </div>
      </div>

      {/* ─── TOP-LEVEL TABS ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 border whitespace-nowrap ${
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
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 border whitespace-nowrap ${
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
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 border whitespace-nowrap ${
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

      {/* ─── TAB-SCOPED SUMMARY METRICS CARDS ────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block">
            Total Received
          </span>
          <span className="mt-1 text-lg sm:text-2xl font-bold text-emerald-700 block">
            {formatCurrency(metrics.totalReceived)}
          </span>
          <span className="mt-1 text-xs text-emerald-600/80 block font-medium">
            Real payments received
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm col-span-2 sm:col-span-1">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider block">
            Collection Rate
          </span>
          <span className="mt-1 text-lg sm:text-2xl font-bold text-blue-700 block">
            {metrics.collectionRate ?? ((metrics.totalDealValue ?? 0) > 0 ? Math.round(((metrics.totalReceived ?? 0) / (metrics.totalDealValue ?? 1)) * 10000) / 100 : 0)}%
          </span>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{
                width: `${Math.min(
                  100,
                  metrics.collectionRate ?? ((metrics.totalDealValue ?? 0) > 0 ? ((metrics.totalReceived ?? 0) / (metrics.totalDealValue ?? 1)) * 100 : 0)
                )}%`,
              }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider block">
            Outstanding
          </span>
          <span className="mt-1 text-lg sm:text-2xl font-bold text-amber-700 block">
            {formatCurrency(metrics.totalOutstanding)}
          </span>
          <span className="mt-1 text-xs text-amber-600/80 block font-medium">
            Pending collections
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider block">
            Overdue Amount
          </span>
          <span className="mt-1 text-lg sm:text-2xl font-bold text-rose-700 block">
            {formatCurrency(metrics.overdueAmount)}
          </span>
          <span className="mt-1 text-xs text-rose-600/80 block font-medium">
            Past due date
          </span>
        </div>
      </div>

      {/* ─── FILTERS AND SEARCH ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Payment status filter */}
        <div className="relative">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="appearance-none bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer shadow-sm"
          >
            <option value="all">All Statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Sort by */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="appearance-none bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer shadow-sm"
          >
            <option value="highest_outstanding">Highest Outstanding</option>
            <option value="nearest_due_date">Nearest Due Date</option>
            <option value="latest_deal">Latest Deal</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Search */}
        <div className="relative flex-1 w-full sm:w-auto">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search deals..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
          />
        </div>
      </div>

      {/* ─── DEAL LIST ────────────────────────────────────────────────────── */}
      {filteredAndSortedDeals.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
          <Receipt size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-sm font-semibold text-slate-500">
            {searchQuery ? "No deals match your search" : "No deals yet"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {searchQuery ? "Try adjusting your search terms" : `Click "Add Deal" to create your first ${activeTab === "crm" ? "CRM client" : activeTab === "other" ? "other client" : ""} deal`}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredAndSortedDeals.map((deal) => {
            const isCrm = deal.source === "CRM_LEAD";
            const isOther = deal.source === "OTHER_CLIENT";
            const isPaid = deal.paymentStatus === "Paid";
            const isOverdue = deal.paymentStatus === "Overdue";

            return (
              <div
                key={deal.id}
                className={`rounded-2xl border shadow-sm transition-all hover:shadow-md ${
                  isOverdue
                    ? "border-rose-200 bg-rose-50/30"
                    : isPaid
                      ? "border-emerald-200 bg-emerald-50/20"
                      : "border-slate-200 bg-white"
                }`}
              >
                {/* Deal card header */}
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isCrm ? "bg-blue-100" : "bg-purple-100"
                      }`}>
                        {isCrm ? (
                          <UserCheck className="text-blue-600" size={20} />
                        ) : (
                          <Store className="text-purple-600" size={20} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                            {isCrm ? deal.lead?.name || deal.clientNameSnapshot : deal.clientNameSnapshot}
                          </h3>
                          {renderSourceBadge(deal)}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeClass(deal.paymentStatus)}`}>
                            {deal.paymentStatus}
                          </span>
                          {isOverdue && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                              <AlertCircle size={10} />
                              Overdue
                            </span>
                          )}
                        </div>
                        {isCrm && deal.lead?.business && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{deal.lead.business}</p>
                        )}
                        {isOther && deal.companyNameSnapshot && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{deal.companyNameSnapshot}</p>
                        )}
                        {deal.projectName && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate">{deal.projectName}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm sm:text-base font-bold text-slate-900">
                        {formatCurrency(deal.finalAmount)}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {deal.remainingBalance > 0 ? `${formatCurrency(deal.remainingBalance)} left` : "Fully paid"}
                      </p>
                    </div>
                  </div>

                  {/* Deal info bar */}
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                      <CreditCard size={12} />
                      {deal.payments.length} payment{deal.payments.length !== 1 ? "s" : ""}
                    </span>
                    {deal.nextPaymentDueDate && (
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                        isOverdue ? "text-rose-600" : "text-slate-500"
                      }`}>
                        <Calendar size={12} />
                        Due: {formatDisplayDate(deal.nextPaymentDueDate)}
                        {deal.nextPaymentDueAmount && ` (${formatCurrency(deal.nextPaymentDueAmount)})`}
                      </span>
                    )}
                    {isCrm && deal.lead && (
                      <button
                        type="button"
                        onClick={() => {
                          if (leadNavigation) {
                            leadNavigation.openLead(deal.lead!.id);
                          }
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                      >
                        <ExternalLink size={11} />
                        View Lead
                      </button>
                    )}
                    {isOther && deal.clientPhone && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                        <Phone size={12} />
                        {deal.clientPhone}
                      </span>
                    )}
                  </div>

                  {/* Quick actions */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setActiveDealForPayment(deal)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer border border-blue-200"
                    >
                      <Plus size={13} />
                      Record Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDealForHistory(deal)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer border border-slate-200"
                    >
                      <History size={13} />
                      History
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDealForEdit(deal)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer border border-slate-200"
                    >
                      <Edit2 size={13} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDealForDetail(deal);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer border border-slate-200"
                    >
                      <Eye size={13} />
                      Details
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDealForDelete(deal)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer border border-rose-200"
                    >
                      <Trash2 size={13} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Payment Analytics ────────────────────────────────────────────── */}
      <PaymentAnalytics deals={tabScopedDeals} activeTab={activeTab} />

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ─── MODALS ────────────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}

      {/* ─── ADD DEAL FLOW: Type Selection ───────────────────────────────── */}
      {isAddDealFlowOpen && addDealStep === "type" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={closeAddDealFlow}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Add New Deal</h2>
              <button onClick={closeAddDealFlow} className="p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <button
                type="button"
                onClick={() => openAddDealFlow("crm")}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer text-left group"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
                  <UserCheck className="text-blue-600" size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">CRM Client</p>
                  <p className="text-xs text-slate-500 mt-0.5">Create a deal for an existing CRM lead</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => openAddDealFlow("other")}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50/50 transition-all cursor-pointer text-left group"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center shrink-0 group-hover:bg-purple-200 transition-colors">
                  <Store className="text-purple-600" size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Other Client</p>
                  <p className="text-xs text-slate-500 mt-0.5">Create a standalone deal for an external client</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD DEAL FLOW: CRM Client — Lead Search ─────────────────────── */}
      {isAddDealFlowOpen && addDealStep === "crm_search" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={closeAddDealFlow}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setAddDealStep("type"); setLeadSearchQuery(""); setLeadSearchResults([]); }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={18} className="text-slate-400" />
                </button>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Select CRM Client</h2>
                  <p className="text-[11px] text-slate-500">Search by name or phone number</p>
                </div>
              </div>
              <button onClick={closeAddDealFlow} className="p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {/* Search input */}
            <div className="p-4 border-b border-slate-100 shrink-0">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={leadSearchQuery}
                  onChange={(e) => setLeadSearchQuery(e.target.value)}
                  placeholder="Search leads by name or phone..."
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                />
                {leadSearchLoading && (
                  <Loader2 size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" />
                )}
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-2">
              {leadSearchError && (
                <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  {leadSearchError}
                </div>
              )}
              {!leadSearchLoading && !leadSearchError && debouncedLeadQuery.trim() && leadSearchResults.length === 0 && (
                <div className="text-center py-10 px-4">
                  <User size={40} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-semibold text-slate-500">No leads found</p>
                  <p className="text-xs text-slate-400 mt-1">Try a different search term</p>
                </div>
              )}
              {!debouncedLeadQuery.trim() && (
                <div className="text-center py-10 px-4">
                  <Search size={40} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-semibold text-slate-500">Start typing to search</p>
                  <p className="text-xs text-slate-400 mt-1">Search by lead name or phone number</p>
                </div>
              )}
              <div className="space-y-1">
                {leadSearchResults.map((lead) => (
                  <LeadSearchItem
                    key={lead.id}
                    lead={lead}
                    onSelect={() => selectLeadForDeal(lead)}
                    disabled={saving}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD DEAL FLOW: CRM Client — Deal Form ───────────────────────── */}
      {isAddDealFlowOpen && addDealStep === "crm_form" && selectedLeadForDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={closeAddDealFlow}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAddDealStep("crm_search")}
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={18} className="text-slate-400" />
                </button>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Create Deal for {selectedLeadForDeal.name}</h2>
                  <p className="text-[11px] text-slate-500">
                    {selectedLeadForDeal.business || selectedLeadForDeal.phone || selectedLeadForDeal.email || "No additional info"}
                  </p>
                </div>
              </div>
              <button onClick={closeAddDealFlow} className="p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateCrmClientDeal} className="p-5 space-y-4">
              {/* Lead info (read-only) */}
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-800 mb-2">
                  <User size={14} />
                  CRM Lead Information
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-blue-600 font-medium">Name:</span>
                    <span className="ml-1 text-blue-900">{selectedLeadForDeal.name}</span>
                  </div>
                  {selectedLeadForDeal.business && (
                    <div>
                      <span className="text-blue-600 font-medium">Company:</span>
                      <span className="ml-1 text-blue-900">{selectedLeadForDeal.business}</span>
                    </div>
                  )}
                  {selectedLeadForDeal.phone && (
                    <div>
                      <span className="text-blue-600 font-medium">Phone:</span>
                      <span className="ml-1 text-blue-900">{selectedLeadForDeal.phone}</span>
                    </div>
                  )}
                  {selectedLeadForDeal.email && (
                    <div>
                      <span className="text-blue-600 font-medium">Email:</span>
                      <span className="ml-1 text-blue-900">{selectedLeadForDeal.email}</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-blue-600/80 italic">
                  Lead details are linked automatically. No duplicate will be created.
                </p>
              </div>

              {/* Deal Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Deal Amount (INR)</label>
                <input
                  type="number"
                  name="finalAmount"
                  min="0"
                  step="0.01"
                  required
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  placeholder="0.00"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <select
                  name="status"
                  defaultValue="NEGOTIATING"
                  className="w-full appearance-none bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                >
                  {Object.entries(DEAL_STATUS_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Project Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Project Name (optional)</label>
                <input
                  type="text"
                  name="projectName"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  placeholder="e.g., Website Redesign"
                />
              </div>

              {/* Next Payment Due */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Next Payment Due (optional)</label>
                  <input
                    type="date"
                    name="nextPaymentDueDate"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Due Amount (optional)</label>
                  <input
                    type="number"
                    name="nextPaymentDueAmount"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes (optional)</label>
                <textarea
                  name="notes"
                  rows={2}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm resize-none"
                  placeholder="Add any notes about this deal..."
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeAddDealFlow}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  Create Deal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── ADD DEAL FLOW: Other Client — Deal Form ─────────────────────── */}
      {isAddDealFlowOpen && addDealStep === "other_form" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={closeAddDealFlow}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAddDealStep("type")}
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={18} className="text-slate-400" />
                </button>
                <h2 className="text-base font-bold text-slate-900">Add Other Client Deal</h2>
              </div>
              <button onClick={closeAddDealFlow} className="p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateOtherClientDeal} className="p-5 space-y-4">
              {/* Client Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Client Name *</label>
                <input
                  type="text"
                  name="clientName"
                  required
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  placeholder="Client or company name"
                />
              </div>

              {/* Company Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name (optional)</label>
                <input
                  type="text"
                  name="companyName"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  placeholder="Company name"
                />
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone (optional)</label>
                  <input
                    type="tel"
                    name="clientPhone"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email (optional)</label>
                  <input
                    type="email"
                    name="clientEmail"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                    placeholder="client@email.com"
                  />
                </div>
              </div>

              {/* Deal Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Deal Amount (INR) *</label>
                <input
                  type="number"
                  name="finalAmount"
                  min="0"
                  step="0.01"
                  required
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  placeholder="0.00"
                />
              </div>

              {/* Currency & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
                  <select
                    name="currency"
                    defaultValue="INR"
                    className="w-full appearance-none bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue="CONFIRMED"
                    className="w-full appearance-none bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  >
                    {Object.entries(DEAL_STATUS_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Project Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Project Name (optional)</label>
                <input
                  type="text"
                  name="projectName"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  placeholder="e.g., Website Redesign"
                />
              </div>

              {/* Next Payment Due */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Next Payment Due (optional)</label>
                  <input
                    type="date"
                    name="nextPaymentDueDate"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Due Amount (optional)</label>
                  <input
                    type="number"
                    name="nextPaymentDueAmount"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes (optional)</label>
                <textarea
                  name="notes"
                  rows={2}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm resize-none"
                  placeholder="Add any notes about this deal..."
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeAddDealFlow}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  Create Deal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── RECORD PAYMENT MODAL ─────────────────────────────────────────── */}
      {activeDealForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setActiveDealForPayment(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Record Payment</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeDealForPayment.source === "CRM_LEAD" ? activeDealForPayment.lead?.name : activeDealForPayment.clientNameSnapshot}
                </p>
              </div>
              <button onClick={() => setActiveDealForPayment(null)} className="p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (INR) *</label>
                <input
                  type="number"
                  name="amount"
                  min="0"
                  step="0.01"
                  required
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  name="paymentDate"
                  required
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
                  <select
                    name="type"
                    defaultValue="PARTIAL"
                    className="w-full appearance-none bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  >
                    {Object.entries(PAYMENT_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Method</label>
                  <select
                    name="method"
                    defaultValue="UPI"
                    className="w-full appearance-none bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  >
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reference (optional)</label>
                <input
                  type="text"
                  name="reference"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  placeholder="Transaction reference number"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Note (optional)</label>
                <textarea
                  name="note"
                  rows={2}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm resize-none"
                  placeholder="Payment note..."
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveDealForPayment(null)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT PAYMENT MODAL ───────────────────────────────────────────── */}
      {activePaymentForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setActivePaymentForEdit(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Edit Payment</h2>
              <button onClick={() => setActivePaymentForEdit(null)} className="p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleEditPayment} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (INR) *</label>
                <input
                  type="number"
                  name="amount"
                  min="0"
                  step="0.01"
                  required
                  defaultValue={activePaymentForEdit.payment.amount}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  name="paymentDate"
                  required
                  defaultValue={new Date(activePaymentForEdit.payment.paymentDate).toISOString().split("T")[0]}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
                  <select
                    name="type"
                    defaultValue={activePaymentForEdit.payment.type}
                    className="w-full appearance-none bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  >
                    {Object.entries(PAYMENT_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Method</label>
                  <select
                    name="method"
                    defaultValue={activePaymentForEdit.payment.method}
                    className="w-full appearance-none bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  >
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Note (optional)</label>
                <textarea
                  name="note"
                  rows={2}
                  defaultValue={activePaymentForEdit.payment.note || ""}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActivePaymentForEdit(null)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  Update Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE PAYMENT CONFIRMATION ──────────────────────────────────── */}
      {activePaymentForDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setActivePaymentForDelete(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="text-rose-600" size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Payment?</h3>
              <p className="text-xs text-slate-500 mt-2">
                Are you sure you want to delete this payment of <strong>{formatCurrency(activePaymentForDelete.payment.amount)}</strong>?
                This action can be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 p-5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActivePaymentForDelete(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePayment}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE DEAL CONFIRMATION ─────────────────────────────────────── */}
      {activeDealForDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setActiveDealForDelete(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="text-rose-600" size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Deal?</h3>
              <p className="text-xs text-slate-500 mt-2">
                Are you sure you want to delete this deal and all its payments? This action can be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 p-5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveDealForDelete(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDeal}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── EDIT DEAL MODAL ─────────────────────────────────────────────── */}
      {activeDealForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setActiveDealForEdit(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Edit Deal</h2>
              <button onClick={() => setActiveDealForEdit(null)} className="p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleUpdateDeal} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Client Name</label>
                  <input
                    type="text"
                    name="clientName"
                    defaultValue={activeDealForEdit.clientNameSnapshot || ""}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Deal Amount (INR)</label>
                  <input
                    type="number"
                    name="finalAmount"
                    min="0"
                    step="0.01"
                    required
                    defaultValue={activeDealForEdit.finalAmount}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={activeDealForEdit.status}
                    className="w-full appearance-none bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  >
                    {Object.entries(DEAL_STATUS_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    name="clientPhone"
                    defaultValue={activeDealForEdit.clientPhone || ""}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Project Name</label>
                <input
                  type="text"
                  name="projectName"
                  defaultValue={activeDealForEdit.projectName || ""}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Next Payment Due</label>
                  <input
                    type="date"
                    name="nextPaymentDueDate"
                    defaultValue={activeDealForEdit.nextPaymentDueDate || ""}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Due Amount</label>
                  <input
                    type="number"
                    name="nextPaymentDueAmount"
                    min="0"
                    step="0.01"
                    defaultValue={activeDealForEdit.nextPaymentDueAmount || ""}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={activeDealForEdit.notes || ""}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveDealForEdit(null)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  Update Deal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── PAYMENT HISTORY MODAL ────────────────────────────────────────── */}
      {activeDealForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setActiveDealForHistory(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-base font-bold text-slate-900">Payment History</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeDealForHistory.source === "CRM_LEAD" ? activeDealForHistory.lead?.name : activeDealForHistory.clientNameSnapshot}
                </p>
              </div>
              <button onClick={() => setActiveDealForHistory(null)} className="p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-5">
              {activeDealForHistory.payments.length === 0 ? (
                <div className="text-center py-10">
                  <History size={40} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-semibold text-slate-500">No payments yet</p>
                  <p className="text-xs text-slate-400 mt-1">Record the first payment to see it here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeDealForHistory.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{formatCurrency(payment.amount)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            payment.type === "ADVANCE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            payment.type === "FINAL" ? "bg-blue-50 text-blue-700 border-blue-200" :
                            "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                            {PAYMENT_TYPE_LABELS[payment.type] || payment.type}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                            {PAYMENT_METHOD_LABELS[payment.method] || payment.method}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">{formatDisplayDate(payment.paymentDate)}</p>
                        {payment.note && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{payment.note}</p>}
                      </div>
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveDealForHistory(null);
                            setActivePaymentForEdit({ deal: activeDealForHistory, payment });
                          }}
                          className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                          title="Edit payment"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveDealForHistory(null);
                            setActivePaymentForDelete({ deal: activeDealForHistory, payment });
                          }}
                          className="p-2 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Delete payment"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── DEAL DETAIL PANEL ────────────────────────────────────────────── */}
      {selectedDealForDetail && (
        <DealDetailPanel
          deal={selectedDealForDetail}
          onClose={() => setSelectedDealForDetail(null)}
          onEditDeal={(deal) => {
            setSelectedDealForDetail(null);
            setActiveDealForEdit(deal);
          }}
          onRecordPayment={(deal) => {
            setSelectedDealForDetail(null);
            setActiveDealForPayment(deal);
          }}
        />
      )}
    </div>
  );
}
