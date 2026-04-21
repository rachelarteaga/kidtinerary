"use client";

import type { DayOfWeek, PlannerEntryStatus, SessionPart } from "@/lib/supabase/types";
import { entryFillsSquare, hasConflict, type ScheduleSlot } from "@/lib/schedule";

export interface TimelineEntry {
  id: string;
  color: string;
  status: PlannerEntryStatus;
  sessionPart: SessionPart;
  daysOfWeek: DayOfWeek[];
}

interface Props {
  entries: TimelineEntry[];
  weekStart: Date;
  plannerStart: Date;
  plannerEnd: Date;
  onSquareClick?: (day: DayOfWeek, slot: ScheduleSlot) => void;
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

function dateForDay(weekStart: Date, day: DayOfWeek): Date {
  const offset = DAYS.findIndex((d) => d.value === day);
  const dd = new Date(weekStart);
  dd.setDate(dd.getDate() + offset);
  return dd;
}

function isOutOfRange(d: Date, start: Date, end: Date): boolean {
  const ts = d.getTime();
  const startMs = new Date(start).setHours(0, 0, 0, 0);
  const endMs = new Date(end).setHours(23, 59, 59, 999);
  return ts < startMs || ts > endMs;
}

export function CellTimelineGrid({ entries, weekStart, plannerStart, plannerEnd, onSquareClick }: Props) {
  const conflicted = hasConflict(
    entries.map((e) => ({ id: e.id, session_part: e.sessionPart, days_of_week: e.daysOfWeek }))
  );

  const SLOTS: ScheduleSlot[] = ["am", "pm"];

  return (
    <div className="space-y-0.5">
      <div className="grid" style={{ gridTemplateColumns: "22px repeat(7, 1fr)", gap: "3px" }}>
        <div />
        {DAYS.map((d) => {
          const dt = dateForDay(weekStart, d.value);
          const oor = isOutOfRange(dt, plannerStart, plannerEnd);
          return (
            <div
              key={d.value}
              className={`text-[9px] text-center font-sans font-bold uppercase tracking-wide ${
                oor ? "text-ink-3 line-through" : d.isWeekend ? "text-ink-3" : "text-ink-2"
              }`}
            >
              {d.label}
            </div>
          );
        })}
      </div>
      {SLOTS.map((slot) => (
        <div key={slot} className="grid" style={{ gridTemplateColumns: "22px repeat(7, 1fr)", gap: "3px" }}>
          <div className="text-[8px] font-sans font-bold text-ink-3 uppercase tracking-wide self-center text-right pr-0.5">
            {slot.toUpperCase()}
          </div>
          {DAYS.map((d) => {
            const dt = dateForDay(weekStart, d.value);
            const oor = isOutOfRange(dt, plannerStart, plannerEnd);
            const filling = entries.filter((e) =>
              entryFillsSquare({ session_part: e.sessionPart, days_of_week: e.daysOfWeek }, d.value, slot)
            );
            const isWeekendEmpty = d.isWeekend && filling.length === 0;

            if (oor) {
              return (
                <div key={d.value} className="h-3.5 rounded opacity-40" style={{
                  backgroundImage: "repeating-linear-gradient(45deg, #e8e8ea 0, #e8e8ea 2px, transparent 2px, transparent 5px)",
                  border: "1px dashed #c0c0c0",
                }} />
              );
            }

            if (filling.length === 0) {
              if (isWeekendEmpty) {
                return <div key={d.value} className="h-3.5 rounded bg-disabled opacity-55 border border-dashed border-[#e0e0e0]" />;
              }
              return (
                <button
                  key={d.value}
                  onClick={() => onSquareClick?.(d.value, slot)}
                  className="h-3.5 rounded border border-dashed border-ink-3 hover:border-ink hover:bg-surface transition-colors"
                  aria-label={`Add for ${d.label} ${slot}`}
                />
              );
            }

            const primary = filling[0];
            const conflict = filling.length > 1 || conflicted;
            const isWaitlisted = primary.status === "waitlisted";

            return (
              <button
                key={d.value}
                onClick={() => onSquareClick?.(d.value, slot)}
                className={`h-3.5 rounded ${conflict ? "outline outline-2 outline-[#ef8c8f] outline-offset-[-1px]" : ""}`}
                style={
                  isWaitlisted
                    ? {
                        backgroundImage: `repeating-linear-gradient(45deg, ${primary.color} 0, ${primary.color} 4px, ${primary.color}33 4px, ${primary.color}33 8px)`,
                        border: `1px solid ${primary.color}`,
                      }
                    : { background: primary.color }
                }
                aria-label={`${d.label} ${slot}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
