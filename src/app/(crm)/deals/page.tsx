import type { Metadata } from "next";
import { getAllDeals } from "@/app/actions/deals";
import { DealsWorkspace } from "@/features/deals/components/deals-workspace";
import { AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Deals & Payments | Scale Flow CRM",
  description: "Manage client deals, payments received, remaining balances, and upcoming due dates.",
};

export const dynamic = "force-dynamic";

export default async function DealsPage({
  searchParams,
}: {
  searchParams?: Promise<{ filter?: string; sortBy?: string }>;
}) {
  const params = await searchParams;
  const filter = (params?.filter as any) || "all";
  const sortBy = (params?.sortBy as any) || "highest_outstanding";

  const res = await getAllDeals({ filter, sortBy });

  if (!res.success) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center p-6">
        <AlertCircle className="mb-4 h-10 w-10 text-rose-500" />
        <h2 className="text-xl font-bold text-slate-900">Failed to load deals</h2>
        <p className="mt-2 text-sm text-slate-500">{res.error || "An unexpected error occurred"}</p>
      </div>
    );
  }

  return (
    <DealsWorkspace 
      initialDeals={res.data.deals} 
      initialMetrics={res.data.metrics} 
    />
  );
}
