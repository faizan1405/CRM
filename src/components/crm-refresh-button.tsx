"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { refreshCrmAction } from "@/app/actions/refresh";

interface CrmRefreshButtonProps {
  variant?: "desktop" | "mobile";
  className?: string;
}

export function CrmRefreshButton({
  variant = "desktop",
  className = "",
}: CrmRefreshButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing || isPending) return;

    setIsRefreshing(true);
    const minSpinPromise = new Promise((resolve) => setTimeout(resolve, 600));

    try {
      const res = await refreshCrmAction(pathname);
      if (!res.success) {
        throw new Error(res.error || "Failed to revalidate server cache");
      }

      await new Promise<void>((resolve) => {
        startTransition(() => {
          router.refresh();
          resolve();
        });
      });

      await minSpinPromise;
      showToast("CRM refreshed", "success");
    } catch {
      showToast("Could not refresh CRM. Try again.", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  const isLoading = isRefreshing || isPending;

  const baseClasses =
    variant === "mobile"
      ? "grid size-10 place-items-center rounded-full text-slate-600 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-60 disabled:pointer-events-none cursor-pointer"
      : "grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={isLoading}
      aria-label="Refresh CRM"
      title="Refresh CRM"
      data-testid={variant === "mobile" ? "crm-refresh-button-mobile" : "crm-refresh-button-desktop"}
      className={`${baseClasses} ${className}`}
    >
      <RefreshCw
        size={variant === "mobile" ? 18 : 16}
        className={`shrink-0 transition-transform ${isLoading ? "animate-spin text-blue-500" : ""}`}
        aria-hidden="true"
      />
    </button>
  );
}
