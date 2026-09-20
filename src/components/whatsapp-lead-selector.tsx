"use client";

import { useState, useEffect } from "react";
import { Search, X, User } from "lucide-react";
import { searchLeadsForWhatsApp } from "@/app/actions/lead-search";
import { LeadStatusBadge } from "@/features/leads/lead-status-badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";

import type { LeadStatus } from "@/features/leads/types";

type CompactLead = {
  id: string;
  name: string;
  phone: string;
  status: LeadStatus;
  business: string | null;
};

export function WhatsAppLeadSelector({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSelect: (lead: any) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompactLead[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || query.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    
    const handler = setTimeout(async () => {
      setLoading(true);
      const res = await searchLeadsForWhatsApp(query);
      if (res.success && res.data) {
        setResults(res.data);
      }
      setLoading(false);
    }, 300);

    return () => clearTimeout(handler);
  }, [query, isOpen]);

  if (!isOpen) return null;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Select Lead"
    >
      <div className="flex items-center border-b border-slate-100 pb-2 mb-2">
        <Search size={18} className="text-slate-400 ml-1" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search lead by name or phone..."
          className="flex-1 bg-transparent px-3 py-2 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          autoFocus
        />
      </div>
      
      <div className="max-h-[60vh] overflow-y-auto pb-4 space-y-1">
        {loading && <div className="p-4 text-center text-[13px] text-slate-500">Searching...</div>}
        {!loading && query.trim().length > 0 && query.trim().length < 2 && (
          <div className="p-4 text-center text-[13px] text-slate-500">Type at least 2 characters</div>
        )}
        {!loading && query.trim().length >= 2 && results.length === 0 && (
          <div className="p-4 text-center text-[13px] text-slate-500">No leads found</div>
        )}
        {!loading && results.map(lead => (
          <button
            key={lead.id}
            onClick={() => {
              onSelect(lead);
              onClose();
            }}
            className="w-full text-left flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors active:bg-slate-100"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <User size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-slate-900 truncate">{lead.name}</p>
                <p className="text-[12px] text-slate-500 truncate mt-0.5">{lead.phone} {lead.business ? `• ${lead.business}` : ''}</p>
              </div>
            </div>
            <div className="shrink-0 ml-3">
              <LeadStatusBadge status={lead.status} />
            </div>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
