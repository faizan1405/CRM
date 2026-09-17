"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions/auth";
import { crmNavigation } from "@/components/crm-navigation";
import { LiveClock } from "@/components/live-clock";
import { GlobalSearch } from "@/components/global-search";
import { MoreMenuSheet } from "@/components/more-menu-sheet";

export function MobileNavigation() {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const primaryItems = [
    { label: "Dashboard", href: "/dashboard", icon: crmNavigation.find(i => i.href === "/dashboard")?.icon },
    { label: "Leads", href: "/leads", icon: crmNavigation.find(i => i.href === "/leads")?.icon },
    { label: "Pipeline", href: "/pipeline", icon: crmNavigation.find(i => i.href === "/pipeline")?.icon },
    { label: "Follow-ups", href: "/follow-ups", icon: crmNavigation.find(i => i.href === "/follow-ups")?.icon },
  ];

  // If we are deep inside a lead (e.g. /leads/123), we still want the "Leads" tab active.
  const isActive = (href: string) => {
    if (href === "/dashboard" && pathname === "/dashboard") return true;
    if (href !== "/dashboard" && pathname.startsWith(href)) return true;
    return false;
  };

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-40 flex h-16 items-center justify-around border-t border-slate-200 bg-white/95 pb-safe backdrop-blur-md lg:hidden">
        {primaryItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon as React.ElementType;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                active ? "text-blue-600" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <div className={`flex items-center justify-center w-14 h-8 rounded-full transition-colors ${active ? "bg-blue-100/50" : "transparent"}`}>
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] font-medium leading-none ${active ? "font-bold text-blue-700" : ""}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
        
        <button
          onClick={() => setIsMoreOpen(true)}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
            isMoreOpen ? "text-blue-600" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <div className="flex items-center justify-center w-14 h-8 rounded-full transition-colors transparent">
            <Menu size={22} strokeWidth={isMoreOpen ? 2.5 : 2} />
          </div>
          <span className={`text-[10px] font-medium leading-none ${isMoreOpen ? "font-bold text-blue-700" : ""}`}>
            More
          </span>
        </button>
      </nav>

      <MoreMenuSheet isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} />
    </>
  );
}
