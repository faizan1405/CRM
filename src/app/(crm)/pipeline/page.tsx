import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getLeads } from "@/app/actions/leads";
import { PipelineBoard } from "@/features/pipeline/pipeline-board";
import { PageHeader } from "@/components/page-header";
import { PipelineSkeleton } from "@/components/skeletons";

export const metadata: Metadata = { title: "Sales Pipeline" };

export default async function PipelinePage() {
  const result = await getLeads();
  
  if (!result.success && result.error.includes("signed in")) {
    redirect("/login");
  }

  const initialLeads = result.success ? result.data : [];

  return (
    <div className="flex w-full min-w-0 flex-col space-y-6">
      <div className="shrink-0">
        <PageHeader 
          title="Sales Pipeline" 
          description="Drag and drop leads across stages to update their progress." 
        />
      </div>
      <div className="w-full min-w-0 flex-1">
        <Suspense fallback={<PipelineSkeleton includeHeader={false} />}>
          <PipelineBoard initialLeads={initialLeads} />
        </Suspense>
      </div>
    </div>
  );
}
