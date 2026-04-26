import { describe, expect, test } from "vitest";
import { matchesKidFilter } from "@/lib/catalog-filters";

describe("matchesKidFilter — __unassigned sentinel logic", () => {
  test("undefined kidIds matches everything", () => {
    expect(matchesKidFilter([], undefined)).toBe(true);
    expect(matchesKidFilter(["kid-1"], undefined)).toBe(true);
  });

  test("empty kidIds array matches everything", () => {
    expect(matchesKidFilter([], [])).toBe(true);
    expect(matchesKidFilter(["kid-1"], [])).toBe(true);
  });

  test("__unassigned matches rows with no kid tags", () => {
    expect(matchesKidFilter([], ["__unassigned"])).toBe(true);
  });

  test("__unassigned does NOT match rows that have at least one kid tag", () => {
    expect(matchesKidFilter(["kid-1"], ["__unassigned"])).toBe(false);
  });

  test("specific kid id matches rows containing that id", () => {
    expect(matchesKidFilter(["kid-1", "kid-2"], ["kid-1"])).toBe(true);
  });

  test("specific kid id does NOT match rows without that id", () => {
    expect(matchesKidFilter(["kid-2"], ["kid-1"])).toBe(false);
  });

  test("mix of kid id + __unassigned matches both cases", () => {
    // row with no tags — matched by __unassigned
    expect(matchesKidFilter([], ["kid-1", "__unassigned"])).toBe(true);
    // row with kid-1 — matched by the id
    expect(matchesKidFilter(["kid-1"], ["kid-1", "__unassigned"])).toBe(true);
    // row with only kid-2 — not matched
    expect(matchesKidFilter(["kid-2"], ["kid-1", "__unassigned"])).toBe(false);
  });

  test("multiple kid ids: matches row that has any one of them", () => {
    expect(matchesKidFilter(["kid-3"], ["kid-1", "kid-2", "kid-3"])).toBe(true);
    expect(matchesKidFilter(["kid-4"], ["kid-1", "kid-2", "kid-3"])).toBe(false);
  });
});
