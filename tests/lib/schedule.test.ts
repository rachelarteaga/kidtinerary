import { describe, it, expect } from "vitest";
import {
  normalizeDays,
  serializeDays,
  hasConflict,
  entryFillsSquare,
} from "@/lib/schedule";
import type { DayOfWeek } from "@/lib/supabase/types";

const D = (...d: string[]) => d as DayOfWeek[];

describe("schedule helpers", () => {
  it("normalizeDays filters invalid and dedupes", () => {
    expect(normalizeDays(["mon", "tue", "tue", "bad", "fri"])).toEqual(["mon", "tue", "fri"]);
  });

  it("serializeDays returns canonical weekday order", () => {
    expect(serializeDays(D("fri", "mon", "wed"))).toEqual(["mon", "wed", "fri"]);
  });

  it("entryFillsSquare matches session_part=full on any day in days_of_week", () => {
    const entry = { session_part: "full" as const, days_of_week: D("mon", "wed") };
    expect(entryFillsSquare(entry, "mon", "am")).toBe(true);
    expect(entryFillsSquare(entry, "mon", "pm")).toBe(true);
    expect(entryFillsSquare(entry, "tue", "am")).toBe(false);
    expect(entryFillsSquare(entry, "wed", "pm")).toBe(true);
  });

  it("entryFillsSquare with session_part=am only fills AM", () => {
    const entry = { session_part: "am" as const, days_of_week: D("mon", "wed") };
    expect(entryFillsSquare(entry, "mon", "am")).toBe(true);
    expect(entryFillsSquare(entry, "mon", "pm")).toBe(false);
  });

  it("hasConflict detects two entries filling the same square", () => {
    const e1 = { id: "a", session_part: "full" as const, days_of_week: D("mon") };
    const e2 = { id: "b", session_part: "am" as const, days_of_week: D("mon") };
    expect(hasConflict([e1, e2])).toBe(true);
  });

  it("hasConflict returns false when no overlap", () => {
    const e1 = { id: "a", session_part: "am" as const, days_of_week: D("mon", "wed") };
    const e2 = { id: "b", session_part: "pm" as const, days_of_week: D("mon", "wed") };
    expect(hasConflict([e1, e2])).toBe(false);
  });
});
