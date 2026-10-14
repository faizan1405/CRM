"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Users,
  Columns3,
  CalendarCheck2,
  Ellipsis,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { crmNavigation } from "@/components/crm-navigation";
import { logout } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
};

const mobilePrimary: { href: string; label: string; icon: React.ElementType }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/follow-ups", label: "Follow-ups", icon: CalendarCheck2 },
];

export function MobileNavigation() {
  const pathname = usePathname();
  const [more, setMore] = useState(false);

  const isActive = (href: string) => {
    return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
  };

  const mobileIdx = mobilePrimary.findIndex((p) => isActive(p.href));
  const activeMobile = mobileIdx === -1 ? (more ? 4 : -1) : mobileIdx;

  const moreItems = crmNavigation.filter(
    (item) => !mobilePrimary.some((p) => p.href === item.href)
  );

  return (
    <>
      <nav className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 lg:hidden">
        <div className="relative mx-auto grid h-[60px] max-w-md grid-cols-5 rounded-2xl bg-ink/95 p-1.5 text-ink-muted shadow-[var(--shadow-float)] backdrop-blur-xl">
          {activeMobile !== -1 && (
            <span
              className="absolute bottom-1.5 top-1.5 rounded-xl bg-ink-line transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                width: "calc((100% - 0.75rem) / 5)",
                left: "0.375rem",
                transform: `translateX(${activeMobile * 100}%)`,
              }}
            />
          )}

          {mobilePrimary.map((item, i) => {
            const active = activeMobile === i;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "press relative flex flex-col items-center justify-center gap-0.5",
                  active ? "text-ink-foreground" : "text-ink-muted hover:text-ink-foreground"
                )}
              >
                <Icon
                  className={cn("h-[18px] w-[18px]", active ? "text-sidebar-primary" : "")}
                  strokeWidth={1.9}
                />
                <span className="text-[10.5px] font-medium">{item.label}</span>
              </Link>
            );
          })}

          <button
            onClick={() => setMore(true)}
            className={cn(
              "press relative flex flex-col items-center justify-center gap-0.5 cursor-pointer",
              activeMobile === 4 ? "text-ink-foreground" : "text-ink-muted hover:text-ink-foreground"
            )}
            aria-label="More navigation items"
          >
            <Ellipsis
              className={cn("h-[18px] w-[18px]", activeMobile === 4 ? "text-sidebar-primary" : "")}
            />
            <span className="text-[10.5px] font-medium">More</span>
          </button>
        </div>
      </nav>

      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent
          side="bottom"
          className="rounded-t-[22px] border-0 px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 bg-card"
        >
          <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-border" />
          <SheetTitle className="mb-2 px-2 text-[13px] font-medium text-muted-foreground">
            More Options
          </SheetTitle>
          <div className="divide-y divide-border overflow-hidden rounded-xl bg-muted/60">
            {moreItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMore(false)}
                  className={cn(
                    "press flex h-12 items-center gap-3 px-4 text-[14px] font-medium transition-colors",
                    active ? "text-primary bg-accent/40 font-semibold" : "text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-3">
            <form action={logout}>
              <button
                type="submit"
                className="press flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-destructive/10 text-[13.5px] font-semibold text-destructive hover:bg-destructive/15 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
