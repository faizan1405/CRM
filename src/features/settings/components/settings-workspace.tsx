"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SettingsWorkspaceProps, SettingsTab } from "../types";
import { DemoDataControl } from "./demo-data-control";
import { NotificationsWorkspace } from "@/features/notifications";
import { SalesAssetsWorkspace } from "@/features/sales-assets/components/sales-assets-workspace";
import { GuideWorkspace } from "@/features/guide/guide-workspace";
import { RecentlyDeletedWorkspace } from "@/features/recently-deleted/recently-deleted-workspace";
import { ExportCenterWorkspace } from "@/features/export";
import { 
  markNotificationRead, 
  markNotificationResolved, 
  dismissNotification 
} from "@/app/actions/notifications";
import { PAYMENT_TERMS } from "@/lib/payment-terms";
import { 
  Server, 
  Sparkles, 
  ShieldCheck, 
  Database, 
  CheckCircle2, 
  Layers,
  Settings,
  Bell,
  Briefcase,
  BookOpen,
  Trash2,
  ChevronRight,
  FileSpreadsheet
} from "lucide-react";

export function SettingsWorkspace({
  activeTab = "general",
  initialNotifications = [],
  initialPackages = [],
  initialSamples = [],
  initialTemplates = [],
  initialDeletedLeads = [],
  initialBusinessSummary = null,
  onCreateDemoLeads,
  onClearDemoLeads,
}: SettingsWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const currentTab = (searchParams.get("tab") as SettingsTab) || activeTab;

  const [subTab, setSubTab] = useState<"workspace" | "system">("workspace");

  const handleTabChange = (tab: SettingsTab) => {
    startTransition(() => {
      router.push(`/settings?tab=${tab}`);
    });
  };

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ElementType; count?: number }> = [
    { id: "general", label: "Account / General", icon: Settings },
    { 
      id: "notifications", 
      label: "Notifications", 
      icon: Bell,
      count: initialNotifications.filter((n) => n.status === "unread").length || undefined 
    },
    { id: "sales-assets", label: "Sales Assets", icon: Briefcase },
    { id: "guide", label: "Guide", icon: BookOpen },
    { 
      id: "recently-deleted", 
      label: "Recently Deleted", 
      icon: Trash2,
      count: initialDeletedLeads.length || undefined
    },
    { id: "export-reports", label: "Export & Reports", icon: FileSpreadsheet },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-16">
      {/* Settings Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
          Settings &amp; Workspace
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Manage system preferences, notifications, sales collaterals, knowledge guide, and recovered records.
        </p>
      </div>

      {/* Main Navigation Tabs */}
      <div className="overflow-x-auto pb-1 scrollbar-none">
        <nav aria-label="Settings tabs" className="flex items-center gap-1 border-b border-slate-200 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                }`}
              >
                <Icon size={16} className={isActive ? "text-blue-600" : "text-slate-400"} />
                {tab.label}
                {typeof tab.count === "number" && tab.count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* TAB CONTENT: General / Account */}
      {currentTab === "general" && (
        <div className="space-y-6">
          {/* Quick Hub Cards */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Secondary Hubs &amp; Tools
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
              <button
                type="button"
                onClick={() => handleTabChange("notifications")}
                className="flex flex-col text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                    <Bell size={18} />
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-900">Notifications</h3>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                  Sales alerts, follow-up reminders, and AI smart attention feeds.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange("sales-assets")}
                className="flex flex-col text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                    <Briefcase size={18} />
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-900">Sales Assets</h3>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                  Website packages, live client demos, and WhatsApp response scripts.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange("guide")}
                className="flex flex-col text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                    <BookOpen size={18} />
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-purple-600 transition-colors" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-900">CRM Guide</h3>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                  Complete documentation for pipeline workflows, status rules, and tips.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange("recently-deleted")}
                className="flex flex-col text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                    <Trash2 size={18} />
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-rose-600 transition-colors" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-900">Recently Deleted</h3>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                  Inspect soft-deleted leads with one-click restore or permanent delete.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange("export-reports")}
                className="flex flex-col text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                    <FileSpreadsheet size={18} />
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-900">Export &amp; Reports</h3>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                  Download CSV / Excel backups of leads, deals, payments, and summary.
                </p>
              </button>
            </div>
          </div>

          {/* Sub-tabs for Account / System Settings */}
          <div className="flex items-center gap-2 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setSubTab("workspace")}
              className={`px-3 py-2 text-xs sm:text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
                subTab === "workspace"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Workspace Data &amp; Tools
            </button>
            <button
              type="button"
              onClick={() => setSubTab("system")}
              className={`px-3 py-2 text-xs sm:text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
                subTab === "system"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              System Architecture
            </button>
          </div>

          {subTab === "workspace" && (
            <div className="space-y-6">
              <DemoDataControl 
                onCreateDemoLeads={onCreateDemoLeads} 
                onClearDemoLeads={onClearDemoLeads} 
              />

              {/* Core Feature Status */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-600" />
                  Active Subsystems &amp; Services
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Overview of all operational modules across the CRM lifecycle.
                </p>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-medium text-slate-700">Lead Pipeline &amp; Funnel Tracking</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Active
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-medium text-slate-700">Deals &amp; Payment Tracker</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Operational
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-medium text-slate-700">AI Scoring &amp; Qualification</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Operational
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-medium text-slate-700">Daily Sales Briefing Engine</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Operational
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-medium text-slate-700">Loss Reason &amp; Win/Loss Analytics</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Operational
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-medium text-slate-700">Attention Signals &amp; Stale Alerts</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Operational
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <div>
                      <span className="font-medium text-slate-700">Commercial Payment Terms</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {PAYMENT_TERMS.advancePercent}% advance / {PAYMENT_TERMS.finalPercent}% {PAYMENT_TERMS.finalTiming}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Canonical
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {subTab === "system" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Server className="h-4 w-4 text-slate-700" />
                  Cloud Infrastructure
                </h3>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
                    <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
                      <Database className="h-4 w-4 text-emerald-600" />
                      Neon Serverless PostgreSQL
                    </div>
                    <p className="text-xs text-slate-500">
                      High-availability cloud Postgres with automated connection pooling and schema migrations.
                    </p>
                    <div className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded inline-block">
                      Status: Connected &amp; Synced
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
                    <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      Groq AI Inference
                    </div>
                    <p className="text-xs text-slate-500">
                      Ultra-low latency LLM inference powering AI Lead Scoring, Daily Briefings, and Note transformations.
                    </p>
                    <div className="text-[11px] font-mono text-purple-700 bg-purple-50 px-2 py-1 rounded inline-block">
                      Model: openai/gpt-oss-120b
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
                    <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
                      <ShieldCheck className="h-4 w-4 text-blue-600" />
                      Security &amp; Auth Isolation
                    </div>
                    <p className="text-xs text-slate-500">
                      Next.js server-side session guards, HMAC signature verification, and complete workspace multi-tenancy.
                    </p>
                    <div className="text-[11px] font-mono text-blue-700 bg-blue-50 px-2 py-1 rounded inline-block">
                      Policy: Enterprise Isolated
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: Notifications */}
      {currentTab === "notifications" && (
        <div className="space-y-4">
          <NotificationsWorkspace 
            initialNotifications={initialNotifications}
            onMarkRead={async (id) => {
              const res = await markNotificationRead(id);
              if (!res.success) throw new Error(res.error);
            }}
            onMarkDone={async (id) => {
              const res = await markNotificationResolved(id);
              if (!res.success) throw new Error(res.error);
            }}
            onDismiss={async (id) => {
              const res = await dismissNotification(id);
              if (!res.success) throw new Error(res.error);
            }}
          />
        </div>
      )}

      {/* TAB CONTENT: Sales Assets */}
      {currentTab === "sales-assets" && (
        <div className="space-y-4">
          <SalesAssetsWorkspace 
            initialPackages={initialPackages}
            initialSamples={initialSamples}
            initialTemplates={initialTemplates as unknown as import("@prisma/client").WhatsAppTemplate[]}
          />
        </div>
      )}

      {/* TAB CONTENT: Guide */}
      {currentTab === "guide" && (
        <div className="space-y-4">
          <GuideWorkspace />
        </div>
      )}

      {/* TAB CONTENT: Recently Deleted */}
      {currentTab === "recently-deleted" && (
        <div className="space-y-4">
          <RecentlyDeletedWorkspace initialLeads={initialDeletedLeads} />
        </div>
      )}

      {/* TAB CONTENT: Export & Reports */}
      {currentTab === "export-reports" && (
        <div className="space-y-4">
          <ExportCenterWorkspace initialSummary={initialBusinessSummary} />
        </div>
      )}
    </div>
  );
}

