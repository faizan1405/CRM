import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

type PlaceholderPageProps = { title: string; description: string; message: string; icon: LucideIcon };

export function PlaceholderPage({ title, description, message, icon }: PlaceholderPageProps) {
  return (
    <div className="space-y-7">
      <PageHeader title={title} description={description} />
      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-6">
        <EmptyState title={message} description="This area is ready for a future CRM phase." icon={icon} />
      </section>
    </div>
  );
}
