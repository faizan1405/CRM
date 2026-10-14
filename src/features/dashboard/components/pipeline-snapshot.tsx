import Link from "next/link";
import { cn } from "@/lib/utils";

export function PipelineSnapshot({
  data,
}: {
  data: { new: number; contacted: number; qualified: number; proposal: number; won: number; lost: number };
}) {
  const pipelineStages = [
    { name: "New", count: data.new, color: "bg-info", param: "NEW" },
    { name: "Contacted", count: data.contacted, color: "bg-subtle", param: "CONTACTED" },
    { name: "Qualified", count: data.qualified, color: "bg-chart-2", param: "QUALIFIED" },
    { name: "Proposal", count: data.proposal, color: "bg-warning", param: "PROPOSAL_SENT" },
    { name: "Won", count: data.won, color: "bg-primary", param: "WON" },
  ];

  const total = pipelineStages.reduce((sum, stage) => sum + stage.count, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Visual Multi-Color Progress Bar */}
      <div className="flex h-2.5 w-full gap-[3px] overflow-hidden rounded-full bg-muted">
        {pipelineStages.map((stage) => {
          const width = total > 0 ? `${(stage.count / total) * 100}%` : "0%";
          return (
            <div
              key={stage.name}
              style={{ width }}
              className={cn("grow-x h-full transition-all duration-300", stage.color)}
              title={`${stage.name}: ${stage.count}`}
            />
          );
        })}
      </div>

      {/* Stage Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {pipelineStages.map((stage) => (
          <Link
            key={stage.name}
            href={`/pipeline?stage=${stage.param}`}
            className="press group flex flex-col items-center justify-center rounded-xl bg-muted/60 p-3 transition-colors hover:bg-muted"
          >
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground font-medium">
              <span className={cn("h-2 w-2 rounded-sm shrink-0", stage.color)} />
              <span>{stage.name}</span>
            </div>
            <span className="mt-1 text-[18px] font-semibold tabular text-foreground">
              {stage.count}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
