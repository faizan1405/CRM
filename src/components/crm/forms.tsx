import { forwardRef, useId, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Loader2, ChevronDown, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-lg bg-card text-[13.5px] text-foreground shadow-[inset_0_0_0_1px_var(--input)] outline-none transition-[box-shadow,background-color] duration-150 placeholder:text-subtle hover:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_22%,var(--input))] focus:shadow-[inset_0_0_0_1px_var(--ring),0_0_0_3px_color-mix(in_oklab,var(--ring)_16%,transparent)] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-[invalid=true]:shadow-[inset_0_0_0_1px_var(--destructive),0_0_0_3px_color-mix(in_oklab,var(--destructive)_12%,transparent)]";

export function Field({ label, hint, error, optional, children, className }: { label: string; hint?: string | undefined; error?: string | undefined; optional?: boolean | undefined; children: (id: string) => ReactNode; className?: string | undefined }) {
  const id = useId();
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <label htmlFor={id} className="flex items-baseline justify-between text-[12.5px] font-medium">
        {label}{optional && <span className="font-normal text-subtle">Optional</span>}
      </label>
      {children(id)}
      {error ? <p className="flex items-center gap-1 text-[12px] text-destructive"><AlertCircle className="h-3 w-3" />{error}</p>
        : hint ? <p className="text-[12px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { prefix?: string }>(({ className, prefix, ...p }, ref) =>
  prefix ? (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13.5px] text-muted-foreground">{prefix}</span>
      <input ref={ref} className={cn(base, "h-10 pl-7 pr-3 tabular md:h-9", className)} {...p} />
    </div>
  ) : <input ref={ref} className={cn(base, "h-10 px-3 md:h-9", className)} {...p} />);
TextInput.displayName = "TextInput";

export function SelectInput({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(base, "h-10 appearance-none pl-3 pr-8 md:h-9", className)} {...p}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
    </div>
  );
}

export function TextArea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, "min-h-[88px] resize-y px-3 py-2.5 leading-relaxed", className)} {...p} />;
}

export function ChoiceChips<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: ReactNode }[]; className?: string | undefined }) {
  return (
    <div role="radiogroup" className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={cn("press inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-all duration-150",
              on ? "bg-foreground text-background shadow-sm" : "bg-card text-muted-foreground shadow-[inset_0_0_0_1px_var(--input)] hover:text-foreground")}>
            {o.icon}{o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SubmitButton({ loading, children, ...p }: ButtonProps & { loading?: boolean }) {
  return (
    <Button type="submit" disabled={loading || p.disabled} {...p}>
      {loading && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

/** Dialog on desktop, bottom sheet on phones. */
export function ResponsiveModal({ open, onOpenChange, title, description, children, footer, wide }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const mobile = useIsMobile();
  if (mobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="flex max-h-[92dvh] flex-col gap-0 rounded-t-[22px] border-0 p-0">
          <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-border" />
          <SheetHeader className="space-y-0.5 px-5 pb-4 pt-4 text-left">
            <SheetTitle className="text-[17px] font-semibold tracking-tight">{title}</SheetTitle>
            {description && <SheetDescription className="text-[13px]">{description}</SheetDescription>}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          {footer && <div className="grid grid-cols-2 gap-2 border-t bg-card px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">{footer}</div>}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("gap-0 border-0 p-0 shadow-[var(--shadow-float)]", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}>
        <DialogHeader className="space-y-1 px-6 pb-4 pt-6 text-left">
          <DialogTitle className="pr-6 text-[17px] font-semibold tracking-tight">{title}</DialogTitle>
          {description && <DialogDescription className="text-[13px]">{description}</DialogDescription>}
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto px-6 pb-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 rounded-b-2xl border-t bg-muted/40 px-6 py-3.5">{footer}</div>}
      </DialogContent>
    </Dialog>
  );
}

/** Wait helper so demo "saving" states are visible. */
export const demoDelay = (ms = 650) => new Promise((r) => setTimeout(r, ms));
