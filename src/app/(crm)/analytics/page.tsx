import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAnalyticsData } from "@/app/actions/analytics";
import { getLostReasonsAnalytics } from "@/app/actions/lost-reasons";
import { AnalyticsDashboard } from "@/features/analytics/components/analytics-dashboard";
import type { AnalyticsDateRange } from "@/features/analytics/types";
import { AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "Sales Analytics",
  description: "Sales performance, funnel, revenue, pipeline, and follow-up analytics.",
};

const validRanges = new Set<AnalyticsDateRange>(["7d", "30d", "90d", "all"]);

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const requestedRange = (await searchParams).range;
  const selectedRange: AnalyticsDateRange =
    requestedRange && validRanges.has(requestedRange as AnalyticsDateRange)
      ? (requestedRange as AnalyticsDateRange)
      : "30d";

  const [result, lostReasonsResult] = await Promise.all([
    getAnalyticsData(selectedRange),
    getLostReasonsAnalytics(selectedRange)
  ]);

  if (!result.success || !lostReasonsResult.success) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <AlertTriangle className="mb-4 h-10 w-10 text-red-500" />
        <h2 className="text-xl font-bold text-slate-900">Failed to load analytics</h2>
        <p className="mt-2 text-slate-500">{!result.success ? result.error : !lostReasonsResult.success ? lostReasonsResult.error : "An unknown error occurred"}</p>
      </div>
    );
  }

  return <AnalyticsDashboard data={result.data} lostReasons={lostReasonsResult.data!} selectedRange={selectedRange} />;
}
