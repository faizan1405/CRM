import type { Metadata } from "next";
import { UsersRound } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Leads" };

export default function LeadsPage() {
  return <PlaceholderPage title="Leads" description="Manage prospects and client opportunities in one place." message="Lead management will be added in the next phase." icon={UsersRound} />;
}
