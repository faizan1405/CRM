import type { Metadata } from "next";
import { SettingsWorkspace } from "@/features/settings";
import { getNotifications } from "@/app/actions/notifications";
import { getWebsitePackages, getWebsiteSamples } from "@/app/actions/sales-assets";
import { getWhatsAppTemplates } from "@/app/actions/whatsapp-templates";
import { getRecentlyDeletedLeads } from "@/app/actions/leads";
import type { SettingsTab } from "@/features/settings/types";

export const metadata: Metadata = {
  title: "Settings & Workspace | CRM",
  description: "Manage CRM workspace settings, notifications, sales assets, reference guide, and recently deleted leads.",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab = (params?.tab as SettingsTab) || "general";

  // Fetch relevant data based on tab or for quick hub overview
  const [notificationsRes, packagesRes, samplesRes, templatesRes, deletedRes] = await Promise.all([
    tab === "notifications" || tab === "general" ? getNotifications() : Promise.resolve({ success: true, data: [] }),
    tab === "sales-assets" ? getWebsitePackages() : Promise.resolve({ success: true, data: [] }),
    tab === "sales-assets" ? getWebsiteSamples() : Promise.resolve({ success: true, data: [] }),
    tab === "sales-assets" ? getWhatsAppTemplates() : Promise.resolve({ success: true, data: [] }),
    tab === "recently-deleted" || tab === "general" ? getRecentlyDeletedLeads() : Promise.resolve({ success: true, data: [] }),
  ]);

  return (
    <SettingsWorkspace
      activeTab={tab}
      initialNotifications={notificationsRes.success ? notificationsRes.data : []}
      initialPackages={packagesRes.success ? packagesRes.data : []}
      initialSamples={samplesRes.success ? samplesRes.data : []}
      initialTemplates={templatesRes.success ? templatesRes.data : []}
      initialDeletedLeads={deletedRes.success && deletedRes.data ? deletedRes.data : []}
    />
  );
}

