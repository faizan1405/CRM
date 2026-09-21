"use client";

import { createContext, useContext, useCallback, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { performUndo } from "@/app/actions/undo";

type ToastVariant = "success" | "error" | "info" | "warning";

type ToastAction = {
  label: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
};

type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
  action?: ToastAction;
};

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant, action?: ToastAction) => string;
  showUndoToast: (message: string, undoActionId: string, onUndone?: () => void) => string;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles: Record<ToastVariant, { bg: string; text: string; icon: ReactNode }> = {
  success: {
    bg: "bg-emerald-50 border-emerald-200 text-emerald-800",
    text: "text-emerald-700",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ),
  },
  error: {
    bg: "bg-red-50 border-red-200 text-red-800",
    text: "text-red-700",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  warning: {
    bg: "bg-amber-50 border-amber-200 text-amber-800",
    text: "text-amber-700",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  info: {
    bg: "bg-blue-50 border-blue-200 text-blue-800",
    text: "text-blue-700",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    ),
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingUndos = useRef<Set<string>>(new Set());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "success", action?: ToastAction) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev, { id, message, variant, action }]);

      // Increase time if there's an action (7 seconds window for undo)
      const duration = action ? 7000 : 3200;
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);

      return id;
    },
    [dismiss],
  );

  const showUndoToast = useCallback(
    (message: string, undoActionId: string, onUndone?: () => void) => {
      if (!undoActionId) {
        return showToast(message, "success");
      }

      const toastId = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const handleUndo = async () => {
        if (pendingUndos.current.has(undoActionId)) return;
        pendingUndos.current.add(undoActionId);

        // Update toast action label to "Undoing..."
        setToasts((prev) =>
          prev.map((t) =>
            t.id === toastId
              ? {
                  ...t,
                  action: {
                    label: "Undoing...",
                    disabled: true,
                    onClick: () => {},
                  },
                }
              : t
          )
        );

        try {
          const res = await performUndo(undoActionId);
          dismiss(toastId);

          if (res.success) {
            showToast(res.message || "Undo successful", "success");
            try {
              router.refresh();
            } catch {}
            if (onUndone) {
              try {
                onUndone();
              } catch {}
            }
          } else {
            showToast(res.error || "Unable to undo action.", "error");
          }
        } catch {
          dismiss(toastId);
          showToast("Failed to undo action.", "error");
        } finally {
          pendingUndos.current.delete(undoActionId);
        }
      };

      const action: ToastAction = {
        label: "Undo",
        onClick: handleUndo,
      };

      setToasts((prev) => [...prev, { id: toastId, message, variant: "success", action }]);
      const timer = setTimeout(() => dismiss(toastId), 7500);
      timers.current.set(toastId, timer);

      return toastId;
    },
    [dismiss, router, showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, showUndoToast }}>
      {children}

      {/* Toast container */}
      <div
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+80px)] md:bottom-6 right-4 left-4 md:left-auto md:w-96 z-50 flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto motion-safe:animate-toast-in flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-elevated ${variantStyles[toast.variant].bg} ${variantStyles[toast.variant].text}`}
            role="alert"
          >
            <span className="shrink-0">{variantStyles[toast.variant].icon}</span>
            <span className="flex-1 min-w-0 font-semibold">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                disabled={toast.action.disabled}
                onClick={async () => {
                  if (toast.action?.disabled) return;
                  await toast.action!.onClick();
                  if (!toast.action?.disabled) {
                    dismiss(toast.id);
                  }
                }}
                className={`shrink-0 rounded-lg bg-white/60 px-3 min-h-[44px] flex items-center justify-center text-sm font-bold shadow-sm transition-colors ${
                  toast.action.disabled
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-white/90 active:scale-95 cursor-pointer"
                }`}
              >
                {toast.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded-lg min-h-[44px] w-[44px] flex items-center justify-center -mr-2 opacity-60 hover:opacity-100 hover:bg-black/5 transition-all active:scale-95"
              aria-label="Dismiss"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const defaultToastContext: ToastContextValue = {
  showToast: () => "",
  showUndoToast: () => "",
};

export function useToast() {
  const ctx = useContext(ToastContext);
  return ctx || defaultToastContext;
}

