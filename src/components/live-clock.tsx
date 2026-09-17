"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export function LiveClock() {
  const [dateStr, setDateStr] = useState<string>("");
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    // Only mount on client to avoid hydration mismatch
    const dateFormatter = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const timeFormatter = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    const updateTime = () => {
      const now = new Date();
      setDateStr(dateFormatter.format(now));
      setTimeStr(timeFormatter.format(now));
    };

    updateTime();
    // update every second to show running seconds live
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!dateStr || !timeStr) return <div className="h-4 w-32 animate-pulse bg-slate-200/50 rounded"></div>;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1.5 text-xs font-semibold text-slate-500">
      <div className="hidden sm:block"><Clock size={13} className="text-slate-400" /></div>
      <span>{dateStr}</span>
      <span className="hidden sm:inline text-slate-400">•</span>
      <span>{timeStr.toUpperCase()}</span>
    </div>
  );
}
