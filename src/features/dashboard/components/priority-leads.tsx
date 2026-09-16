"use client";

import { useState } from "react";

import { ActionCard } from "@/components/action-card";
import { LeadRecordLink, ScheduleFollowUpButton } from "@/features/leads/lead-record-link";
import { getTelephoneHref, getWhatsAppHref } from "@/features/leads/contact-links";
import { Phone, MessageCircle } from "lucide-react";
import { loadPriorityPage } from "../priority-page";

export type PriorityLead = { leadId: string; leadName: string; business?: string; phone?: string; reason: string; stage?: string };
export type PriorityLeadPage = { items: PriorityLead[]; nextCursor: string | null };
export type LoadPriorityPage = (input: { cursor: string | null; limit: 10 }) => Promise<PriorityLeadPage>;

/** Agent A supplies bounded pages; never fetch the entire lead collection. */
export function PriorityLeads({ initialPage, loadPage = loadPriorityPage }: { initialPage: PriorityLeadPage; loadPage?: LoadPriorityPage }) {
  const [items, setItems] = useState(() => initialPage.items.slice(0, 10));
  const [cursor, setCursor] = useState(initialPage.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function loadMore() {
    if (loading || !loadPage || !cursor) return;
    setLoading(true); setError("");
    try {
      const page = await loadPage({ cursor, limit: 10 });
      setItems(current => {
        const seen = new Set(current.map(item => item.leadId));
        return [...current, ...page.items.slice(0, 10).filter(item => { if (seen.has(item.leadId)) return false; seen.add(item.leadId); return true; })];
      });
      setCursor(page.nextCursor);
    } catch { setError("Could not load more priority leads. Please retry."); }
    finally { setLoading(false); }
  }
  return <section aria-labelledby="priority-leads-heading" className="min-w-0 space-y-3">
    <h2 id="priority-leads-heading" className="text-lg font-bold text-slate-900">Priority Leads</h2>
    <div className="grid min-w-0 gap-3 md:grid-cols-2">
      {items.map(item => <ActionCard key={item.leadId} href={`/leads?selected=${encodeURIComponent(item.leadId)}`} aria-label={`Open lead ${item.leadName}`} className="min-w-0 rounded-xl border bg-white p-4 transition-colors duration-150 hover:border-blue-300">
        <h3 className="break-words text-sm font-semibold">{item.leadName}</h3>
        <p className="mt-1 break-words text-xs text-slate-500">{[item.business, item.stage].filter(Boolean).join(" Â· ")}</p>
        <p className="mt-2 break-words text-sm text-slate-700">{item.reason}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {item.phone && <><a href={getTelephoneHref(item.phone)} aria-label={`Call ${item.leadName}`} className="grid size-11 place-items-center rounded-lg border hover:bg-blue-50"><Phone size={16} /></a><a href={getWhatsAppHref(item.phone, item.leadName)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${item.leadName}`} className="grid size-11 place-items-center rounded-lg border hover:bg-emerald-50"><MessageCircle size={16} /></a></>}
          <ScheduleFollowUpButton leadId={item.leadId} leadName={item.leadName} />
          <LeadRecordLink leadId={item.leadId} label={`Review ${item.leadName}`} className="inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50">Review</LeadRecordLink>
        </div>
      </ActionCard>)}
    </div>
    {!items.length && <p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">No priority leads to show.</p>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    <button type="button" onClick={() => void loadMore()} disabled={loading || !cursor} className="min-h-11 rounded-lg border bg-white px-4 text-sm font-semibold hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50">{loading ? "Loading..." : cursor ? "Load 10 More" : "No more leads"}</button>
  </section>;
}

