"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { crmNavigation } from "@/components/crm-navigation";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-68 shrink-0 flex-col bg-[var(--sidebar)] px-4 py-5 lg:flex">
      <Link href="/dashboard" className="flex items-center gap-3 rounded-lg px-2 py-1 text-white" aria-label="Scale Flow CRM dashboard">
        <span className="grid size-9 place-items-center rounded-lg bg-blue-600 text-sm font-bold shadow-sm shadow-blue-950/30">SF</span>
        <span className="leading-tight">
          <span className="block text-[0.95rem] font-semibold tracking-tight">Scale Flow</span>
          <span className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">CRM</span>
        </span>
      </Link>

      <nav aria-label="Primary navigation" className="mt-8 flex flex-1 flex-col gap-1">
        {crmNavigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${isActive ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/6 hover:text-white"}`}
            >
              <Icon aria-hidden="true" className={isActive ? "text-blue-400" : ""} size={19} strokeWidth={1.9} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 pt-4">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-700 text-sm font-semibold text-slate-100" aria-hidden="true">U</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-100">Current user</p>
            <p className="truncate text-xs text-[var(--sidebar-muted)]">Account</p>
          </div>
        </div>
        <form action={logout}>
          <button type="submit" className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-400 transition-colors hover:bg-white/6 hover:text-white">
            <LogOut aria-hidden="true" size={18} strokeWidth={1.9} /> Logout
          </button>
        </form>
      </div>
    </aside>
  );
}
