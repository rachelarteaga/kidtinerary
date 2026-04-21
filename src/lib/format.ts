import type { PriceUnit, TimeSlot } from "./constants";

export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0
    ? `$${dollars.toFixed(0)}`
    : `$${dollars.toFixed(2)}`;
}

export function formatPriceUnit(unit: PriceUnit): string {
  const labels: Record<PriceUnit, string> = {
    per_week: "/week",
    per_day: "/day",
    per_session: "/session",
    per_block: "/block",
  };
  return labels[unit];
}

export function formatTimeSlot(slot: TimeSlot): string {
  const labels: Record<TimeSlot, string> = {
    full_day: "Full Day",
    am_half: "Morning",
    pm_half: "Afternoon",
  };
  return labels[slot];
}

export function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = s.toLocaleDateString("en-US", opts);
  const endStr = e.toLocaleDateString("en-US", opts);
  return `${startStr} – ${endStr}`;
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return minutes === 0 ? `${h}${ampm}` : `${h}:${minutes.toString().padStart(2, "0")}${ampm}`;
}

export function formatAgeRange(min: number | null, max: number | null): string {
  if (min != null && max != null) return `Ages ${min}–${max}`;
  if (min != null) return `Ages ${min}+`;
  if (max != null) return `Up to age ${max}`;
  return "All ages";
}

export function formatDataFreshness(date: string | null): string {
  if (!date) return "Not yet verified";
  const d = new Date(date);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 14) return `Updated ${days} days ago`;
  return "Data may be stale";
}

export function categoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    sports: "Sports",
    arts: "Arts & Crafts",
    stem: "STEM",
    nature: "Nature",
    music: "Music",
    theater: "Theater",
    academic: "Academic",
    special_needs: "Special Needs",
    religious: "Religious",
    swimming: "Swimming",
    cooking: "Cooking",
    language: "Language",
  };
  return labels[cat] ?? cat;
}

/** Returns the Monday of the week containing `date`. */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Sunday=0, shift to Monday-based
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns a unique string key for a week: "2026-W15" ISO format. */
export function getWeekKey(date: Date): string {
  const start = getWeekStart(date);
  const yearStart = new Date(start.getFullYear(), 0, 1);
  const dayOfYear = Math.floor(
    (start.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const weekNum = Math.ceil((dayOfYear + yearStart.getDay() + 1) / 7);
  return `${start.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/** Generates an array of week-start Mondays from `from` to `to`. */
export function generateWeeks(from: Date, to: Date): Date[] {
  const weeks: Date[] = [];
  const current = getWeekStart(new Date(from));
  const end = new Date(to);
  while (current <= end) {
    weeks.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  return weeks;
}

/** Formats a week start date as "Apr 7 – 11" or "Apr 28 – May 2" if cross-month. */
export function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 4); // Friday
  const sMonth = weekStart.toLocaleDateString("en-US", { month: "short" });
  const eMonth = end.toLocaleDateString("en-US", { month: "short" });
  const sDay = weekStart.getDate();
  const eDay = end.getDate();
  if (sMonth === eMonth) {
    return `${sMonth} ${sDay} – ${eDay}`;
  }
  return `${sMonth} ${sDay} – ${eMonth} ${eDay}`;
}

/**
 * Returns parts of a week label suited for 2-line rendering.
 * - month: "JUN" (start month, uppercased 3-letter)
 * - days: "15–19" for single-month weeks, "29–JUL 3" for cross-month
 */
export function formatWeekLabelParts(weekStart: Date): { month: string; days: string } {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 4); // Friday
  const sMonth = weekStart.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const eMonth = end.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const sDay = weekStart.getDate();
  const eDay = end.getDate();
  if (sMonth === eMonth) {
    return { month: sMonth, days: `${sDay}–${eDay}` };
  }
  return { month: sMonth, days: `${sDay}–${eMonth} ${eDay}` };
}

/**
 * Single-line fixed-width label. Always shows month + zero-padded day
 * for both start and end, so every label is 15 chars wide regardless
 * of whether the week crosses months. Example: "JUN 03 – JUN 09" or
 * "JUN 29 – JUL 03".
 */
export function formatWeekLabelCompact(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 4); // Friday
  const sMonth = weekStart.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const eMonth = end.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const sDay = String(weekStart.getDate()).padStart(2, "0");
  const eDay = String(end.getDate()).padStart(2, "0");
  return `${sMonth} ${sDay} – ${eMonth} ${eDay}`;
}
