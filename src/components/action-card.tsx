"use client";

import type { HTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { useLeadNavigation } from "@/features/leads/lead-navigation-provider";

type ActionCardProps = HTMLAttributes<HTMLElement> & {
  href?: string;
  onActivate?: () => void;
};

/** A card can contain independent controls without nesting buttons or links. */
export function ActionCard({ href, onActivate, children, className = "", ...props }: ActionCardProps) {
  const router = useRouter();
  const navigation = useLeadNavigation();
  const activate = () => {
    if (onActivate) return onActivate();
    if (!href) return;
    const url = new URL(href, "https://crm.local");
    const leadId = url.searchParams.get("selected");
    if (url.pathname === "/leads" && leadId && navigation) {
      const action = url.searchParams.get("action");
      navigation.openLead(leadId, action === "activity" || action === "followups" ? action : null);
    } else router.push(href);
  };
  const actionable = Boolean(href || onActivate);
  return (
    <article
      {...props}
      role={actionable ? "button" : undefined}
      tabIndex={actionable ? 0 : undefined}
      className={`min-w-0 ${actionable ? "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 hover:border-blue-300" : ""} ${className}`}
      onClick={(event) => {
        // Contact links, menus, and form controls own their interactions.
        const control = (event.target as HTMLElement).closest("a,button,input,select,textarea,label,[role='button'],[role='menuitem']");
        if (control && control !== event.currentTarget) return;
        activate();
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      }}
    >{children}</article>
  );
}
