import type { LeadStatus } from "@/features/leads/types";
import { cn } from "@/lib/utils";

const statusStyles: Record<LeadStatus, string> = {
  New: "bg-info-soft text-info [--dot:var(--info)]",
  Contacted: "bg-muted text-muted-foreground [--dot:var(--subtle)]",
  Qualified: "bg-accent text-accent-foreground [--dot:var(--primary)]",
  "Proposal Sent": "bg-warning-soft text-warning [--dot:var(--warning)]",
  Won: "bg-success-soft text-success [--dot:var(--success)]",
  Lost: "bg-danger-soft text-destructive [--dot:var(--destructive)]",
};

export function LeadStatusBadge({ status, className }: { status: LeadStatus; className?: string }) {
  const style = statusStyles[status] || "bg-muted text-muted-foreground [--dot:var(--subtle)]";
  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[12px] font-medium",
        style,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--dot)]" aria-hidden="true" />
      <span>{status}</span>
    </span>
  );
}
