import { CheckCircle2, PhoneCall, ArrowRight, Building2 } from "lucide-react";
import Link from "next/link";

export function TodaysPriorities() {
  const priorities = [
    {
      id: "1",
      leadName: "Alice Smith",
      business: "TechCorp Inc.",
      actionNeeded: "Follow-up Call",
      time: "10:00 AM",
      phone: "+1 234-567-8901",
      status: "Contacted",
      statusColor: "bg-cyan-100 text-cyan-700",
    },
    {
      id: "2",
      leadName: "Bob Johnson",
      business: "Retail Solutions",
      actionNeeded: "Send Proposal",
      time: "11:30 AM",
      phone: "+1 987-654-3210",
      status: "Qualified",
      statusColor: "bg-purple-100 text-purple-700",
    },
    {
      id: "3",
      leadName: "Charlie Brown",
      business: "Snoopy Logistics",
      actionNeeded: "Check-in",
      time: "2:15 PM",
      phone: "+1 555-123-4567",
      status: "Proposal Sent",
      statusColor: "bg-amber-100 text-amber-700",
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {priorities.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed py-8 text-sm text-slate-500">
          No priorities for today.
        </div>
      ) : (
        priorities.map((item) => (
          <div key={item.id} className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{item.leadName}</span>
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${item.statusColor}`}>
                  {item.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {item.business}</span>
                <span className="flex items-center gap-1"><PhoneCall className="h-3 w-3" /> {item.phone}</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between sm:justify-end gap-3 border-t pt-3 sm:border-0 sm:pt-0 text-sm">
              <div className="flex flex-col sm:items-end mr-2">
                <span className="font-medium text-slate-700">{item.actionNeeded}</span>
                <span className="text-xs font-semibold text-slate-500">{item.time}</span>
              </div>
              <div className="flex gap-2">
                <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title="Call">
                  <PhoneCall className="h-4 w-4" />
                </button>
                <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Complete">
                  <CheckCircle2 className="h-4 w-4" />
                </button>
                <Link href={`/leads/${item.id}`} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors" title="Open Lead">
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
