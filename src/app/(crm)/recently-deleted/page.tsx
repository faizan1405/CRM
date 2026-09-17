import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getRecentlyDeletedLeads } from "@/app/actions/leads";
import { RecentlyDeletedWorkspace } from "@/features/recently-deleted/recently-deleted-workspace";

export const metadata: Metadata = {
  title: "Recently Deleted | CRM",
  description: "View and recover soft-deleted leads or permanently delete them.",
};

export const dynamic = "force-dynamic";

export default async function RecentlyDeletedPage() {
  const result = await getRecentlyDeletedLeads();

  if (!result.success && result.error.includes("signed in")) {
    redirect("/login");
  }

  const initialLeads = result.success && result.data ? result.data : [];

  return <RecentlyDeletedWorkspace initialLeads={initialLeads} />;
}
