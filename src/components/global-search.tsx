"use client";

import { useEffect, useState, useRef } from "react";
import { Search, Loader2, X } from "lucide-react";
import { globalQuickSearch } from "@/app/actions/lead-search";
import { useLeadNavigation } from "@/features/leads/lead-navigation-provider";
import { formatNextFollowUp } from "@/lib/date-utils";

export function GlobalSearch({ trigger = "hidden" }: { trigger?: "mobile" | "desktop" | "hidden" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ id: string; name: string; phone: string; status: string; nextFollowUpDate: Date | null; notes: string | null }[]>([]);
  const { openLead } = useLeadNavigation() || {};
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query || query.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }

    setLoading(true);
    const timeout = setTimeout(async () => {
      const res = await globalQuickSearch(query);
      if (res.success) {
        setResults(res.data || []);
      }
      setLoading(false);
    }, 250);

    return () => clearTimeout(timeout);
  }, [query]);

  if (!isOpen) {
    if (trigger === "hidden") return null;
    
    if (trigger === "mobile") {
      return (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg p-2"
          aria-label="Global search"
        >
          <Search size={20} />
        </button>
      );
    }
    
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-700/80 hover:text-slate-300 w-full transition-colors"
      >
        <Search size={14} />
        <span>Search...</span>
        <span className="ml-auto text-[10px] font-semibold opacity-60">Ctrl+K</span>
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-slate-950/45" onClick={() => setIsOpen(false)} />
      <div className="fixed inset-0 sm:inset-x-4 sm:bottom-auto sm:top-24 z-[101] mx-auto sm:max-w-xl">
        <div className="flex h-[100dvh] sm:h-auto flex-col overflow-hidden sm:rounded-xl bg-white shadow-2xl animate-in fade-in zoom-in-95 sm:zoom-in-100 duration-150">
          <div className="flex items-center border-b border-slate-100 px-4 py-3 bg-white pt-safe sm:pt-3">
            <Search size={20} className="text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search leads by name or phone..."
              className="flex-1 border-none bg-transparent px-3 py-1.5 text-[16px] sm:text-sm outline-none placeholder:text-slate-400"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {loading && <Loader2 size={16} className="animate-spin text-slate-400" />}
            <button
              onClick={() => setIsOpen(false)}
              className="ml-2 rounded-lg p-2 bg-slate-50 text-slate-500 hover:bg-slate-100 active:scale-95 transition-all"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50/30 pb-safe">
            {results.length > 0 && (
              <div className="p-2 sm:p-3 sm:max-h-[60vh]">
                {results.map((lead) => (
                  <button
                    key={lead.id}
                    onClick={() => {
                      setIsOpen(false);
                      openLead?.(lead.id);
                    }}
                    className="mb-2 flex w-full flex-col gap-1 rounded-xl bg-white px-4 py-3 shadow-sm border border-slate-100 text-left hover:border-blue-200 active:bg-slate-50 transition-all"
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-semibold text-slate-900 text-[15px] truncate">{lead.name}</span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {lead.status}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 text-[13px] text-slate-500 mt-0.5">
                      <span className="truncate">{lead.phone}</span>
                      <span className="shrink-0 text-blue-600 font-medium">{formatNextFollowUp(lead.nextFollowUpDate)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {query.length >= 2 && results.length === 0 && !loading && (
              <div className="p-10 text-center text-[15px] text-slate-500">
                No results found for &quot;{query}&quot;
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
