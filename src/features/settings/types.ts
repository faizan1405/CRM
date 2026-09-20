import type { SmartNotification } from "@/features/notifications/types";
import type { WebsitePackage, WebsiteSample } from "@prisma/client";
import type { WhatsAppTemplate } from "@/features/whatsapp-templates/types";
import type { RecentlyDeletedLead } from "@/features/recently-deleted/recently-deleted-workspace";

import type { BusinessSummaryData } from "@/lib/export/types";

export type SettingsTab = "general" | "notifications" | "sales-assets" | "guide" | "recently-deleted" | "export-reports";

export interface SettingsWorkspaceProps {
  activeTab?: SettingsTab;
  initialNotifications?: SmartNotification[];
  initialPackages?: WebsitePackage[];
  initialSamples?: WebsiteSample[];
  initialTemplates?: WhatsAppTemplate[];
  initialDeletedLeads?: RecentlyDeletedLead[];
  initialBusinessSummary?: BusinessSummaryData | null;
  onCreateDemoLeads?: () => Promise<{ success: boolean; message?: string; count?: number }> | { success: boolean; message?: string; count?: number } | void;
  onClearDemoLeads?: () => Promise<{ success: boolean; message?: string; count?: number }> | { success: boolean; message?: string; count?: number } | void;
}


