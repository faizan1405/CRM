import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getLeads } from "@/app/actions/leads";
import { LeadsWorkspace } from "@/features/leads/leads-workspace";
import { LeadsSkeleton } from "@/components/skeletons";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage() {
  const result = await getLeads();
  if (!result.success && result.error.includes("signed in")) redirect("/login");
  return (
    <Suspense fallback={<LeadsSkeleton />}>
      <LeadsWorkspace initialLeads={result.success ? result.data : []} initialError={result.success ? null : result.error} />
    </Suspense>
  );
}
