export interface SettingsWorkspaceProps {
  onCreateDemoLeads?: () => Promise<{ success: boolean; message?: string; count?: number }> | { success: boolean; message?: string; count?: number } | void;
  onClearDemoLeads?: () => Promise<{ success: boolean; message?: string; count?: number }> | { success: boolean; message?: string; count?: number } | void;
}
