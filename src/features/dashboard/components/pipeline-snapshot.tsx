import Link from "next/link";

export function PipelineSnapshot({ data }: { data: { new: number; contacted: number; qualified: number; proposal: number; won: number; lost: number } }) {
  const pipelineStages = [
    { name: "New", count: data.new, color: "bg-blue-500", text: "text-blue-700" },
    { name: "Contacted", count: data.contacted, color: "bg-cyan-500", text: "text-cyan-700" },
    { name: "Qualified", count: data.qualified, color: "bg-purple-500", text: "text-purple-700" },
    { name: "Proposal", count: data.proposal, color: "bg-amber-500", text: "text-amber-700" },
    { name: "Won", count: data.won, color: "bg-green-500", text: "text-green-700" },
  ];

  const total = pipelineStages.reduce((sum, stage) => sum + stage.count, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Visual Progress Bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {pipelineStages.map((stage) => {
          const width = total > 0 ? `${(stage.count / total) * 100}%` : "0%";
          return (
            <div
              key={stage.name}
              style={{ width }}
              className={`h-full ${stage.color} transition-all duration-150`}
              title={`${stage.name}: ${stage.count}`}
            />
          );
        })}
      </div>

      {/* Stage Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {pipelineStages.map((stage) => (
          <Link
            key={stage.name}
            href={`/pipeline?stage=${stage.name === "Proposal" ? "PROPOSAL_SENT" : stage.name.toUpperCase()}`}
            className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 flex flex-col items-center justify-center rounded-xl border bg-white p-3 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
          >
            <span className={`text-xl font-bold ${stage.text}`}>{stage.count}</span>
            <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {stage.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
