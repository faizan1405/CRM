"use client";

import type { BriefingPaymentItem } from "../types";
import { CreditCard, IndianRupee, ArrowRight, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export type PaymentToChaseProps = {
  payment?: BriefingPaymentItem | null;
  onOpenLead?: (leadId: string) => void;
  className?: string;
};

export function PaymentToChase({
  payment,
  onOpenLead,
  className = "",
}: PaymentToChaseProps) {
  const router = useRouter();

  const handleActivate = () => {
    if (payment?.leadId && onOpenLead) {
      onOpenLead(payment.leadId);
    } else {
      router.push("/deals");
    }
  };

  return (
    <section
      aria-label="Payment to Chase"
      className={`rounded-2xl border border-slate-200 dark:border-border bg-white dark:bg-card p-4 sm:p-5 shadow-xs ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-border/60">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <IndianRupee size={13} />
          </span>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Payment to Chase
          </h2>
        </div>
        {payment && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
              payment.isOverdue
                ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50"
                : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50"
            }`}
          >
            {payment.isOverdue ? "Overdue" : "Pending"}
          </span>
        )}
      </div>

      {/* Content or Empty State */}
      {!payment ? (
        <div className="flex flex-col items-center justify-center py-7 text-center">
          <div className="grid size-9 place-items-center rounded-full bg-slate-100 dark:bg-muted text-slate-400">
            <CheckCircle size={18} />
          </div>
          <p className="mt-2 text-xs font-semibold text-foreground">
            No overdue payments
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            All deal collections and milestones are current.
          </p>
        </div>
      ) : (
        <div
          onClick={handleActivate}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleActivate();
            }
          }}
          className="group mt-3 flex flex-col gap-2.5 rounded-xl border border-slate-100 dark:border-border/60 bg-slate-50/70 dark:bg-muted/20 p-3.5 hover:border-slate-300 dark:hover:border-border transition-all cursor-pointer"
        >
          {/* Amount row */}
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[22px] sm:text-[24px] font-bold tabular tracking-tight text-foreground">
                {payment.amountFormatted}
              </div>
              <div className="text-[11px] font-medium text-muted-foreground">
                {payment.dueDateFormatted || "Outstanding milestone balance"}
              </div>
            </div>

            <div className="grid size-7 place-items-center rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card text-muted-foreground group-hover:text-foreground group-hover:border-slate-300 transition-colors shadow-2xs">
              <ArrowRight size={13} />
            </div>
          </div>

          {/* Client & Company */}
          <div className="flex items-center gap-1.5 pt-1 text-xs">
            <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {payment.clientName}
            </span>
            {payment.companyName && (
              <>
                <span className="text-muted-foreground">&middot;</span>
                <span className="text-muted-foreground truncate">
                  {payment.companyName}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
