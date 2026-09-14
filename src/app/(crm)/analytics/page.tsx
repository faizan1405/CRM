import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAnalyticsData } from "@/app/actions/analytics";
import { AlertTriangle, BarChart2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Sales analytics and performance insights for Scale Flow CRM.",
};

/**
 * Analytics Page – Phase 6 Shell
 *
 * This page is the authenticated entry point for the /analytics route.
 * It loads the full analytics payload server-side and passes it to UI components.
 *
 * Agent B will replace the placeholder body with the full analytics UI.
 * Do NOT redesign this; just build on top of the data already exposed here.
 *
 * Supported URL params:
 *   ?range=7d | 30d | 90d | all   (default: 30d)
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  // Server-side auth guard (proxy handles redirect for unauthenticated,
  // but we double-check here for defence-in-depth)
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { range = "30d" } = await searchParams;

  const result = await getAnalyticsData(range);

  if (!result.success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <AlertTriangle className="h-10 w-10 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-900">
          Failed to load analytics
        </h2>
        <p className="text-slate-500 mt-2">
          {result.error ?? "An unknown error occurred"}
        </p>
      </div>
    );
  }

  const { data } = result;

  return (
    <div className="space-y-6 pb-12">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
          <BarChart2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Analytics
          </h1>
          <p className="text-sm text-slate-500">
            Sales performance insights · {data.meta.dateRange === "all"
              ? "All Time"
              : data.meta.dateRange === "7d"
              ? "Last 7 Days"
              : data.meta.dateRange === "30d"
              ? "Last 30 Days"
              : "Last 90 Days"}
          </p>
        </div>
      </div>

      {/* Data coverage warning */}
      {data.dataCoverage.funnelWarning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Note:</strong> Activity tracking began on{" "}
          {data.dataCoverage.activityHistoryCoverageStart
            ? new Date(
                data.dataCoverage.activityHistoryCoverageStart
              ).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })
            : "an unknown date"}
          . Historical stage data for{" "}
          <strong>{data.dataCoverage.legacyLeadCount}</strong> legacy leads may
          be incomplete. Funnel stage conversions may not be fully accurate.
        </div>
      )}

      {/*
       * ───────────────────────────────────────────────────────────────────────
       * PLACEHOLDER – Agent B replaces everything below with the full UI.
       * The `data` object is fully typed and ready to consume.
       * ───────────────────────────────────────────────────────────────────────
       */}
      <div className="rounded-2xl border bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <p className="text-sm font-medium text-slate-500 mb-4">
          Analytics UI coming soon. Data is loaded and ready for Agent B.
        </p>

        {process.env.NODE_ENV === "development" && (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-mono text-slate-400 hover:text-slate-600">
              [dev] View raw analytics payload
            </summary>
            <pre className="mt-3 overflow-auto rounded-lg bg-slate-950 p-4 text-[11px] leading-relaxed text-green-400 max-h-[600px]">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
