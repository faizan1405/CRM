import { CalendarClock, Check, Pencil } from "lucide-react";
import { useState, useRef } from "react";

type FollowUpSuggestionProps = {
  date: string;
  time: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
};

export function FollowUpSuggestion({
  date,
  time,
  onDateChange,
  onTimeChange,
}: FollowUpSuggestionProps) {
  const [accepted, setAccepted] = useState(Boolean(date));
  const [prevDate, setPrevDate] = useState(date);
  if (date !== prevDate) {
    setPrevDate(date);
    if (date) {
      setAccepted(true);
    }
  }
  const dateRef = useRef<HTMLInputElement>(null);

  let summary = "Not provided";
  if (date) {
    try {
      const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      });
      const formattedTime = time
        ? ` — ${new Date(`2000-01-01T${time}:00`).toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "Asia/Kolkata",
          })}`
        : "";
      summary = `${formattedDate}${formattedTime}`;
    } catch {
      summary = date;
    }
  }

  return (
    <section aria-labelledby="follow-up-suggestion-title" className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
      <div className="flex items-start gap-3">
        <CalendarClock aria-hidden="true" className="mt-0.5 shrink-0 text-blue-700" size={19} />
        <div className="min-w-0">
          <h3 id="follow-up-suggestion-title" className="text-sm font-semibold text-blue-950">
            Suggested follow-up
          </h3>
          <p className="mt-1 text-sm font-medium text-blue-900">{summary}</p>
          <p className="mt-0.5 text-xs text-blue-700">Review the date and time before saving.</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-slate-700">
          Date
          <input
            ref={dateRef}
            type="date"
            value={date}
            onChange={(event) => {
              onDateChange(event.target.value);
              setAccepted(false);
            }}
            className="mt-1.5 h-11 w-full rounded-lg border border-blue-200 bg-white px-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Time
          <input
            type="time"
            value={time}
            onChange={(event) => {
              onTimeChange(event.target.value);
              setAccepted(false);
            }}
            className="mt-1.5 h-11 w-full rounded-lg border border-blue-200 bg-white px-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setAccepted(true)}
          disabled={!date}
          className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            accepted ? "bg-emerald-700 text-white" : "bg-blue-700 text-white hover:bg-blue-800"
          }`}
        >
          <Check aria-hidden="true" size={16} />
          {accepted ? "Accepted" : "Accept"}
        </button>
        <button
          type="button"
          onClick={() => dateRef.current?.focus()}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800 transition-colors hover:bg-blue-100"
        >
          <Pencil aria-hidden="true" size={16} />
          Change
        </button>
      </div>
      {accepted && date ? <input type="hidden" name="nextFollowUpDate" value={date} /> : null}
      <input type="hidden" name="suggestedFollowUpTime" value={accepted ? time : ""} />
    </section>
  );
}
