import type { LeadStatus } from "@/features/leads/types";

const statusStyles: Record<LeadStatus, string> = {
  New: "bg-blue-50 text-blue-700 ring-blue-200",
  Contacted: "bg-slate-100 text-slate-700 ring-slate-200",
  Qualified: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "Proposal Sent": "bg-amber-50 text-amber-800 ring-amber-200",
  Won: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  Lost: "bg-rose-50 text-rose-800 ring-rose-200",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[status]}`}>
      {status}
    </span>
  );
}
