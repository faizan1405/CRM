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
      <nav className="fixed bottom-0 inset-x-0 z-40 flex h-16 items-center justify-around border-t border-slate-200/80 bg-white/95 pb-safe backdrop-blur-md lg:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.03)]">
        {primaryItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon as React.ElementType;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full space-y-0.5 transition-colors ${
                active ? "text-blue-600" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <div className={`flex items-center justify-center w-12 h-7 rounded-full transition-all ${active ? "bg-blue-100/60 text-blue-600" : "transparent"}`}>
                <Icon size={19} strokeWidth={active ? 2.3 : 1.8} />
              </div>
              <span className={`text-[10px] tracking-tight ${active ? "font-bold text-blue-700" : "font-medium"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
        
        <button
          onClick={() => setIsMoreOpen(true)}
          className={`flex flex-col items-center justify-center w-full h-full space-y-0.5 transition-colors ${
            isMoreOpen ? "text-blue-600" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <div className="flex items-center justify-center w-12 h-7 rounded-full transition-all transparent">
            <Menu size={19} strokeWidth={isMoreOpen ? 2.3 : 1.8} />
          </div>
          <span className={`text-[10px] tracking-tight ${isMoreOpen ? "font-bold text-blue-700" : "font-medium"}`}>
            More
          </span>
        </button>
      </nav>

      <MoreMenuSheet isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} />
    </>
  );
}
