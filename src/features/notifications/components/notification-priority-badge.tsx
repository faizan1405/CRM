import { AlertOctagon, AlertTriangle, Info } from "lucide-react";
import type { NotificationPriority } from "../types";

interface NotificationPriorityBadgeProps {
  priority: NotificationPriority;
  size?: "sm" | "md";
  className?: string;
}

export function NotificationPriorityBadge({
  priority,
  size = "md",
  className = "",
}: NotificationPriorityBadgeProps) {
  const config = {
    critical: {
      label: "Critical",
      icon: AlertOctagon,
      badge: "bg-rose-50 text-rose-700 border-rose-200",
      dot: "bg-rose-600",
      ariaLabel: "Priority: Critical attention required",
    },
    important: {
      label: "Important",
      icon: AlertTriangle,
      badge: "bg-amber-50 text-amber-800 border-amber-200",
      dot: "bg-amber-500",
      ariaLabel: "Priority: Important",
    },
    normal: {
      label: "Normal",
      icon: Info,
      badge: "bg-slate-100 text-slate-700 border-slate-200",
      dot: "bg-slate-400",
      ariaLabel: "Priority: Normal",
    },
  }[priority];

  const Icon = config.icon;
  const isSm = size === "sm";

  return (
    <span
      role="status"
      aria-label={config.ariaLabel}
      className={`inline-flex items-center gap-1.5 rounded-md border font-bold uppercase tracking-wider ${
        isSm ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      } ${config.badge} ${className}`}
    >
      <Icon size={isSm ? 11 : 13} className="shrink-0" aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}
