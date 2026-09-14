import { CalendarClock, LayoutDashboard, Settings, UsersRound } from "lucide-react";

export const crmNavigation = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/leads", icon: UsersRound },
  { label: "Follow-ups", href: "/follow-ups", icon: CalendarClock },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;
