"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export function DeleteConfirmDialog({
  isOpen,
  title,
  onConfirm,
  onCancel,
  isDeleting = false,
}: DeleteConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isDeleting, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
        onClick={isDeleting ? undefined : onCancel}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl transition-all"
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={isDeleting}
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          aria-label="Close dialog"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className="flex items-start gap-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
            <AlertTriangle size={22} aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 id="delete-dialog-title" className="text-base font-bold text-slate-950">
              Delete Personal Note?
            </h3>
            <p id="delete-dialog-description" className="mt-1.5 text-sm text-slate-600">
              Are you sure you want to delete <span className="font-semibold text-slate-900">&ldquo;{title || "Untitled Note"}&rdquo;</span>? This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white shadow-xs hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50"
          >
            <Trash2 size={16} aria-hidden="true" />
            <span>{isDeleting ? "Deleting..." : "Delete Note"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
