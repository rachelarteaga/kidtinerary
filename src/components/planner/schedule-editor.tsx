"use client";

import type { SessionPart, DayOfWeek } from "@/lib/supabase/types";

interface Props {
  sessionPart: SessionPart;
  daysOfWeek: DayOfWeek[];
  onSessionPartChange: (part: SessionPart) => void;
  onDaysChange: (days: DayOfWeek[]) => void;
}

const DAYS: { value: DayOfWeek; label: string; isWeekend: boolean }[] = [
  { value: "mon", label: "M", isWeekend: false },
  { value: "tue", label: "T", isWeekend: false },
  { value: "wed", label: "W", isWeekend: false },
  { value: "thu", label: "Th", isWeekend: false },
  { value: "fri", label: "F", isWeekend: false },
  { value: "sat", label: "Sa", isWeekend: true },
  { value: "sun", label: "Su", isWeekend: true },
];

export function ScheduleEditor({
  sessionPart,
  daysOfWeek,
  onSessionPartChange,
  onDaysChange,
}: Props) {
  function togglePart(part: SessionPart) {
    onSessionPartChange(part);
  }

  function toggleDay(day: DayOfWeek) {
    onDaysChange(
      daysOfWeek.includes(day) ? daysOfWeek.filter((d) => d !== day) : [...daysOfWeek, day]
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {(["full", "am", "pm", "overnight"] as SessionPart[]).map((p) => (
          <button
            key={p}
            onClick={() => togglePart(p)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
              sessionPart === p
                ? "border-ink bg-ink/10 text-ink font-medium"
                : "border-ink-3 bg-surface text-ink-2 hover:text-ink hover:border-ink"
            }`}
          >
            {p === "full" ? "Full day" : p === "am" ? "AM only" : p === "pm" ? "PM only" : "Overnight"}
          </button>
        ))}
      </div>

      <div className="flex gap-1">
        {DAYS.map((d) => {
          const selected = daysOfWeek.includes(d.value);
          return (
            <button
              key={d.value}
              onClick={() => toggleDay(d.value)}
              className={`flex-1 rounded-md border px-0 py-1.5 text-xs font-medium transition-colors ${
                selected
                  ? "border-ink bg-ink/10 text-ink"
                  : d.isWeekend
                    ? "border-ink-3 bg-surface text-ink-3"
                    : "border-ink-3 bg-surface text-ink-2 hover:text-ink"
              }`}
            >
              {d.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
