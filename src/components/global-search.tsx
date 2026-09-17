"use client";

import { useEffect, useState, useRef, useId, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Search, Loader2, X } from "lucide-react";
import { globalQuickSearch } from "@/app/actions/lead-search";
import { useLeadNavigation } from "@/features/leads/lead-navigation-provider";
import { formatNextFollowUp } from "@/lib/date-utils";

// Module-level single source of truth for global search open state
let isSearchOpen = false;
const searchListeners = new Set<() => void>();

function notifySearchListeners() {
  searchListeners.forEach((listener) => listener());
}

export function openGlobalSearch() {
  if (!isSearchOpen) {
    isSearchOpen = true;
    notifySearchListeners();
  }
}

export function closeGlobalSearch() {
  if (isSearchOpen) {
    isSearchOpen = false;
    notifySearchListeners();
  }
}

export function toggleGlobalSearch() {
  isSearchOpen = !isSearchOpen;
  notifySearchListeners();
}

function subscribeSearch(callback: () => void) {
  searchListeners.add(callback);
  return () => {
    searchListeners.delete(callback);
  };
}

function getSearchSnapshot() {
  return isSearchOpen;
}

function getServerSearchSnapshot() {
  return false;
}

export function useGlobalSearchOpen() {
  return useSyncExternalStore(subscribeSearch, getSearchSnapshot, getServerSearchSnapshot);
}

// Portal host registration so only ONE portal modal is ever mounted into document.body
let activePortalHostId: string | null = null;
const hostListeners = new Set<() => void>();

function registerHost(id: string) {
  if (!activePortalHostId) {
    activePortalHostId = id;
    hostListeners.forEach((fn) => fn());
  }
}

function unregisterHost(id: string) {
  if (activePortalHostId === id) {
    activePortalHostId = null;
    hostListeners.forEach((fn) => fn());
  }
}

function subscribeHost(callback: () => void) {
  hostListeners.add(callback);
  return () => {
    hostListeners.delete(callback);
  };
}

function getHostSnapshot() {
  return activePortalHostId;
}

function getServerHostSnapshot() {
  return null;
}

interface GlobalSearchProps {
  trigger?: "mobile" | "desktop" | "hidden";
  className?: string;
}

export function GlobalSearch({ trigger = "hidden", className }: GlobalSearchProps) {
  const instanceId = useId();
  const [mounted, setMounted] = useState(false);
  const isOpen = useGlobalSearchOpen();
  const hostId = useSyncExternalStore(subscribeHost, getHostSnapshot, getServerHostSnapshot);

  useEffect(() => {
    setMounted(true);
    registerHost(instanceId);
    return () => {
      unregisterHost(instanceId);
    };
  }, [instanceId]);

  // If hostId is null and this instance is mounted, claim host
  useEffect(() => {
    if (mounted && !hostId) {
      registerHost(instanceId);
    }
  }, [mounted, hostId, instanceId]);

  const isHost = mounted && (hostId === instanceId || hostId === null);

  // Single global keyboard listener attached by whichever instance is host
  useEffect(() => {
    if (!isHost) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleGlobalSearch();
      }
      if (e.key === "Escape" && isSearchOpen) {
        e.preventDefault();
        closeGlobalSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isHost]);

  return (
    <>
      {trigger === "mobile" ? (
        <button
          type="button"
          onClick={openGlobalSearch}
          className="text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg p-2"
          aria-label="Global search"
        >
          <Search size={20} />
        </button>
      ) : trigger === "desktop" ? (
        <button
          type="button"
          onClick={openGlobalSearch}
          className={`group flex h-9 w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[13px] text-slate-400 shadow-sm shadow-black/20 transition-all duration-150 hover:border-white/20 hover:bg-white/[0.08] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
            isOpen ? "border-blue-500/50 bg-white/[0.08] text-slate-200 ring-1 ring-blue-500/50" : ""
          } ${className || ""}`}
          aria-label="Search leads"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Search className="size-3.5 shrink-0 text-slate-400 transition-colors group-hover:text-slate-300" aria-hidden="true" />
            <span className="truncate font-normal">Search leads...</span>
          </div>
          <kbd className="pointer-events-none ml-2 shrink-0 inline-flex h-5 select-none items-center rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] font-medium text-slate-400 transition-colors group-hover:border-white/20 group-hover:text-slate-300">
            Ctrl K
          </kbd>
        </button>
      ) : null}

      {isHost && isOpen && <GlobalSearchModal />}
    </>
  );
}

function GlobalSearchModal() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<
    { id: string; name: string; phone: string; status: string; nextFollowUpDate: Date | null; notes: string | null }[]
  >([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const { openLead } = useLeadNavigation() || {};
  const inputRef = useRef<HTMLInputElement>(null);

  // Prevent background scroll without layout shift
  useEffect(() => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = "hidden";

    const timer = setTimeout(() => inputRef.current?.focus(), 50);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      clearTimeout(timer);
    };
  }, []);

  // Quick search query with debounce
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await globalQuickSearch(trimmed);
        if (res.success) {
          setResults(res.data || []);
          setSelectedIndex(-1);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev <= 0 ? results.length - 1 : prev - 1) : -1));
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        e.preventDefault();
        const selected = results[selectedIndex];
        closeGlobalSearch();
        openLead?.(selected.id);
      }
    }
  };

  return createPortal(
    <>
      {/* Frosted Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-150"
        onClick={closeGlobalSearch}
        aria-hidden="true"
      />

      {/* Modal Overlay Container */}
      <div
        className="fixed inset-0 z-[101] flex flex-col sm:items-center sm:justify-start sm:pt-20 sm:px-4 sm:overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            closeGlobalSearch();
          }
        }}
      >
        <div
          className="flex flex-col w-full h-[100dvh] sm:h-auto sm:max-h-[min(650px,80vh)] sm:max-w-2xl sm:rounded-2xl bg-white shadow-2xl sm:border sm:border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
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
              onKeyDown={handleInputKeyDown}
              autoComplete="off"
              spellCheck={false}
            />
            <div className="flex items-center gap-2 shrink-0">
              {loading && <Loader2 className="size-4 animate-spin text-blue-600" />}
              <kbd className="hidden sm:inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-400">
                ESC
              </kbd>
              <button
                type="button"
                onClick={closeGlobalSearch}
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
              <div className="p-2 sm:p-3 sm:max-h-[58vh] overflow-y-auto">
                {results.map((lead, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => {
                        closeGlobalSearch();
                        openLead?.(lead.id);
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`mb-2 last:mb-0 flex w-full flex-col gap-1 rounded-xl p-3 sm:px-4 sm:py-3 text-left transition-all cursor-pointer border ${
                        isSelected
                          ? "border-blue-300 bg-blue-50/70 shadow-sm"
                          : "bg-white border-slate-100 shadow-sm hover:border-blue-200 hover:bg-blue-50/30 active:bg-slate-50"
                      }`}
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
                  );
                })}
              </div>
            )}

            {query.trim().length >= 2 && results.length === 0 && !loading && (
              <div className="p-8 sm:p-10 text-center text-sm sm:text-[15px] text-slate-500">
                No results found for &quot;<span className="font-medium text-slate-700">{query.trim()}</span>&quot;
              </div>
            )}

            {query.trim().length < 2 && (
              <div className="p-6 sm:p-8 text-center text-xs sm:text-sm text-slate-400">
                Type at least 2 characters to search leads...
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
