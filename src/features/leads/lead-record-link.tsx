"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useLeadNavigation } from "./lead-navigation-provider";

export function LeadRecordLink({ leadId, action = null, children, className, label, title }: { leadId: string; action?: "activity" | "followups" | null; children: ReactNode; className?: string; label: string; title?: string }) {
  const navigation = useLeadNavigation();
  return <Link title={title} href={`/leads?selected=${encodeURIComponent(leadId)}${action ? `&action=${action}` : ""}`} aria-label={label} className={className} onNavigate={event => {
    if (!navigation) return;
    event.preventDefault();
    navigation.openLead(leadId, action);
  }}>{children}</Link>;
}

export function ScheduleFollowUpButton({ leadId, leadName }: { leadId: string; leadName: string }) {
  const navigation = useLeadNavigation();
  return <button type="button" disabled={!navigation || !leadId} onClick={() => navigation?.openFollowUp({ id: leadId, name: leadName })} aria-label={`Add follow-up for ${leadName}`} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-amber-50 focus-visible:ring-2 focus-visible:ring-blue-600">Add Follow-up</button>;
}
