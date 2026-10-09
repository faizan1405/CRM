"use client";

import { useEffect, useState } from "react";
import { 
  getLeadDeals, 
  upsertLeadDeal, 
  createCrmClientDeal,
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
  Briefcase, 
  Plus, 
  Edit2, 
  Trash2, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  X,
  CreditCard,
  ChevronDown,
  ChevronUp,
  FileText
} from "lucide-react";
import { AiNoteEditor } from "@/components/ui/ai-note-editor";
import { useToast } from "@/components/toast-provider";

interface LeadDealSectionProps {
  leadId: string;
  leadQuotedAmount?: number | null;
}

export function LeadDealSection({ leadId, leadQuotedAmount }: LeadDealSectionProps) {
  const [deals, setDeals] = useState<SerializedDeal[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [createDealModalOpen, setCreateDealModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<SerializedDeal | null>(null);
  
  // Payment state
  const [paymentModalDeal, setPaymentModalDeal] = useState<SerializedDeal | null>(null);
  const [editingPayment, setEditingPayment] = useState<SerializedPayment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<SerializedPayment | null>(null);
  
  // Accordion state for payment history per deal
  const [expandedDealIds, setExpandedDealIds] = useState<Set<string>>(new Set());
  
  const [saving, setSaving] = useState(false);
  const { showToast, showUndoToast } = useToast();

  // Load all deals for this client
  const loadDeals = async () => {
    try {
      const res = await getLeadDeals(leadId);
      if (res.success && res.data) {
        setDeals(res.data);
        // Expand deals by default if there's only 1 or 2
        if (res.data.length <= 2) {
          setExpandedDealIds(new Set(res.data.map(d => d.id)));
        }
      } else {
        setDeals([]);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeals();
  }, [leadId]);

  const toggleExpand = (dealId: string) => {
    setExpandedDealIds(prev => {
      const next = new Set(prev);
      if (next.has(dealId)) {
        next.delete(dealId);
      } else {
        next.add(dealId);
      }
      return next;
    });
  };

  // Handler: Create New Deal / Project for this CRM Client
  const handleCreateDeal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const projectName = formData.get("projectName") ? String(formData.get("projectName")).trim() : undefined;
    const finalAmount = Number(formData.get("finalAmount")) || 0;
    const quotedAmount = formData.get("quotedAmount") ? Number(formData.get("quotedAmount")) : null;
    const currency = String(formData.get("currency") || "INR");
    const status = String(formData.get("status") || "NEGOTIATING") as DealStatus;
    const nextPaymentDueDate = formData.get("nextPaymentDueDate") ? String(formData.get("nextPaymentDueDate")) : null;
    const nextPaymentDueAmount = formData.get("nextPaymentDueAmount") ? Number(formData.get("nextPaymentDueAmount")) : null;
    const notes = formData.get("notes") ? String(formData.get("notes")).trim() : undefined;
    const submissionId = `crm_${leadId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const res = await createCrmClientDeal(leadId, {
      projectName,
      finalAmount,
      quotedAmount,
      currency,
      status,
      nextPaymentDueDate,
      nextPaymentDueAmount,
      notes,
      submissionId,
    });

    setSaving(false);
    if (res.success) {
      await loadDeals();
      setCreateDealModalOpen(false);
      // Auto-expand the newly created deal
      if (res.data?.id) {
        setExpandedDealIds(prev => new Set([...prev, res.data.id]));
      }
      if (res.undoId) {
        showUndoToast("New deal created successfully", res.undoId, () => {
          void loadDeals();
        });
      } else {
        showToast("New deal created successfully", "success");
      }
    } else {
      showToast(res.error || "Failed to create deal", "error");
    }
  };

  // Handler: Edit Deal / Project
  const handleUpdateDeal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingDeal) return;
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const projectName = formData.get("projectName") ? String(formData.get("projectName")).trim() : undefined;
    const finalAmount = Number(formData.get("finalAmount")) || 0;
    const quotedAmount = formData.get("quotedAmount") ? Number(formData.get("quotedAmount")) : null;
    const currency = String(formData.get("currency") || "INR");
    const status = String(formData.get("status") || "NEGOTIATING") as DealStatus;
    const nextPaymentDueDate = formData.get("nextPaymentDueDate") ? String(formData.get("nextPaymentDueDate")) : null;
    const nextPaymentDueAmount = formData.get("nextPaymentDueAmount") ? Number(formData.get("nextPaymentDueAmount")) : null;
    const notes = formData.get("notes") ? String(formData.get("notes")).trim() : undefined;

    const res = await upsertLeadDeal({
      dealId: editingDeal.id,
      leadId,
      projectName,
      quotedAmount,
      finalAmount,
      currency,
      status,
      nextPaymentDueDate,
      nextPaymentDueAmount,
      notes,
    });

    setSaving(false);
    if (res.success) {
      await loadDeals();
      setEditingDeal(null);
      if (res.undoId) {
        showUndoToast("Deal details updated", res.undoId, () => {
          void loadDeals();
        });
      } else {
        showToast("Deal details updated", "success");
      }
    } else {
      showToast(res.error || "Failed to update deal", "error");
    }
  };

  // Handler: Add or Update Payment
  const handleSavePayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!paymentModalDeal) return;
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
        await loadDeals();
        setPaymentModalDeal(null);
        setEditingPayment(null);
        if (res.undoId) {
          showUndoToast("Payment updated", res.undoId, () => {
            void loadDeals();
          });
        } else {
          showToast("Payment updated", "success");
        }
      } else {
        showToast(res.error || "Failed to update payment", "error");
      }
    } else {
      const res = await addDealPayment({
        dealId: paymentModalDeal.id,
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
        await loadDeals();
        setPaymentModalDeal(null);
        if (res.undoId) {
          showUndoToast("Payment recorded", res.undoId, () => {
            void loadDeals();
          });
        } else {
          showToast("Payment recorded", "success");
        }
      } else {
        showToast(res.error || "Failed to record payment", "error");
      }
    }
  };

  // Handler: Delete Payment
  const handleDeletePayment = async () => {
    if (!deletingPayment) return;
    setSaving(true);
    const res = await deleteDealPayment(deletingPayment.id);
    setSaving(false);
    if (res.success) {
      await loadDeals();
      setDeletingPayment(null);
      if (res.undoId) {
        showUndoToast("Payment removed", res.undoId, () => {
          void loadDeals();
        });
      } else {
        showToast("Payment removed", "info");
      }
    } else {
      showToast(res.error || "Failed to delete payment", "error");
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
        Loading projects and deals...
      </div>
    );
  }

  // Client aggregated metrics across all projects
  const totalContracted = deals.reduce((sum, d) => sum + d.finalAmount, 0);
  const totalReceived = deals.reduce((sum, d) => sum + d.totalReceived, 0);
  const totalOutstanding = deals.reduce((sum, d) => sum + d.remainingBalance, 0);
  const overallPercentPaid = totalContracted > 0 ? Math.min(100, Math.round((totalReceived / totalContracted) * 100)) : 0;

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

  const getDealStatusBadge = (status: DealStatus) => {
    switch (status) {
      case "COMPLETED":
        return "bg-emerald-100/70 text-emerald-800 border-emerald-200";
      case "CONFIRMED":
        return "bg-blue-100/70 text-blue-800 border-blue-200";
      case "NEGOTIATING":
        return "bg-amber-100/70 text-amber-800 border-amber-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 bg-slate-50/70 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Briefcase size={17} className="text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Projects &amp; Deals</h3>
          <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
            {deals.length} {deals.length === 1 ? "Project" : "Projects"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCreateDealModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm cursor-pointer"
        >
          <Plus size={14} />
          <span>{deals.length === 0 ? "Add Deal" : "+ Add Another Deal"}</span>
        </button>
      </div>

      {deals.length === 0 ? (
        <div className="p-8 text-center">
          <div className="mx-auto size-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
            <Briefcase size={22} />
          </div>
          <p className="text-sm font-semibold text-slate-800">No deals or projects yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            This client can have unlimited projects. Add their first project to track amounts and payment milestones.
          </p>
          <button
            type="button"
            onClick={() => setCreateDealModalOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={14} /> Create First Deal
          </button>
        </div>
      ) : (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Client Aggregated Summary Bar */}
          <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 p-3.5 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Client Financial Summary
              </span>
              <span className="text-xs font-semibold text-blue-700">
                {overallPercentPaid}% collected
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Contracted</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block truncate">
                  {formatCurrency(totalContracted)}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                <span className="text-[10px] uppercase font-bold text-emerald-600/80 block">Total Received</span>
                <span className="text-sm font-bold text-emerald-700 mt-0.5 block truncate">
                  {formatCurrency(totalReceived)}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Outstanding</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block truncate">
                  {formatCurrency(totalOutstanding)}
                </span>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="mt-2.5 h-1.5 w-full bg-slate-200/70 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  overallPercentPaid >= 100 ? "bg-emerald-500" : overallPercentPaid > 0 ? "bg-blue-600" : "bg-transparent"
                }`}
                style={{ width: `${overallPercentPaid}%` }}
              />
            </div>
          </div>

          {/* List of Projects / Deals */}
          <div className="space-y-3">
            {deals.map((d, index) => {
              const dFinal = d.finalAmount;
              const dReceived = d.totalReceived;
              const dRemaining = d.remainingBalance;
              const dPercent = dFinal > 0 ? Math.min(100, Math.round((dReceived / dFinal) * 100)) : 0;
              const isExpanded = expandedDealIds.has(d.id);
              const projectName = d.projectName?.trim() || `Project #${deals.length - index}`;

              return (
                <div 
                  key={d.id} 
                  className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs hover:border-slate-300 transition-all"
                >
                  {/* Project Header */}
                  <div className="p-3.5 sm:p-4 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {projectName}
                        </h4>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getDealStatusBadge(d.status)}`}>
                          {DEAL_STATUS_LABELS[d.status]}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadge(d.paymentStatus)}`}>
                          {d.paymentStatus === "Paid" && <CheckCircle2 size={11} />}
                          {d.paymentStatus === "Overdue" && <AlertCircle size={11} />}
                          {d.paymentStatus === "Partially Paid" && <Clock size={11} />}
                          {d.paymentStatus}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                        <span>Created {new Date(d.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</span>
                        {d.notes && (
                          <span className="truncate max-w-[200px] italic text-slate-500">· “{d.notes}”</span>
                        )}
                      </div>
                    </div>

                    {/* Project Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentModalDeal(d);
                          setEditingPayment(null);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                      >
                        <Plus size={12} /> Add Payment
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingDeal(d)}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                        title="Edit Project Details"
                        aria-label={`Edit ${projectName}`}
                      >
                        <Edit2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Project Numbers Grid */}
                  <div className="p-3.5 sm:p-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Contracted</span>
                        <span className="text-sm font-bold text-slate-900 mt-0.5 block truncate">
                          {formatCurrency(dFinal)}
                        </span>
                        {d.quotedAmount && d.quotedAmount !== dFinal && (
                          <span className="text-[9px] text-slate-400 line-through block mt-0.5">
                            Quoted: {formatCurrency(d.quotedAmount)}
                          </span>
                        )}
                      </div>

                      <div className="bg-emerald-50/40 p-2 rounded-lg border border-emerald-100/60">
                        <span className="text-[10px] uppercase font-bold text-emerald-700/70 block">Received</span>
                        <span className="text-sm font-bold text-emerald-700 mt-0.5 block truncate">
                          {formatCurrency(dReceived)}
                        </span>
                        <span className="text-[9px] text-emerald-600 font-medium block mt-0.5">
                          {dPercent}% of project
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Outstanding</span>
                        <span className="text-sm font-bold text-slate-900 mt-0.5 block truncate">
                          {formatCurrency(dRemaining)}
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">
                          {dRemaining === 0 ? "Fully cleared" : "Due"}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          dPercent >= 100 ? "bg-emerald-500" : dPercent > 0 ? "bg-blue-600" : "bg-transparent"
                        }`}
                        style={{ width: `${dPercent}%` }}
                      />
                    </div>

                    {/* Next Due Date Banner */}
                    {d.nextPaymentDueDate && dRemaining > 0 && (
                      <div className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                        d.paymentStatus === "Overdue" 
                          ? "bg-rose-50/70 border-rose-200 text-rose-800" 
                          : "bg-blue-50/60 border-blue-100 text-blue-800"
                      }`}>
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} />
                          <span>
                            Next Due: <strong>{d.nextPaymentDueDate}</strong>
                            {d.nextPaymentDueAmount ? ` · ${formatCurrency(d.nextPaymentDueAmount)}` : ""}
                          </span>
                        </div>
                        {d.paymentStatus === "Overdue" && (
                          <span className="font-bold text-[9px] uppercase tracking-wider bg-rose-200/80 px-1.5 py-0.5 rounded text-rose-900">
                            Overdue
                          </span>
                        )}
                      </div>
                    )}

                    {/* Payments Accordion Toggle */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => toggleExpand(d.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                      >
                        <span>Payment History ({d.payments.length})</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPaymentModalDeal(d);
                          setEditingPayment(null);
                        }}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={12} /> Record
                      </button>
                    </div>

                    {/* Payment History List (Expanded) */}
                    {isExpanded && (
                      <div className="pt-1">
                        {d.payments.length === 0 ? (
                          <p className="text-xs text-slate-400 py-2 italic text-center">No payment entries for this project yet.</p>
                        ) : (
                          <div className="divide-y divide-slate-100 border-t border-slate-100">
                            {d.payments.map((p) => (
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
                                      setPaymentModalDeal(d);
                                      setEditingPayment(p);
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
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: Create New Deal / Project */}
      {createDealModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Briefcase size={18} className="text-blue-600" />
                Add New Project / Deal
              </h3>
              <button
                type="button"
                onClick={() => setCreateDealModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateDeal} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Project Name *</label>
                <input
                  type="text"
                  name="projectName"
                  required
                  placeholder="e.g., Website Redesign, Catalogue Design"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Final Deal Value (₹) *</label>
                <input
                  type="number"
                  name="finalAmount"
                  step="0.01"
                  min="0"
                  required
                  placeholder="30000"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none"
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
                    placeholder="35000"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Currency</label>
                  <input
                    type="text"
                    name="currency"
                    defaultValue="INR"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status</label>
                <select
                  name="status"
                  defaultValue="CONFIRMED"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none"
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
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Due Amount (₹)</label>
                  <input
                    type="number"
                    name="nextPaymentDueAmount"
                    step="0.01"
                    min="0"
                    placeholder="10000"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Project Notes (optional)</label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Scope, deliverables, or milestone details..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateDealModalOpen(false)}
                  className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  aria-busy={saving}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {saving && <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white shrink-0" aria-hidden="true" />}
                  <span>{saving ? "Creating..." : "Create Deal"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Existing Deal */}
      {editingDeal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Edit Deal Details
              </h3>
              <button
                type="button"
                onClick={() => setEditingDeal(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateDeal} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Project Name</label>
                <input
                  type="text"
                  name="projectName"
                  defaultValue={editingDeal.projectName ?? ""}
                  placeholder="e.g., Website Redesign"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Final Deal Value (₹) *</label>
                <input
                  type="number"
                  name="finalAmount"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={editingDeal.finalAmount}
                  placeholder="30000"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none"
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
                    defaultValue={editingDeal.quotedAmount ?? ""}
                    placeholder="35000"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Currency</label>
                  <input
                    type="text"
                    name="currency"
                    defaultValue={editingDeal.currency || "INR"}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deal Status</label>
                <select
                  name="status"
                  defaultValue={editingDeal.status}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none"
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
                    defaultValue={editingDeal.nextPaymentDueDate ?? ""}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Due Amount (₹)</label>
                  <input
                    type="number"
                    name="nextPaymentDueAmount"
                    step="0.01"
                    min="0"
                    defaultValue={editingDeal.nextPaymentDueAmount ?? ""}
                    placeholder="12000"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Project Notes (optional)</label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={editingDeal.notes ?? ""}
                  placeholder="Add notes..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingDeal(null)}
                  className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  aria-busy={saving}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {saving && <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white shrink-0" aria-hidden="true" />}
                  <span>{saving ? "Saving..." : "Save Deal"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Record / Edit Payment */}
      {paymentModalDeal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard size={18} className="text-blue-600" />
                  {editingPayment ? "Edit Payment Entry" : "Record Client Payment"}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Project: <strong>{paymentModalDeal.projectName || "General Project"}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPaymentModalDeal(null);
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
                  defaultValue={editingPayment?.amount ?? (paymentModalDeal.remainingBalance > 0 ? paymentModalDeal.remainingBalance : "")}
                  placeholder="10000"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none"
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
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method *</label>
                  <select
                    name="method"
                    defaultValue={editingPayment?.method ?? "UPI"}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none"
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
                    defaultValue={editingPayment?.type ?? (paymentModalDeal.totalReceived === 0 ? "ADVANCE" : paymentModalDeal.remainingBalance <= 0 ? "FINAL" : "PARTIAL")}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none"
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
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none"
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
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <AiNoteEditor
                  name="note"
                  defaultValue={editingPayment?.note ?? ""}
                  label="Payment Note"
                  labelClassName="block font-semibold text-slate-700 mb-1"
                  rows={2}
                  placeholder="e.g. Advance received for project"
                  textareaClassName="px-3 py-2 text-base sm:text-sm resize-none"
                  compact
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentModalDeal(null);
                    setEditingPayment(null);
                  }}
                  className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  aria-busy={saving}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {saving && <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white shrink-0" aria-hidden="true" />}
                  <span>{saving ? "Saving..." : editingPayment ? "Update Payment" : "Record Payment"}</span>
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
              Project totals, received amounts, and remaining balance will be recalculated automatically.
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
                aria-busy={saving}
                onClick={handleDeletePayment}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
              >
                {saving && <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white shrink-0" aria-hidden="true" />}
                <span>{saving ? "Deleting..." : "Confirm Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
