"use client";

import { useDialogAccessibility } from "@/components/use-dialog-accessibility";
import { useEffect, useRef, ReactNode } from "react";

type BottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  headerIcon?: ReactNode;
  saving?: boolean;
  fullHeight?: boolean;
};

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  footer,
  headerIcon,
  saving = false,
  fullHeight = false,
}: BottomSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useDialogAccessibility(isOpen, onClose, saving, closeButtonRef);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] flex h-[100dvh] items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close dialog"
        onClick={onClose}
        disabled={saving}
        className="absolute inset-0 bg-slate-950/45 transition-opacity"
      />
      <aside
        className={`relative flex w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl border border-slate-200 animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 ${
          fullHeight ? "max-h-[92dvh] h-[92dvh]" : "max-h-[92dvh]"
        }`}
      >
        {/* Drag Indicator for Mobile */}
        <div className="flex w-full items-center justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1.5 w-10 rounded-full bg-slate-300" />
        </div>

        {title && (
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-3 sm:px-6 sm:pt-5">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 flex items-center gap-2">
              {headerIcon}
              {title}
            </h2>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              disabled={saving}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 -mt-1 -mr-2"
            >
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-safe">
          {children}
        </div>

        {footer && (
          <footer className="border-t border-slate-100 p-4 bg-slate-50/50 rounded-b-2xl sm:rounded-b-2xl pb-safe flex gap-2">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
}
