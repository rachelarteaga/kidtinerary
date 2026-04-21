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

  function overnightFor(day: DayOfWeek): TimelineEntry | undefined {
    return entries.find((e) => e.sessionPart === "overnight" && e.daysOfWeek.includes(day));
  }

  function cellForSlot(day: DayOfWeek, slot: ScheduleSlot, i: number) {
    const gridColumn = i + 2;
    const dt = dateForDay(weekStart, day);
    const oor = isOutOfRange(dt, plannerStart, plannerEnd);
    const gridRow = slot === "am" ? 2 : 3;

    if (oor) {
      return (
        <div
          key={`${slot}-${day}`}
          style={{
            gridColumn,
            gridRow,
            backgroundImage: "repeating-linear-gradient(45deg, #e8e8ea 0, #e8e8ea 2px, transparent 2px, transparent 5px)",
            border: "1px dashed #c0c0c0",
          }}
          className="rounded opacity-40"
        />
      );
    }

    const filling = entries.filter((e) =>
      entryFillsSquare({ session_part: e.sessionPart, days_of_week: e.daysOfWeek }, day, slot)
    );

    if (filling.length === 0) {
      const d = DAYS[i];
      if (d.isWeekend) {
        return (
          <div
            key={`${slot}-${day}`}
            style={{ gridColumn, gridRow }}
            className="rounded bg-disabled opacity-55 border border-dashed border-[#e0e0e0]"
          />
        );
      }
      return (
        <button
          key={`${slot}-${day}`}
          onClick={() => onSquareClick?.(day, slot)}
          style={{ gridColumn, gridRow }}
          className="rounded border border-dashed border-ink-3 hover:border-ink hover:bg-surface transition-colors"
          aria-label={`Add for ${d.label} ${slot}`}
        />
      );
    }

    const primary = filling[0];
    const conflict = filling.length > 1 || conflicted;
    const isWaitlisted = primary.status === "waitlisted";

    return (
      <button
        key={`${slot}-${day}`}
        onClick={() => onSquareClick?.(day, slot)}
        style={{
          gridColumn,
          gridRow,
          ...(isWaitlisted
            ? {
                backgroundImage: `repeating-linear-gradient(45deg, ${primary.color} 0, ${primary.color} 4px, ${primary.color}33 4px, ${primary.color}33 8px)`,
                border: `1px solid ${primary.color}`,
              }
            : { background: primary.color }),
        }}
        className={`rounded ${conflict ? "outline outline-2 outline-[#ef8c8f] outline-offset-[-1px]" : ""}`}
        aria-label={`${day} ${slot}`}
      />
    );
  }

  function overnightMergedCell(day: DayOfWeek, i: number, entry: TimelineEntry) {
    const gridColumn = i + 2;
    const isWaitlisted = entry.status === "waitlisted";
    const conflict =
      entries.filter((e) => e.daysOfWeek.includes(day)).length > 1 || conflicted;
    return (
      <button
        key={`overnight-${day}`}
        onClick={() => onSquareClick?.(day, "am")}
        style={{
          gridColumn,
          gridRow: "2 / span 2",
          ...(isWaitlisted
            ? {
                backgroundImage: `repeating-linear-gradient(45deg, ${entry.color} 0, ${entry.color} 4px, ${entry.color}33 4px, ${entry.color}33 8px)`,
                border: `1px solid ${entry.color}`,
              }
            : { background: entry.color }),
        }}
        className={`rounded relative ${conflict ? "outline outline-2 outline-[#ef8c8f] outline-offset-[-1px]" : ""}`}
        aria-label={`${day} overnight`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="#151515"
          width="11"
          height="11"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-70"
          aria-hidden
        >
          <path d="M14 2 A 10 10 0 1 0 22 13 A 8 8 0 0 1 14 2 Z" />
        </svg>
      </button>
    );
  }

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: "22px repeat(7, 1fr)",
        gridTemplateRows: "auto 14px 14px",
        columnGap: "3px",
        rowGap: "3px",
      }}
    >
      {/* Corner (empty) */}
      <div style={{ gridColumn: 1, gridRow: 1 }} />

      {/* Day headers */}
      {DAYS.map((d, i) => {
        const dt = dateForDay(weekStart, d.value);
        const oor = isOutOfRange(dt, plannerStart, plannerEnd);
        return (
          <div
            key={`hdr-${d.value}`}
            style={{ gridColumn: i + 2, gridRow: 1 }}
            className={`text-[9px] text-center font-sans font-bold uppercase tracking-wide ${
              oor ? "text-ink-3 line-through" : d.isWeekend ? "text-ink-3" : "text-ink-2"
            }`}
          >
            {d.label}
          </div>
        );
      })}

      {/* Slot labels */}
      <div
        style={{ gridColumn: 1, gridRow: 2 }}
        className="text-[8px] font-sans font-bold text-ink-3 uppercase tracking-wide self-center text-right pr-0.5"
      >
        AM
      </div>
      <div
        style={{ gridColumn: 1, gridRow: 3 }}
        className="text-[8px] font-sans font-bold text-ink-3 uppercase tracking-wide self-center text-right pr-0.5"
      >
        PM
      </div>

      {/* Day cells — overnight merges AM+PM, others render both slots */}
      {DAYS.map((d, i) => {
        const overnight = overnightFor(d.value);
        if (overnight) {
          return overnightMergedCell(d.value, i, overnight);
        }
        return [
          cellForSlot(d.value, "am", i),
          cellForSlot(d.value, "pm", i),
        ];
      })}
    </div>
  );
}
