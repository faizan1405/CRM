"use client";

import { useMobilePush } from "../hooks/use-mobile-push";
import { Bell, BellRing, Smartphone, Check, AlertCircle, Loader2 } from "lucide-react";

export function MobileNotificationPrompt() {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    statusMessage,
    subscribeToPush,
    unsubscribeFromPush,
    sendTestNotification,
  } = useMobilePush();

  if (!isSupported) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-300 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
        <span>Push notifications are not supported in this browser or private window.</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-start gap-3.5">
        <div
          className={`p-2.5 rounded-xl border shrink-0 ${
            isSubscribed
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
          }`}
        >
          {isSubscribed ? <BellRing className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-100">
              Mobile Push Notifications
            </h4>
            {isSubscribed ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <Check className="w-3 h-3" /> Active
              </span>
            ) : (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                Disabled
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Receive real-time push alerts on your phone for upcoming follow-up reminders,
            overdue follow-ups, and urgent leads.
          </p>
          {statusMessage && (
            <p className="text-xs text-indigo-300 mt-1.5 font-medium animate-fadeIn">
              {statusMessage}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 self-end md:self-center shrink-0">
        {isSubscribed ? (
          <>
            <button
              type="button"
              onClick={sendTestNotification}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
              Send Test Push
            </button>
            <button
              type="button"
              onClick={unsubscribeFromPush}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition disabled:opacity-50"
            >
              Disable
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={subscribeToPush}
            disabled={isLoading || permission === "denied"}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <BellRing className="w-3.5 h-3.5" />
            )}
            {permission === "denied"
              ? "Blocked in Browser Settings"
              : "Enable Mobile Notifications"}
          </button>
        )}
      </div>
    </div>
  );
}
