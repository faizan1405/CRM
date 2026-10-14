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
import { PageHeader, Card } from "@/components/crm/primitives";
import { cn } from "@/lib/utils";
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
      <PageHeader
        title="Settings & Workspace"
        description="Manage system preferences, notifications, sales collaterals, knowledge guide, and recovered records."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        {/* Navigation Sidebar */}
        <nav aria-label="Settings tabs" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 md:flex-col md:overflow-visible scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "press flex h-10 shrink-0 items-center justify-between rounded-lg px-3 text-[13px] font-medium transition-all duration-200 cursor-pointer",
                  isActive
                    ? "bg-card text-foreground shadow-[var(--shadow-card)] font-semibold border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon size={16} className={isActive ? "text-primary" : "text-muted-foreground"} strokeWidth={1.8} />
                  <span className="truncate">{tab.label}</span>
                </div>
                {typeof tab.count === "number" && tab.count > 0 && (
                  <span className={cn(
                    "ml-2 rounded-full px-1.5 py-0.2 text-[10.5px] font-bold tabular",
                    isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Tab Content Panel */}
        <div className="min-w-0 space-y-6">
          {/* TAB CONTENT: General / Account */}
          {currentTab === "general" && (
            <div className="space-y-6">
              {/* Quick Hub Cards */}
              <div>
                <div className="eyebrow mb-3">Secondary Hubs &amp; Tools</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
                  <button
                    type="button"
                    onClick={() => handleTabChange("notifications")}
                    className="card-surface card-hover flex flex-col text-left p-4 rounded-xl group cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Bell size={18} strokeWidth={1.8} />
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <h3 className="mt-3 text-[13.5px] font-semibold text-foreground">Notifications</h3>
                    <p className="mt-1 text-[12px] text-muted-foreground line-clamp-2">
                      Sales alerts, follow-up reminders, and AI smart attention feeds.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabChange("sales-assets")}
                    className="card-surface card-hover flex flex-col text-left p-4 rounded-xl group cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Briefcase size={18} strokeWidth={1.8} />
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground group-hover:text-emerald-600 transition-colors" />
                    </div>
                    <h3 className="mt-3 text-[13.5px] font-semibold text-foreground">Sales Assets</h3>
                    <p className="mt-1 text-[12px] text-muted-foreground line-clamp-2">
                      Website packages, live client demos, and WhatsApp response scripts.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabChange("guide")}
                    className="card-surface card-hover flex flex-col text-left p-4 rounded-xl group cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        <BookOpen size={18} strokeWidth={1.8} />
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground group-hover:text-purple-600 transition-colors" />
                    </div>
                    <h3 className="mt-3 text-[13.5px] font-semibold text-foreground">CRM Guide</h3>
                    <p className="mt-1 text-[12px] text-muted-foreground line-clamp-2">
                      Complete documentation for pipeline workflows, status rules, and tips.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabChange("recently-deleted")}
                    className="card-surface card-hover flex flex-col text-left p-4 rounded-xl group cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                        <Trash2 size={18} strokeWidth={1.8} />
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground group-hover:text-rose-600 transition-colors" />
                    </div>
                    <h3 className="mt-3 text-[13.5px] font-semibold text-foreground">Recently Deleted</h3>
                    <p className="mt-1 text-[12px] text-muted-foreground line-clamp-2">
                      Inspect soft-deleted leads with one-click restore or permanent delete.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabChange("export-reports")}
                    className="card-surface card-hover flex flex-col text-left p-4 rounded-xl group cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        <FileSpreadsheet size={18} strokeWidth={1.8} />
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground group-hover:text-indigo-600 transition-colors" />
                    </div>
                    <h3 className="mt-3 text-[13.5px] font-semibold text-foreground">Export &amp; Reports</h3>
                    <p className="mt-1 text-[12px] text-muted-foreground line-clamp-2">
                      Download CSV / Excel backups of leads, deals, payments, and summary.
                    </p>
                  </button>
                </div>
              </div>

              {/* Sub-tabs for Account / System Settings */}
              <div className="inline-flex rounded-lg border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setSubTab("workspace")}
                  className={cn(
                    "press rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition-all duration-200 cursor-pointer",
                    subTab === "workspace"
                      ? "bg-card text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Workspace Data &amp; Tools
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab("system")}
                  className={cn(
                    "press rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition-all duration-200 cursor-pointer",
                    subTab === "system"
                      ? "bg-card text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
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
                  <Card className="p-5 sm:p-6">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Layers className="h-4 w-4" strokeWidth={1.8} />
                      </div>
                      <div>
                        <h3 className="text-[14px] font-semibold text-foreground">
                          Active Subsystems &amp; Services
                        </h3>
                        <p className="text-[12px] text-muted-foreground">
                          Overview of all operational modules across the CRM lifecycle.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                        <span className="font-medium text-foreground">Lead Pipeline &amp; Funnel Tracking</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Active
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                        <span className="font-medium text-foreground">Deals &amp; Payment Tracker</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Operational
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                        <span className="font-medium text-foreground">AI Scoring &amp; Qualification</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Operational
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                        <span className="font-medium text-foreground">Daily Sales Briefing Engine</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Operational
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                        <span className="font-medium text-foreground">Loss Reason &amp; Win/Loss Analytics</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Operational
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                        <span className="font-medium text-foreground">Attention Signals &amp; Stale Alerts</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Operational
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 md:col-span-2">
                        <div>
                          <span className="font-medium text-foreground">Commercial Payment Terms</span>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {PAYMENT_TERMS.advancePercent}% advance / {PAYMENT_TERMS.finalPercent}% {PAYMENT_TERMS.finalTiming}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Canonical
                        </span>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {subTab === "system" && (
                <div className="space-y-6">
                  <Card className="p-5 sm:p-6">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Server className="h-4 w-4" strokeWidth={1.8} />
                      </div>
                      <div>
                        <h3 className="text-[14px] font-semibold text-foreground">Cloud Infrastructure</h3>
                        <p className="text-[12px] text-muted-foreground">Core hosting and runtime services powering the CRM platform.</p>
                      </div>
                    </div>
                    <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                        <div className="flex items-center gap-2 text-foreground font-semibold text-[13.5px]">
                          <Database className="h-4 w-4 text-emerald-600" />
                          Neon Serverless PostgreSQL
                        </div>
                        <p className="text-[12px] text-muted-foreground">
                          High-availability cloud Postgres with automated connection pooling and schema migrations.
                        </p>
                        <div className="text-[11px] font-mono text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded inline-block">
                          Status: Connected &amp; Synced
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                        <div className="flex items-center gap-2 text-foreground font-semibold text-[13.5px]">
                          <Sparkles className="h-4 w-4 text-purple-600" />
                          Groq AI Inference
                        </div>
                        <p className="text-[12px] text-muted-foreground">
                          Ultra-low latency LLM inference powering AI Lead Scoring, Daily Briefings, and Note transformations.
                        </p>
                        <div className="text-[11px] font-mono text-purple-700 bg-purple-500/10 px-2 py-0.5 rounded inline-block">
                          Model: openai/gpt-oss-120b
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                        <div className="flex items-center gap-2 text-foreground font-semibold text-[13.5px]">
                          <ShieldCheck className="h-4 w-4 text-primary" />
                          Security &amp; Auth Isolation
                        </div>
                        <p className="text-[12px] text-muted-foreground">
                          Next.js server-side session guards, HMAC signature verification, and complete workspace multi-tenancy.
                        </p>
                        <div className="text-[11px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded inline-block">
                          Policy: Enterprise Isolated
                        </div>
                      </div>
                    </div>
                  </Card>
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
      </div>
    </div>
  );
}
