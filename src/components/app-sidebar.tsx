"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Bell } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { crmNavigationGroups } from "@/components/crm-navigation";
import { LiveClock } from "@/components/live-clock";
import { GlobalSearch } from "@/components/global-search";
import { CrmRefreshButton } from "@/components/crm-refresh-button";
import { SyncStatusIndicator } from "@/components/sync-status-indicator";
import { cn } from "@/lib/utils";

function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M4 15c3 0 4-6 8-6s5 6 8 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M4 9.5c2 0 3-2.5 5-2.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity=".45" />
    </svg>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
  };

  return (
    <aside className="sticky top-0 hidden h-dvh w-[244px] shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex select-none">
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-5">
        <Link
          href="/dashboard"
          className="group flex items-center gap-2.5 text-sidebar-accent-foreground transition-opacity hover:opacity-95"
          aria-label="Scale Flow CRM dashboard"
        >
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <Logo className="h-4 w-4" />
          </span>
          <span className="text-[14px] font-semibold tracking-tight text-sidebar-accent-foreground">Scale Flow</span>
        </Link>
        <span className="rounded border border-sidebar-border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-sidebar-foreground/70">
          CRM
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/settings?tab=notifications"
            className="press grid h-7 w-7 place-items-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="h-3.5 w-3.5" />
          </Link>
          <CrmRefreshButton variant="desktop" />
        </div>
      </div>

      {/* Global Search */}
      <div className="px-3 pt-1">
        <GlobalSearch trigger="desktop" />
      </div>

      {/* Live status rail */}
      <div className="mx-3 mt-2.5 flex flex-col gap-1 rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-2.5 py-1.5 text-[11.5px]">
        <LiveClock />
        <SyncStatusIndicator variant="desktop" />
      </div>

      {/* Navigation Groups */}
      <nav aria-label="Primary navigation" className="mt-3.5 flex-1 space-y-4 overflow-y-auto px-3">
        {crmNavigationGroups.map((group) => (
          <div key={group.label}>
            <div className="px-2.5 pb-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-sidebar-foreground/45">
              {group.label}
            </div>
            <div className="space-y-px">
              {group.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors duration-200",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_var(--sidebar-border)]"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute -left-3 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r bg-sidebar-primary transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        active ? "opacity-100" : "scale-y-0 opacity-0"
                      )}
                      aria-hidden="true"
                    />
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors duration-200",
                        active ? "text-sidebar-primary" : "text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground"
                      )}
                      strokeWidth={1.8}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User & Logout Footer */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-sidebar-accent text-[11px] font-semibold text-sidebar-accent-foreground ring-1 ring-sidebar-border">
            F
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-medium text-sidebar-accent-foreground">Faizan</div>
            <div className="truncate text-[11.5px] text-sidebar-foreground/60">Scale Flow Admin</div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="press grid h-7 w-7 place-items-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-rose-500/15 hover:text-rose-400 cursor-pointer"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
