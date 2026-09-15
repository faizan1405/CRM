"use client";

import type { SettingsWorkspaceProps, MetaSyncInfo } from "../types";
import { MetaConnectionSection } from "./meta-connection-section";
import { MetaAutomationCard } from "./meta-automation-card";
import { DemoDataControl } from "./demo-data-control";

const DEFAULT_META_INFO: MetaSyncInfo = {
  status: "connected",
  pageName: "Scale Flow Facebook Page",
  lastSuccessfulSync: "Active (Webhook Ready)",
  lastSyncFailure: null,
  recentLeadsProcessed: 0,
};

export function SettingsWorkspace({
  initialMetaInfo = DEFAULT_META_INFO,
  onConnectMeta,
  onReconnectMeta,
  onTestConnection,
  onCreateDemoLeads,
}: SettingsWorkspaceProps) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-16">
      {/* Settings Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
          Settings &amp; Integrations
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Manage Meta Lead Ads connection status, automated ingestion pipelines, and workspace controls.
        </p>
      </div>

      {/* Meta Connection Section */}
      <MetaConnectionSection
        metaInfo={initialMetaInfo}
        onConnectMeta={onConnectMeta}
        onReconnectMeta={onReconnectMeta}
        onTestConnection={onTestConnection}
      />

      {/* Meta Automation Pipeline Explanation */}
      <MetaAutomationCard />

      {/* Demo Leads Control */}
      <DemoDataControl onCreateDemoLeads={onCreateDemoLeads} />
    </div>
  );
}
