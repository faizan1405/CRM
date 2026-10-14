import Link from "next/link";
import { cn } from "@/lib/utils";
import { inrCompact } from "@/lib/crm/format";

export type PipelineStageCounts = {
  new: number;
  contacted: number;
  qualified: number;
  proposal: number;
  won: number;
  lost: number;
};

export type PipelineStageValues = {
  new: number;
  contacted: number;
  qualified: number;
  proposal: number;
  won: number;
  lost: number;
  total: number;
};

export function PipelineSnapshot({
  data,
  values,
}: {
  data: PipelineStageCounts;
  values?: PipelineStageValues;
}) {
  const pipelineStages = [
    {
      key: "new" as const,
      name: "New",
      count: data.new,
      value: values?.new ?? 0,
      color: "bg-info",
      param: "NEW",
    },
    {
      key: "contacted" as const,
      name: "Contacted",
      count: data.contacted,
      value: values?.contacted ?? 0,
      color: "bg-subtle",
      param: "CONTACTED",
    },
    {
      key: "qualified" as const,
      name: "Qualified",
      count: data.qualified,
      value: values?.qualified ?? 0,
      color: "bg-chart-2",
      param: "QUALIFIED",
    },
    {
      key: "proposal" as const,
      name: "Proposal",
      count: data.proposal,
      value: values?.proposal ?? 0,
      color: "bg-warning",
      param: "PROPOSAL_SENT",
    },
    {
      key: "won" as const,
      name: "Won",
      count: data.won,
      value: values?.won ?? 0,
      color: "bg-primary",
      param: "WON",
    },
  ];

  const totalValue =
    values?.total ??
    pipelineStages.reduce((sum, s) => sum + s.value, 0);

  const totalCount = pipelineStages.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Lovable Segmented Multi-Color Pipeline Bar */}
      <div className="flex h-2.5 w-full gap-[3px] overflow-hidden rounded-full bg-muted">
        {pipelineStages.map((stage) => {
          let width = "0%";
          if (totalValue > 0 && stage.value > 0) {
            width = `${(stage.value / totalValue) * 100}%`;
          } else if (totalCount > 0 && stage.count > 0) {
            width = `${(stage.count / totalCount) * 100}%`;
          }

          return (
            <div
              key={stage.key}
              style={{ width }}
              className={cn("grow-x h-full transition-all duration-300", stage.color)}
              title={`${stage.name}: ${stage.count} leads (${inrCompact(stage.value)})`}
            />
          );
        })}
      </div>

      {/* 2. Lovable 5-Column Stage Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {pipelineStages.map((stage) => (
          <Link
            key={stage.key}
            href={`/pipeline?stage=${stage.param}`}
            className="press group flex flex-col justify-between rounded-xl border border-border/40 bg-card p-3 transition-colors hover:bg-muted/50 hover:border-border"
          >
            <div className="flex items-center gap-1.5 truncate text-[12px] text-muted-foreground">
              <span className={cn("h-2 w-2 shrink-0 rounded-sm", stage.color)} />
              <span className="font-medium">{stage.name}</span>
            </div>

            <div className="mt-2">
              <div className="text-[16px] font-semibold tabular text-foreground sm:text-[18px]">
                {inrCompact(stage.value)}
              </div>
              <div className="mt-0.5 text-[11.5px] text-subtle tabular">
                {stage.count} {stage.count === 1 ? "lead" : "leads"}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
