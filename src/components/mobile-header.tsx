"use client";

import { usePathname } from "next/navigation";
import { GlobalSearch } from "@/components/global-search";
import { CrmRefreshButton } from "@/components/crm-refresh-button";
import { Bell } from "lucide-react";
import Link from "next/link";
import { SyncStatusIndicator } from "@/components/sync-status-indicator";
import { crmNavigation } from "./crm-navigation";

function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M4 15c3 0 4-6 8-6s5 6 8 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M4 9.5c2 0 3-2.5 5-2.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity=".45" />
    </svg>
  );
}

export function MobileHeader() {
  const pathname = usePathname();

  let title = "Scale Flow";
  const navItem = crmNavigation.find((item) => pathname.startsWith(item.href));
  if (navItem) {
    title = navItem.label;
  } else if (pathname.includes("/leads/")) {
    title = "Lead Details";
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 px-4 backdrop-blur-xl lg:hidden pt-safe">
      <div className="flex h-[52px] items-center gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink text-sidebar-primary">
          <Logo className="h-4 w-4" />
        </span>
        <span className="truncate text-[15px] font-semibold tracking-tight text-foreground">
          {title}
        </span>
        <SyncStatusIndicator variant="mobile" />

        <div className="ml-auto flex items-center gap-0.5 shrink-0">
          <CrmRefreshButton variant="mobile" />
          <GlobalSearch trigger="mobile" />
          <Link
            href="/settings?tab=notifications"
            className="press grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
