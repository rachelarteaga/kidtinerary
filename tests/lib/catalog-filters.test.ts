import { describe, expect, test } from "vitest";
import {
  serializeFilterState,
  parseFilterState,
  matchesSourceFilter,
  bucketSeason,
} from "@/lib/catalog-filters";

describe("serializeFilterState / parseFilterState round-trip", () => {
  test("empty state ↔ empty params", () => {
    const params = serializeFilterState({});
    expect(params.toString()).toBe("");
    expect(parseFilterState(params)).toEqual({});
  });

  test("kid + source + category round-trip", () => {
    const params = serializeFilterState({
      kidIds: ["k1", "k2"],
      source: "friends",
      categories: ["arts", "sports"],
    });
    const parsed = parseFilterState(params);
    expect(parsed.kidIds).toEqual(["k1", "k2"]);
    expect(parsed.source).toBe("friends");
    expect(parsed.categories).toEqual(["arts", "sports"]);
  });

  test("type + season round-trip with all valid values", () => {
    const params = serializeFilterState({
      types: ["camp", "class", "lesson", "sport"],
      seasons: ["this-summer", "this-school-year", "past", "unknown"],
    });
    const parsed = parseFilterState(params);
    expect(parsed.types).toEqual(["camp", "class", "lesson", "sport"]);
    expect(parsed.seasons).toEqual(["this-summer", "this-school-year", "past", "unknown"]);
  });

  test("invalid type value is dropped, valid neighbors kept", () => {
    const params = new URLSearchParams("type=camp,nonsense,class");
    const parsed = parseFilterState(params);
    expect(parsed.types).toEqual(["camp", "class"]);
  });

  test("invalid source value is ignored", () => {
    const params = new URLSearchParams("source=garbage");
    const parsed = parseFilterState(params);
    expect(parsed.source).toBeUndefined();
  });
});

describe("matchesSourceFilter", () => {
  test("undefined filter matches everything", () => {
    expect(matchesSourceFilter("self", undefined)).toBe(true);
    expect(matchesSourceFilter("friend", undefined)).toBe(true);
    expect(matchesSourceFilter("llm", undefined)).toBe(true);
  });
  test("'me' covers self + llm but not friend", () => {
    expect(matchesSourceFilter("self", "me")).toBe(true);
    expect(matchesSourceFilter("llm", "me")).toBe(true);
    expect(matchesSourceFilter("friend", "me")).toBe(false);
  });
  test("'friends' covers only friend", () => {
    expect(matchesSourceFilter("friend", "friends")).toBe(true);
    expect(matchesSourceFilter("self", "friends")).toBe(false);
    expect(matchesSourceFilter("llm", "friends")).toBe(false);
  });
});

describe("bucketSeason", () => {
  // Pin "today" so test results are stable.
  const today = new Date("2026-04-25T12:00:00Z");

  test("null date → 'unknown'", () => {
    expect(bucketSeason(null, today)).toBe("unknown");
  });
  test("date in upcoming summer (Jun–Aug) → 'this-summer'", () => {
    expect(bucketSeason("2026-06-01", today)).toBe("this-summer");
    expect(bucketSeason("2026-07-15", today)).toBe("this-summer");
    expect(bucketSeason("2026-08-31", today)).toBe("this-summer");
  });
  test("date in upcoming school year (not summer) → 'this-school-year'", () => {
    expect(bucketSeason("2026-05-01", today)).toBe("this-school-year");
    expect(bucketSeason("2026-09-15", today)).toBe("this-school-year");
    expect(bucketSeason("2026-12-20", today)).toBe("this-school-year");
    expect(bucketSeason("2027-03-10", today)).toBe("this-school-year");
  });
  test("date in the past → 'past'", () => {
    expect(bucketSeason("2025-07-15", today)).toBe("past");
    expect(bucketSeason("2026-04-24", today)).toBe("past");
  });
  test("date equal to today is NOT past", () => {
    expect(bucketSeason("2026-04-25", today)).not.toBe("past");
  });
});
