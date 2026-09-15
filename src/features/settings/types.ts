export type MetaConnectionStatus = "connected" | "not_connected" | "needs_attention";

export interface MetaSyncInfo {
  status: MetaConnectionStatus;
  pageName?: string;
  adAccountId?: string;
  lastSuccessfulSync?: string | null;
  lastSyncFailure?: string | null;
  recentLeadsProcessed?: number;
  connectedAt?: string | null;
}

export interface SettingsWorkspaceProps {
  initialMetaInfo?: MetaSyncInfo;
  onConnectMeta?: () => Promise<void> | void;
  onReconnectMeta?: () => Promise<void> | void;
  onTestConnection?: () => Promise<{ success: boolean; message?: string }> | { success: boolean; message?: string } | void;
  onCreateDemoLeads?: () => Promise<{ success: boolean; message?: string }> | { success: boolean; message?: string } | void;
}
