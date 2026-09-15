import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { type AttentionPriority } from "../types";

interface AttentionPriorityBadgeProps {
  priority: AttentionPriority;
  size?: "sm" | "md";
  showIcon?: boolean;
  className?: string;
}

export function AttentionPriorityBadge({
  priority,
  size = "md",
  showIcon = true,
  className = "",
}: AttentionPriorityBadgeProps) {
  const config = {
    critical: {
      label: "Critical",
      icon: AlertCircle,
      badgeStyle: "bg-red-500 text-white border-red-600 shadow-sm",
      iconColor: "text-white",
      ariaLabel: "Priority: Critical attention required",
    },
    important: {
      label: "Important",
      icon: AlertTriangle,
      badgeStyle: "bg-amber-100 text-amber-900 border-amber-300",
      iconColor: "text-amber-700",
      ariaLabel: "Priority: Important attention required",
    },
    normal: {
      label: "Normal",
      icon: CheckCircle2,
      badgeStyle: "bg-slate-100 text-slate-700 border-slate-200",
      iconColor: "text-slate-500",
      ariaLabel: "Priority: Normal",
    },
  }[priority] || {
    label: "Normal",
    icon: CheckCircle2,
    badgeStyle: "bg-slate-100 text-slate-700 border-slate-200",
    iconColor: "text-slate-500",
    ariaLabel: "Priority: Normal",
  };

  const Icon = config.icon;
  const isSm = size === "sm";

  return (
    <span
      role="status"
      aria-label={config.ariaLabel}
      className={`inline-flex items-center gap-1 rounded-md border font-semibold uppercase tracking-wider ${
        isSm ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      } ${config.badgeStyle} ${className}`}
    >
      {showIcon && <Icon size={isSm ? 10 : 12} className={config.iconColor} aria-hidden="true" />}
      <span>{config.label}</span>
    </span>
  );
}
