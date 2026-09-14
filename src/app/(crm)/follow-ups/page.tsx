import type { Metadata } from "next";
import { getFollowUps } from "@/app/actions/follow-ups";
import { getLeads } from "@/app/actions/leads";
import { FollowUpsWorkspace } from "@/features/followups/follow-ups-workspace";

export const metadata: Metadata = { title: "Follow-ups" };

export default async function FollowUpsPage() {
  const [followUpsRes, leadsRes] = await Promise.all([
    getFollowUps(),
    getLeads()
  ]);

  const followUps = followUpsRes.success ? [
    ...followUpsRes.data.overdue,
    ...followUpsRes.data.today,
    ...followUpsRes.data.upcoming,
    ...followUpsRes.data.completed
  ] : [];

  const leads = leadsRes.success ? leadsRes.data : [];

  return (
    <div className="flex h-full flex-col">
      <FollowUpsWorkspace initialFollowUps={followUps} leads={leads} />
    </div>
  );
}
