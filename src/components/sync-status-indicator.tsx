"use client";

import { useSyncStatus } from "@/components/sync-provider";
import { formatSyncISTTime } from "@/lib/date-utils";
import { Check, RefreshCw, WifiOff, AlertCircle, Sparkles } from "lucide-react";

interface SyncStatusIndicatorProps {
  variant?: "desktop" | "mobile";
  className?: string;
}

export function SyncStatusIndicator({
  variant = "desktop",
  className = "",
}: SyncStatusIndicatorProps) {
  const {
    syncState,
    lastSyncTime,
    triggerSync,
    applyPendingUpdates,
  } = useSyncStatus();

  const formattedTime = lastSyncTime ? formatSyncISTTime(lastSyncTime) : null;

  if (variant === "mobile") {
    switch (syncState) {
      case "syncing":
        return (
          <div
            data-testid="sync-status-mobile"
            aria-live="polite"
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 shrink-0 ${className}`}
          >
            <RefreshCw size={11} className="animate-spin text-blue-600 shrink-0" />
            <span>Syncing...</span>
          </div>
        );

      case "synced":
        return (
          <div
            data-testid="sync-status-mobile"
            aria-live="polite"
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0 ${className}`}
            title={formattedTime ? `Last synced at ${formattedTime} (IST)` : "CRM Synced"}
          >
            <Check size={11} className="text-emerald-600 shrink-0 stroke-[2.5]" />
            <span>{formattedTime ? `Synced • ${formattedTime}` : "Synced"}</span>
          </div>
        );

      case "offline":
        return (
          <div
            data-testid="sync-status-mobile"
            aria-live="polite"
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60 shrink-0 ${className}`}
          >
            <WifiOff size={11} className="text-amber-600 shrink-0" />
            <span>Offline</span>
          </div>
        );

      case "error":
        return (
          <button
            type="button"
            data-testid="sync-status-mobile"
            onClick={() => triggerSync({ forceRefresh: true })}
            aria-live="assertive"
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/60 active:scale-95 transition-transform shrink-0 ${className}`}
            title="Sync error. Tap to retry."
          >
            <AlertCircle size={11} className="text-rose-600 shrink-0" />
            <span>Sync error</span>
          </button>
        );

      case "updates_available":
        return (
          <button
            type="button"
            data-testid="sync-status-mobile"
            onClick={() => applyPendingUpdates()}
            aria-live="polite"
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 animate-pulse active:scale-95 transition-transform shrink-0 ${className}`}
            title="Remote updates available. Tap to refresh."
          >
            <Sparkles size={11} className="text-blue-600 shrink-0" />
            <span>Updates available</span>
          </button>
        );
    }
  }

  // Desktop variant
  switch (syncState) {
    case "syncing":
      return (
        <div
          data-testid="sync-status-desktop"
          aria-live="polite"
          className={`flex items-center gap-1.5 text-xs text-slate-400 font-medium ${className}`}
        >
          <RefreshCw size={12} className="animate-spin text-blue-400 shrink-0" />
          <span>Syncing...</span>
        </div>
      );

    case "synced":
      return (
        <div
          data-testid="sync-status-desktop"
          aria-live="polite"
          className={`flex items-center gap-1.5 text-xs text-slate-400 font-medium ${className}`}
          title={formattedTime ? `Last successful server sync: ${formattedTime} (IST)` : "CRM is synchronized"}
        >
          <Check size={12} className="text-emerald-400 shrink-0 stroke-[2.5]" />
          <span className="text-emerald-400 font-semibold">✓ Synced</span>
          {formattedTime ? (
            <>
              <span className="text-slate-500">•</span>
              <span className="text-slate-300">{formattedTime}</span>
            </>
          ) : null}
        </div>
      );

    case "offline":
      return (
        <div
          data-testid="sync-status-desktop"
          aria-live="polite"
          className={`flex items-center gap-1.5 text-xs text-amber-400 font-medium ${className}`}
          title="Internet disconnected. Operating in offline mode."
        >
          <WifiOff size={12} className="shrink-0" />
          <span>Offline</span>
        </div>
      );

    case "error":
      return (
        <button
          type="button"
          data-testid="sync-status-desktop"
          onClick={() => triggerSync({ forceRefresh: true })}
          aria-live="assertive"
          className={`flex items-center gap-1.5 text-xs text-rose-400 font-medium hover:text-rose-300 transition-colors text-left cursor-pointer ${className}`}
          title="Sync failed. Click to retry server synchronization."
        >
          <AlertCircle size={12} className="shrink-0" />
          <span>Sync error (click to retry)</span>
        </button>
      );

    case "updates_available":
      return (
        <button
          type="button"
          data-testid="sync-status-desktop"
          onClick={() => applyPendingUpdates()}
          aria-live="polite"
          className={`flex items-center gap-1.5 text-xs text-blue-400 font-medium hover:text-blue-300 animate-pulse transition-colors text-left cursor-pointer ${className}`}
          title="Remote changes arrived. Click to refresh safely."
        >
          <Sparkles size={12} className="shrink-0" />
          <span>Updates available • Click to refresh</span>
        </button>
      );
  }
}
