"use client";

import { useState } from "react";
import { crmNavigation } from "@/components/crm-navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Menu, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";

export function MoreMenuSheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  
  // Exclude primary bottom nav items
  const primaryHrefs = ["/dashboard", "/leads", "/pipeline", "/follow-ups"];
  const moreItems = crmNavigation.filter(item => !primaryHrefs.includes(item.href));

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="More">
      <div className="flex flex-col gap-2">
        {moreItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                isActive ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-700 hover:bg-slate-100/70"
              }`}
            >
              <Icon size={20} className={isActive ? "text-blue-600" : "text-slate-500"} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="my-1.5 h-px w-full bg-slate-100" />
        
        <form action={logout}>
          <button 
            type="submit" 
            className="flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </form>
      </div>
    </BottomSheet>
  );
}
