import type { LeadStatus } from "@/features/leads/types";

const statusStyles: Record<LeadStatus, string> = {
  New: "bg-blue-100 text-blue-800 ring-blue-200",
  Contacted: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  Qualified: "bg-purple-100 text-purple-800 ring-purple-200",
  "Proposal Sent": "bg-indigo-100 text-indigo-800 ring-indigo-200",
  Won: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  Lost: "bg-rose-100 text-rose-800 ring-rose-200",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[status]}`}>
      {status}
    </span>
  );
}
