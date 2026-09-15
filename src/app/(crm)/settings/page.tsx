import type { Metadata } from "next";
import { SettingsWorkspace } from "@/features/settings";

export const metadata: Metadata = {
  title: "Settings & Workspace | CRM",
  description: "Manage CRM workspace settings, system services, and demo data controls.",
};

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return <SettingsWorkspace />;
}
