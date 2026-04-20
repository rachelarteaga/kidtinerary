import type { SessionPart, DayOfWeek } from "@/lib/supabase/types";

const CANONICAL_ORDER: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const VALID = new Set<string>(CANONICAL_ORDER);

export function normalizeDays(days: unknown): DayOfWeek[] {
  if (!Array.isArray(days)) return [];
  const seen = new Set<DayOfWeek>();
  for (const d of days) {
    if (typeof d === "string" && VALID.has(d)) {
      seen.add(d as DayOfWeek);
    }
  }
  return CANONICAL_ORDER.filter((d) => seen.has(d));
}

export function serializeDays(days: DayOfWeek[]): DayOfWeek[] {
  return normalizeDays(days);
}

export type ScheduleSlot = "am" | "pm";

export interface EntryScheduleLike {
  session_part: SessionPart;
  days_of_week: DayOfWeek[];
}

export function entryFillsSquare(
  entry: EntryScheduleLike,
  day: DayOfWeek,
  slot: ScheduleSlot
): boolean {
  if (!entry.days_of_week.includes(day)) return false;
  if (entry.session_part === "full") return true;
  return entry.session_part === slot;
}

export function hasConflict(entries: Array<EntryScheduleLike & { id: string }>): boolean {
  for (const day of CANONICAL_ORDER) {
    for (const slot of ["am", "pm"] as ScheduleSlot[]) {
      const filling = entries.filter((e) => entryFillsSquare(e, day, slot));
      if (filling.length > 1) return true;
    }
  }
  return false;
}
