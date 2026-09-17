"use client";

import { useState, useEffect } from "react";
import { Search, X, User } from "lucide-react";
import { searchLeadsForWhatsApp } from "@/app/actions/lead-search";
import { LeadStatusBadge } from "@/features/leads/lead-status-badge";

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
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center sm:p-4 bg-slate-950/45 pt-[10vh]">
      <div className="relative flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl overflow-hidden mx-4 sm:mx-0">
        <div className="flex items-center border-b border-slate-100 p-2">
          <Search size={18} className="text-slate-400 ml-2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lead by name or phone..."
            className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            autoFocus
          />
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {loading && <div className="p-4 text-center text-xs text-slate-500">Searching...</div>}
          {!loading && query.trim().length > 0 && query.trim().length < 2 && (
            <div className="p-4 text-center text-xs text-slate-500">Type at least 2 characters</div>
          )}
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-500">No leads found</div>
          )}
          {!loading && results.map(lead => (
            <button
              key={lead.id}
              onClick={() => {
                onSelect(lead);
                onClose();
              }}
              className="w-full text-left flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <User size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{lead.name}</p>
                  <p className="text-xs text-slate-500 truncate">{lead.phone} {lead.business ? `• ${lead.business}` : ''}</p>
                </div>
              </div>
              <div className="shrink-0 ml-3">
                <LeadStatusBadge status={lead.status} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
