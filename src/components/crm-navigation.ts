import { BarChart3, CalendarClock, Kanban, LayoutDashboard, Settings, UsersRound, Bell, MessageSquare } from "lucide-react";

export const crmNavigation = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/leads", icon: UsersRound },
  { label: "Pipeline", href: "/pipeline", icon: Kanban },
  { label: "Follow-ups", href: "/follow-ups", icon: CalendarClock },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "WhatsApp", href: "/whatsapp-templates", icon: MessageSquare },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;
