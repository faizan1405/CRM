import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getLeads } from "@/app/actions/leads";
import { PipelineBoard } from "@/features/pipeline/pipeline-board";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Sales Pipeline" };

export default async function PipelinePage() {
  const result = await getLeads();
  
  if (!result.success && result.error.includes("signed in")) {
    redirect("/login");
  }

  const initialLeads = result.success ? result.data : [];

  return (
    <div className="flex h-full flex-col space-y-3 sm:space-y-6">
      <div className="shrink-0">
        <PageHeader 
          title="Sales Pipeline" 
          description="Drag and drop leads across stages to update their progress." 
        />
      </div>
      <div className="flex-1 min-h-0">
        <Suspense fallback={<div className="p-6 text-slate-500">Loading pipeline...</div>}>
          <PipelineBoard initialLeads={initialLeads} />
        </Suspense>
      </div>
    </div>
  );
}
