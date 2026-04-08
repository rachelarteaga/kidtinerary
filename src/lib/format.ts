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
