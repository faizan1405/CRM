import Link from "next/link";
import { ArrowRight, Phone, MessageCircle } from "lucide-react";
import { cleanLeadName } from "@/features/leads/formatters";
import { telLink, waLink } from "@/lib/crm/format";
import { cn } from "@/lib/utils";

export type TodayPriorityItem = {
  id: string;
  leadId: string;
  leadName: string;
  phone?: string;
  business?: string;
  time: string;
  note?: string;
  actionNeeded?: string;
  isOverdue?: boolean;
};

export type TodaysPrioritiesCardProps = {
  priorities: TodayPriorityItem[];
  totalScheduledCount: number;
};

export function TodaysPrioritiesCard({
  priorities = [],
  totalScheduledCount = 0,
}: TodaysPrioritiesCardProps) {
  return (
    <div className="rise flex flex-col justify-between overflow-hidden rounded-[var(--radius-xl)] bg-ink text-ink-foreground shadow-[var(--shadow-lift)] p-5 sm:p-6">
      <div>
        <div className="flex items-center justify-between pb-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-muted">
              Today&apos;s priorities
            </div>
            <div className="mt-1 text-[15px] font-semibold">
              {priorities.length > 0
                ? `${priorities.length} conversations to have`
                : "Nothing due right now"}
            </div>
          </div>
          <Link
            href="/follow-ups?filter=today"
            className="press grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-ink-line hover:text-ink-foreground"
            aria-label="All follow-ups"
          >
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <ol className="divide-y divide-ink-line/40">
          {priorities.map((item, index) => {
            const isOverdue = item.isOverdue || item.actionNeeded?.toLowerCase().includes("overdue");
            const cleanName = cleanLeadName(item.leadName);
            const secondaryText = item.note || item.business || item.actionNeeded;

            return (
              <li
                key={item.id}
                className="group flex items-center gap-3 py-2.5 transition-colors hover:bg-ink-line/40 px-1.5 rounded-lg"
              >
                <span className="w-4 shrink-0 text-[12px] tabular text-ink-muted">
                  {index + 1}
                </span>

                <Link
                  href={`/leads?selected=${encodeURIComponent(item.leadId)}`}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate text-[13.5px] font-medium text-ink-foreground group-hover:underline">
                    {cleanName}
                  </div>
                  <div className="truncate text-[12px] text-ink-muted">
                    <span
                      className={cn(
                        "tabular",
                        isOverdue && "font-semibold text-[oklch(0.78_0.12_30)]"
                      )}
                    >
                      {isOverdue ? "Overdue" : item.time}
                    </span>
                    {secondaryText && ` · ${secondaryText}`}
                  </div>
                </Link>

                <div className="flex shrink-0 items-center gap-1">
                  {item.phone && (
                    <a
                      href={telLink(item.phone)}
                      aria-label={`Call ${cleanName}`}
                      className="press grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-ink-line hover:text-ink-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="h-[15px] w-[15px]" />
                    </a>
                  )}

                  {item.phone && (
                    <a
                      href={waLink(item.phone)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`WhatsApp ${cleanName}`}
                      className="press grid h-8 w-8 place-items-center rounded-lg text-sidebar-primary hover:bg-ink-line"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MessageCircle className="h-[15px] w-[15px]" />
                    </a>
                  )}

                  <Link
                    href={`/leads?selected=${encodeURIComponent(item.leadId)}`}
                    aria-label={`Open details for ${cleanName}`}
                    className="press grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-ink-line hover:text-ink-foreground"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </li>
            );
          })}

          {priorities.length === 0 && (
            <li className="py-8 text-center text-[13px] text-ink-muted">
              All caught up for today! Add or schedule follow-ups from any lead.
            </li>
          )}
        </ol>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-ink-line/50 pt-3 text-[12px] text-ink-muted">
        <span>{totalScheduledCount} scheduled today</span>
        <Link
          href="/daily-briefing"
          className="text-sidebar-primary hover:underline font-medium text-[12px]"
        >
          Open Daily Briefing &rarr;
        </Link>
      </div>
    </div>
  );
}
