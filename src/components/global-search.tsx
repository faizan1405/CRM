"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, Loader2, X } from "lucide-react";
import { globalQuickSearch } from "@/app/actions/lead-search";
import { useLeadNavigation } from "@/features/leads/lead-navigation-provider";
import { formatNextFollowUp } from "@/lib/date-utils";

export function GlobalSearch({ trigger = "hidden" }: { trigger?: "mobile" | "desktop" | "hidden" }) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ id: string; name: string; phone: string; status: string; nextFollowUpDate: Date | null; notes: string | null }[]>([]);
  const { openLead } = useLeadNavigation() || {};
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (trigger === "desktop" && typeof window !== "undefined" && window.innerWidth < 1024) return;
        if (trigger === "mobile" && typeof window !== "undefined" && window.innerWidth >= 1024) return;
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, trigger]);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => {
        document.body.style.overflow = originalOverflow;
        clearTimeout(timer);
      };
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

  return (
    <>
      {trigger === "mobile" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg p-2"
          aria-label="Global search"
        >
          <Search size={20} />
        </button>
      ) : trigger === "desktop" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-700/80 hover:text-slate-300 w-full transition-colors"
        >
          <Search size={14} />
          <span>Search...</span>
          <span className="ml-auto text-[10px] font-semibold opacity-60">Ctrl+K</span>
        </button>
      ) : null}

      {mounted && isOpen && createPortal(
        <>
          {/* Frosted Backdrop */}
          <div
            className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Modal Container */}
          <div
            className="fixed inset-0 z-[101] flex flex-col sm:items-center sm:justify-start sm:pt-24 sm:px-4 sm:overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsOpen(false);
              }
            }}
          >
            <div
              className="flex flex-col w-full h-[100dvh] sm:h-auto sm:max-h-[min(700px,80vh)] sm:max-w-2xl sm:rounded-2xl bg-white shadow-2xl sm:border sm:border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Global search"
            >
              {/* Top Search Input Bar */}
              <div className="relative flex items-center border-b border-slate-100 px-4 py-3 sm:py-3.5 bg-white pt-safe sm:pt-3.5 gap-3 shrink-0">
                <Search className="size-5 shrink-0 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search leads by name or phone..."
                  className="flex-1 min-w-0 border-none bg-transparent py-1 text-base sm:text-sm outline-none text-slate-900 placeholder:text-slate-400"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <div className="flex items-center gap-2 shrink-0">
                  {loading && <Loader2 className="size-4 animate-spin text-blue-600" />}
                  <span className="hidden sm:inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-400">
                    ESC
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close search"
                    className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:scale-95 transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Results Container */}
              <div className="flex-1 overflow-y-auto bg-slate-50/40 pb-safe sm:pb-3">
                {results.length > 0 && (
                  <div className="p-2 sm:p-3 sm:max-h-[60vh] overflow-y-auto">
                    {results.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          openLead?.(lead.id);
                        }}
                        className="mb-2 last:mb-0 flex w-full flex-col gap-1 rounded-xl bg-white p-3 sm:px-4 sm:py-3 shadow-sm border border-slate-100 text-left hover:border-blue-200 hover:bg-blue-50/30 active:bg-slate-50 transition-all cursor-pointer"
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
                  <div className="p-8 sm:p-10 text-center text-sm sm:text-[15px] text-slate-500">
                    No results found for &quot;<span className="font-medium text-slate-700">{query}</span>&quot;
                  </div>
                )}

                {query.length < 2 && (
                  <div className="p-6 sm:p-8 text-center text-xs sm:text-sm text-slate-400">
                    Type at least 2 characters to search leads...
                  </div>
                )}
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
