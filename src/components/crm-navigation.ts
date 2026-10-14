import {
  CalendarClock,
  HandCoins,
  KanbanSquare,
  LayoutDashboard,
  NotebookPen,
  Settings,
  Sunrise,
  TrendingUp,
  Users,
} from "lucide-react";

export const crmNavigationGroups = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Daily Briefing", href: "/daily-briefing", icon: Sunrise },
      { label: "Leads", href: "/leads", icon: Users },
      { label: "Pipeline", href: "/pipeline", icon: KanbanSquare },
      { label: "Follow-ups", href: "/follow-ups", icon: CalendarClock },
    ],
  },
  {
    label: "Revenue",
    items: [
      { label: "Deals & Payments", href: "/deals", icon: HandCoins },
      { label: "Analytics", href: "/analytics", icon: TrendingUp },
    ],
  },
  {
    label: "Personal",
    items: [
      { label: "Personal Notes", href: "/personal-notes", icon: NotebookPen },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
] as const;

export const crmNavigation = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Daily Briefing", href: "/daily-briefing", icon: Sunrise },
  { label: "Leads", href: "/leads", icon: Users },
  { label: "Pipeline", href: "/pipeline", icon: KanbanSquare },
  { label: "Follow-ups", href: "/follow-ups", icon: CalendarClock },
  { label: "Deals & Payments", href: "/deals", icon: HandCoins },
  { label: "Personal Notes", href: "/personal-notes", icon: NotebookPen },
  { label: "Analytics", href: "/analytics", icon: TrendingUp },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;
