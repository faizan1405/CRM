"use client";

import { createContext, useContext, useCallback, useRef, useState, type ReactNode } from "react";

type ToastVariant = "success" | "error" | "info" | "warning";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
  action?: ToastAction;
};

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant, action?: ToastAction) => void;
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
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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

      // Increase time if there's an action (5-8 seconds window for undo)
      const duration = action ? 6000 : 3200;
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);

      return id;
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container */}
      <div
        className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto motion-safe:animate-toast-in flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-sm ${variantStyles[toast.variant].bg} ${variantStyles[toast.variant].text}`}
            role="alert"
          >
            <span className="shrink-0">{variantStyles[toast.variant].icon}</span>
            <span className="flex-1 min-w-0">{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action!.onClick();
                  dismiss(toast.id);
                }}
                className="shrink-0 rounded bg-white/20 px-2.5 py-1 text-xs font-semibold hover:bg-white/30 transition-colors"
              >
                {toast.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
