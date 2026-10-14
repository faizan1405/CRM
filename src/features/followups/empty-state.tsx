import { CircleCheckBig } from "lucide-react";
import { EmptyState } from "@/components/crm/primitives";

export function FollowUpEmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <EmptyState
        icon={CircleCheckBig}
        title={title}
        text={description || "They will show up here once scheduled."}
      />
    </div>
  );
}
