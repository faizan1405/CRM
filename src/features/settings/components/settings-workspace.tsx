"use client";

import { useState } from "react";
import type { SettingsWorkspaceProps } from "../types";
import { DemoDataControl } from "./demo-data-control";
import { 
  Server, 
  Sparkles, 
  ShieldCheck, 
  Database, 
  CheckCircle2, 
  Layers
} from "lucide-react";

export function SettingsWorkspace({
  onCreateDemoLeads,
  onClearDemoLeads,
}: SettingsWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"workspace" | "system">("workspace");

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-16">
      {/* Settings Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
          Settings &amp; Workspace Controls
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Manage CRM workspace settings, system service telemetry, and demo testing pipelines.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("workspace")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            activeTab === "workspace"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Workspace Data &amp; Tools
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("system")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            activeTab === "system"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          System Architecture
        </button>
      </div>

      {activeTab === "workspace" && (
        <div className="space-y-6">
          {/* Demo Leads Control */}
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
              Overview of all operational modules across the 10 CRM lifecycle phases.
            </p>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                <span className="font-medium text-slate-700">Lead Pipeline &amp; Funnel Tracking</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Active
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
                <span className="font-medium text-slate-700">Personal Notes &amp; AI Writing Suite</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Operational
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "system" && (
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
                  Groq Llama 3 Inference
                </div>
                <p className="text-xs text-slate-500">
                  Ultra-low latency LLM inference powering AI Lead Scoring, Daily Briefings, and Note transformations.
                </p>
                <div className="text-[11px] font-mono text-purple-700 bg-purple-50 px-2 py-1 rounded inline-block">
                  Model: llama-3.3-70b-versatile
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
  );
}
