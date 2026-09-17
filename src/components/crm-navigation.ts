import { BarChart3, CalendarClock, Kanban, LayoutDashboard, Settings, UsersRound, Bell, Briefcase, StickyNote, BookOpen, Trash2 } from "lucide-react";

export const crmNavigation = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/leads", icon: UsersRound },
  { label: "Pipeline", href: "/pipeline", icon: Kanban },
  { label: "Follow-ups", href: "/follow-ups", icon: CalendarClock },
  { label: "Personal Notes", href: "/personal-notes", icon: StickyNote },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Sales Assets", href: "/sales-assets", icon: Briefcase },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Guide", href: "/guide", icon: BookOpen },
  { label: "Recently Deleted", href: "/recently-deleted", icon: Trash2 },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;

