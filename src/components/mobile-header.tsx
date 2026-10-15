"use client";

import { usePathname } from "next/navigation";
import { GlobalSearch } from "@/components/global-search";
import { CrmRefreshButton } from "@/components/crm-refresh-button";
import { Bell } from "lucide-react";
import Link from "next/link";
import { SyncStatusIndicator } from "@/components/sync-status-indicator";
import { crmNavigation } from "./crm-navigation";

export function MobileHeader() {
  const pathname = usePathname();
  
  // Find title from navigation or custom map
  let title = "Scale Flow CRM";
  const navItem = crmNavigation.find((item) => pathname.startsWith(item.href));
  if (navItem) {
    title = navItem.label;
  } else if (pathname.includes("/leads/")) {
    title = "Lead Details";
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-sm lg:hidden pt-safe">
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <h1 className="text-lg font-bold tracking-tight text-slate-900 truncate">
          {title}
        </h1>
        <SyncStatusIndicator variant="mobile" />
      </div>
      
      <div className="flex items-center gap-1 shrink-0">
        <CrmRefreshButton variant="mobile" />
        <GlobalSearch trigger="mobile" />
        <Link 
          href="/settings?tab=notifications" 
          className="grid size-10 place-items-center rounded-full text-slate-600 hover:bg-slate-100 active:scale-95 transition-transform"
          aria-label="Notifications"
        >
          <Bell size={20} />
        </Link>
      </div>
    </header>
  );
}
