"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions/auth";
import { crmNavigation } from "@/components/crm-navigation";
import { LiveClock } from "@/components/live-clock";

export function MobileNavigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--border)] bg-white/95 px-4 backdrop-blur-sm lg:hidden">
        <div className="flex flex-col">
          <Link href="/dashboard" className="flex items-center gap-2.5 rounded-md" aria-label="Scale Flow CRM dashboard">
            <span className="grid size-8 place-items-center rounded-lg bg-blue-600 text-xs font-bold text-white">SF</span>
            <span className="text-sm font-semibold tracking-tight text-slate-900">Scale Flow <span className="font-medium text-slate-500">CRM</span></span>
          </Link>
          <div className="pl-10 -mt-1 hidden sm:block">
            <LiveClock />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="sm:hidden">
            <LiveClock />
          </div>
          <button ref={menuButtonRef} type="button" onClick={() => setIsOpen(true)} aria-label="Open navigation menu" aria-expanded={isOpen} aria-controls="mobile-navigation-panel" className="grid size-11 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
            <Menu aria-hidden="true" size={21} />
          </button>
        </div>
      </header>

      {isOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close navigation menu" className="absolute inset-0 bg-slate-950/45" onClick={() => setIsOpen(false)} />
          <aside id="mobile-navigation-panel" role="dialog" aria-modal="true" aria-label="Navigation menu" className="absolute inset-y-0 left-0 flex w-[min(19rem,86vw)] flex-col bg-[var(--sidebar)] px-4 py-5 shadow-2xl">
            <div className="flex items-center justify-between gap-4 px-2">
              <div className="flex items-center gap-3 text-white">
                <span className="grid size-9 place-items-center rounded-lg bg-blue-600 text-sm font-bold">SF</span>
                <span className="text-sm font-semibold">Scale Flow <span className="font-medium text-slate-400">CRM</span></span>
              </div>
              <button ref={closeButtonRef} type="button" onClick={() => { setIsOpen(false); menuButtonRef.current?.focus(); }} aria-label="Close navigation menu" className="grid size-10 place-items-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white">
                <X aria-hidden="true" size={21} />
              </button>
            </div>

            <nav aria-label="Mobile navigation" className="mt-8 flex flex-1 flex-col gap-1">
              {crmNavigation.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)} aria-current={isActive ? "page" : undefined} className={`flex min-h-12 items-center gap-3 rounded-lg px-3 text-base font-medium ${isActive ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/6 hover:text-white"}`}>
                    <Icon aria-hidden="true" className={isActive ? "text-blue-400" : ""} size={20} strokeWidth={1.9} /> {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center gap-3 px-2 py-2">
                <span className="grid size-9 place-items-center rounded-full bg-slate-700 text-sm font-semibold text-white" aria-hidden="true">U</span>
                <div><p className="text-sm font-medium text-slate-100">Current user</p><p className="text-xs text-slate-400">Account</p></div>
              </div>
              <form action={logout}>
                <button type="submit" className="mt-1 flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-400 hover:bg-white/6 hover:text-white"><LogOut aria-hidden="true" size={18} /> Logout</button>
              </form>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
