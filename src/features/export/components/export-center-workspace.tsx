"use client";

import { useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  Download,
  ShieldCheck,
  TrendingUp,
  Users,
  Briefcase,
  CreditCard,
  AlertCircle,
  CalendarCheck,
  Clock,
  Sparkles,
  CheckCircle2,
  Lock,
} from "lucide-react";
import type { BusinessSummaryData } from "@/lib/export/types";
import { generateExportFilename, formatCurrencyINR, getTodayISTDateString } from "@/lib/export/formatters";

interface ExportCenterWorkspaceProps {
  initialSummary?: BusinessSummaryData | null;
}

export function ExportCenterWorkspace({ initialSummary }: ExportCenterWorkspaceProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [summaryPeriod, setSummaryPeriod] = useState<"all_time" | "this_month">("all_time");
  const [summaryData] = useState<BusinessSummaryData>(
    initialSummary || {
      period: "all_time",
      periodLabel: "All Time",
      totalLeads: 0,
      qualifiedLeads: 0,
      wonDeals: 0,
      totalDealValue: 0,
      paymentsReceived: 0,
      outstanding: 0,
      overdue: 0,
      followUpsDue: 0,
      staleLeads: 0,
    }
  );

  const todayStr = getTodayISTDateString();

  const handleDownload = (target: string, format: "csv" | "xlsx", period?: string) => {
    const downloadKey = `${target}-${format}`;
    setDownloadingId(downloadKey);

    const url = new URL("/api/export", window.location.origin);
    url.searchParams.set("type", target);
    url.searchParams.set("format", format);
    if (period) {
      url.searchParams.set("period", period);
    }

    // Trigger browser download cleanly
    const a = document.createElement("a");
    a.href = url.toString();
    a.download = generateExportFilename(target, format);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      setDownloadingId(null);
    }, 1200);
  };

  const exportOptions = [
    {
      id: "leads",
      title: "Leads Export",
      description: "Name, phone, status, budget/quoted value, last activity, pinned & stale states.",
      icon: Users,
      badge: "Pipeline",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      filenamePreview: (fmt: "csv" | "xlsx") => `scale-flow-leads-${todayStr}.${fmt}`,
    },
    {
      id: "deals",
      title: "Deals Export",
      description: "CRM vs Other clients, final value, total received, remaining, and payment status.",
      icon: Briefcase,
      badge: "Commercial",
      badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
      filenamePreview: (fmt: "csv" | "xlsx") => `scale-flow-deals-${todayStr}.${fmt}`,
    },
    {
      id: "payments",
      title: "Payments Export",
      description: "Granular payment records, payment method, dates, and reference numbers.",
      icon: CreditCard,
      badge: "Financial",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      filenamePreview: (fmt: "csv" | "xlsx") => `scale-flow-payments-${todayStr}.${fmt}`,
    },
    {
      id: "outstanding",
      title: "Outstanding Balances",
      description: "Deals with remaining > 0, next due dates, next due amounts, and days overdue.",
      icon: AlertCircle,
      badge: "Collections",
      badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
      filenamePreview: (fmt: "csv" | "xlsx") => `scale-flow-outstanding-balances-${todayStr}.${fmt}`,
    },
    {
      id: "followups",
      title: "Follow-ups Export",
      description: "Canonical active follow-ups categorized into Today, Upcoming, and Overdue.",
      icon: CalendarCheck,
      badge: "Operational",
      badgeColor: "bg-sky-50 text-sky-700 border-sky-200",
      filenamePreview: (fmt: "csv" | "xlsx") => `scale-flow-follow-ups-${todayStr}.${fmt}`,
    },
    {
      id: "business-summary",
      title: "Business Summary",
      description: "High-level management briefing with total revenue, collections, leads, and overdue.",
      icon: TrendingUp,
      badge: "Executive",
      badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
      filenamePreview: (fmt: "csv" | "xlsx") => `scale-flow-business-summary-${todayStr}.${fmt}`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Backup Safety Notice */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <FileSpreadsheet className="h-5 w-5" />
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                Export &amp; Business Reports Center
              </h2>
            </div>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-500 max-w-2xl">
              Safely backup and download your CRM records into standardized CSV and Excel spreadsheets.
              Files are generated dynamically in-memory with verified canonical numbers.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto rounded-lg bg-emerald-50 px-3 py-2 border border-emerald-200 text-xs font-medium text-emerald-800">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Read-Only &bull; Zero DB Mutation</span>
          </div>
        </div>

        {/* Security / Safe Backup Guarantee Card */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>Auth secrets &amp; passwords excluded</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>Clean numeric amounts for Excel</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <span>IST (Asia/Kolkata) formatted dates</span>
          </div>
        </div>
      </div>

      {/* Business Summary Live Preview Panel */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Canonical Business Summary
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live executive metrics computed directly from primary CRM tables.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleDownload("business-summary", "csv", summaryPeriod)}
                disabled={downloadingId === "business-summary-csv"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
              >
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                <span>CSV</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownload("business-summary", "xlsx", summaryPeriod)}
                disabled={downloadingId === "business-summary-xlsx"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Excel (.xlsx)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Metric Badges Grid */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">Total Leads</span>
            <p className="text-base font-bold text-slate-900 mt-0.5">{summaryData.totalLeads}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">Qualified Leads</span>
            <p className="text-base font-bold text-blue-600 mt-0.5">{summaryData.qualifiedLeads}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">Won Deals</span>
            <p className="text-base font-bold text-emerald-600 mt-0.5">{summaryData.wonDeals}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">Total Deal Value</span>
            <p className="text-base font-bold text-slate-900 mt-0.5">{formatCurrencyINR(summaryData.totalDealValue)}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">Payments Received</span>
            <p className="text-base font-bold text-emerald-600 mt-0.5">{formatCurrencyINR(summaryData.paymentsReceived)}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">Outstanding</span>
            <p className="text-base font-bold text-amber-600 mt-0.5">{formatCurrencyINR(summaryData.outstanding)}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">Overdue Balance</span>
            <p className="text-base font-bold text-rose-600 mt-0.5">{formatCurrencyINR(summaryData.overdue)}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">Follow-ups Due</span>
            <p className="text-base font-bold text-sky-600 mt-0.5">{summaryData.followUpsDue}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 col-span-2 sm:col-span-1">
            <span className="text-[11px] font-medium text-slate-500">Stale Leads</span>
            <p className="text-base font-bold text-slate-700 mt-0.5">{summaryData.staleLeads}</p>
          </div>
        </div>
      </div>

      {/* Main Export Cards Grid */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          Available Data Exports
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {exportOptions.map((opt) => {
            const Icon = opt.icon;
            const isCsvDownloading = downloadingId === `${opt.id}-csv`;
            const isXlsxDownloading = downloadingId === `${opt.id}-xlsx`;

            return (
              <div
                key={opt.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                        <Icon size={18} />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{opt.title}</h4>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${opt.badgeColor}`}>
                      {opt.badge}
                    </span>
                  </div>

                  <p className="mt-3 text-xs text-slate-500 leading-relaxed min-h-9">
                    {opt.description}
                  </p>
                </div>

                <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2.5">
                  {/* File name preview */}
                  <div className="text-[11px] font-mono text-slate-400 truncate">
                    📁 {opt.filenamePreview("xlsx")}
                  </div>

                  {/* Low-click format download actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownload(opt.id, "csv")}
                      disabled={isCsvDownloading || isXlsxDownloading}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <FileText size={14} className="text-slate-500" />
                      <span>{isCsvDownloading ? "Exporting..." : "CSV"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownload(opt.id, "xlsx")}
                      disabled={isCsvDownloading || isXlsxDownloading}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <Download size={14} />
                      <span>{isXlsxDownloading ? "Generating..." : "Excel"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
