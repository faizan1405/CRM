import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getLeads } from "@/app/actions/leads";
import { PipelineBoard } from "@/features/pipeline/pipeline-board";
import { PipelineSkeleton } from "@/components/skeletons";

export const metadata: Metadata = { title: "Sales Pipeline" };

async function PipelineContent() {
  const result = await getLeads();

  if (!result.success && result.error.includes("signed in")) {
    redirect("/login");
  }

  const initialLeads = result.success ? result.data : [];

  return <PipelineBoard initialLeads={initialLeads} />;
}

export default function PipelinePage() {
  return (
    <div className="flex w-full min-w-0 flex-col">
      <Suspense fallback={<PipelineSkeleton includeHeader={false} />}>
        <PipelineContent />
      </Suspense>
    </div>
  );
}
