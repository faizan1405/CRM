"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { crmNavigation } from "@/components/crm-navigation";
import { LiveClock } from "@/components/live-clock";
import { GlobalSearch } from "@/components/global-search";
import { CrmRefreshButton } from "@/components/crm-refresh-button";
import { SyncStatusIndicator } from "@/components/sync-status-indicator";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-68 shrink-0 flex-col bg-[var(--sidebar)] px-4 py-5 lg:flex">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="group flex items-center gap-3 rounded-xl px-1.5 py-1 text-white transition-opacity hover:opacity-95"
            aria-label="Scale Flow CRM dashboard"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white shadow-md shadow-blue-950/40 ring-1 ring-white/20">
              SF
            </span>
            <span className="leading-tight">
              <span className="block text-[0.95rem] font-bold tracking-tight text-white">Scale Flow</span>
              <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.2 text-[10px] font-semibold uppercase tracking-wider text-blue-400 border border-blue-500/20">
                CRM
              </span>
            </span>
          </Link>
          <CrmRefreshButton variant="desktop" />
        </div>
        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-2.5 shadow-inner flex flex-col gap-1">
          <LiveClock />
          <SyncStatusIndicator variant="desktop" />
        </div>
        <div className="mt-0.5">
          <GlobalSearch trigger="desktop" />
        </div>
      </header>

      <nav aria-label="Primary navigation" className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto pr-0.5">
        {crmNavigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`group relative flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-gradient-to-r from-blue-600/25 to-blue-500/10 text-white font-semibold shadow-sm shadow-black/20"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
              }`}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                  aria-hidden="true"
                />
              )}
              <Icon
                aria-hidden="true"
                className={`shrink-0 transition-colors ${
                  isActive ? "text-blue-400" : "text-slate-400 group-hover:text-slate-200"
                }`}
                size={18}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 pt-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/[0.04] transition-colors">
          <div className="relative shrink-0">
            <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-slate-700 to-slate-800 text-sm font-bold text-slate-100 ring-1 ring-white/10 shadow-inner">
              F
            </span>
            <span
              className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-[var(--sidebar)]"
              title="Online"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-100 leading-tight">Faizan</p>
            <p className="truncate text-[11px] font-medium text-slate-400">Scale Flow Admin</p>
          </div>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="mt-1 flex min-h-9 w-full items-center gap-2.5 rounded-xl px-3 text-xs font-semibold text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400 cursor-pointer"
          >
            <LogOut aria-hidden="true" size={16} strokeWidth={1.8} />
            <span>Logout</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
