import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <PlaceholderPage title="Settings" description="Configure your Scale Flow CRM workspace." message="CRM settings will appear here." icon={Settings} />;
}
