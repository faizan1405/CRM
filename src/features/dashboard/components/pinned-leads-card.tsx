import Link from "next/link";
import { Star } from "lucide-react";
import { Avatar, Card, Pill, SectionHead } from "@/components/crm/primitives";
import { inr } from "@/lib/crm/format";
import { cleanLeadName } from "@/features/leads/formatters";
import { leadStatusLabel, leadStatusTone } from "@/lib/crm/labels";
import type { LeadStatus } from "@/lib/crm/types";

export type PinnedLeadItem = {
  id: string;
  name: string;
  business?: string;
  value: number;
  status: string;
};

export function PinnedLeadsCard({
  leads = [],
  totalPinnedCount = 0,
}: {
  leads: PinnedLeadItem[];
  totalPinnedCount: number;
}) {
  return (
    <Card className="flex flex-col justify-between overflow-hidden rounded-[var(--radius-xl)] border border-border/60 shadow-[var(--shadow-card)]">
      <div>
        <SectionHead
          title="Pinned Leads"
          meta={`${totalPinnedCount} pinned`}
          action={
            <Link
              href="/leads?view=pinned"
              className="text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground flex items-center gap-1"
            >
              <span>View all</span>
              <Star className="h-3.5 w-3.5 fill-warning text-warning" />
            </Link>
          }
        />

        {leads.length > 0 ? (
          <ul className="px-2 pb-2 divide-y divide-border/40">
            {leads.map((lead) => {
              const cleanName = cleanLeadName(lead.name);
              const tone = leadStatusTone[lead.status as LeadStatus] || "neutral";
              const label = leadStatusLabel[lead.status as LeadStatus] || lead.status;

              return (
                <li key={lead.id}>
                  <Link
                    href={`/leads?selected=${encodeURIComponent(lead.id)}`}
                    className="press flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                  >
                    <Avatar name={cleanName} />

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium text-foreground">
                        {cleanName}
                      </div>
                      <div className="truncate text-[12px] text-muted-foreground">
                        {lead.business || "Individual client"}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-[13px] font-semibold tabular text-foreground">
                        {inr(lead.value)}
                      </div>
                      <div className="mt-0.5">
                        <Pill tone={tone} className="text-[10.5px] h-[19px] px-1.5">
                          {label}
                        </Pill>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">
            Pin important leads from their detail panel to keep them here.
          </div>
        )}
      </div>

      <div className="border-t border-border/60 px-5 py-3 text-[12px]">
        <Link
          href="/leads?view=pinned"
          className="font-medium text-primary hover:underline flex items-center justify-between"
        >
          <span>Open all pinned leads</span>
          <span className="tabular font-semibold">({totalPinnedCount}) &rarr;</span>
        </Link>
      </div>
    </Card>
  );
}
