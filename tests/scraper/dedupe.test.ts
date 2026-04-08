import { describe, it, expect } from "vitest";
import {
  trigramSimilarity,
  isGeographicallyClose,
  hasDateOverlap,
  isDuplicateOf,
} from "@/scraper/dedupe";

describe("trigramSimilarity", () => {
  it("returns 1.0 for identical strings", () => {
    expect(trigramSimilarity("Summer Camp", "Summer Camp")).toBe(1.0);
  });

  it("returns high score for near-identical strings", () => {
    const score = trigramSimilarity("Raleigh Summer Camp", "Raleigh Summer Camps");
    expect(score).toBeGreaterThan(0.8);
  });

  it("returns low score for unrelated strings", () => {
    const score = trigramSimilarity("Swimming Lessons", "Robotics Club");
    expect(score).toBeLessThan(0.3);
  });

  it("handles empty strings", () => {
    expect(trigramSimilarity("", "anything")).toBe(0);
    expect(trigramSimilarity("anything", "")).toBe(0);
  });

  it("is case-insensitive", () => {
    const score = trigramSimilarity("SUMMER CAMP", "summer camp");
    expect(score).toBe(1.0);
  });
});

describe("isGeographicallyClose", () => {
  // Raleigh City Hall: 35.7796° N, 78.6382° W
  const raleigh = { lat: 35.7796, lng: -78.6382 };
  // ~0.3 miles north
  const nearRaleigh = { lat: 35.7840, lng: -78.6382 };
  // Durham: ~20 miles away
  const durham = { lat: 35.9940, lng: -78.8986 };

  it("returns true for points within 0.5 miles", () => {
    expect(isGeographicallyClose(raleigh, nearRaleigh, 0.5)).toBe(true);
  });

  it("returns false for points more than 0.5 miles apart", () => {
    expect(isGeographicallyClose(raleigh, durham, 0.5)).toBe(false);
  });

  it("respects a custom threshold in miles", () => {
    expect(isGeographicallyClose(raleigh, durham, 25)).toBe(true);
    expect(isGeographicallyClose(raleigh, durham, 10)).toBe(false);
  });
});

describe("hasDateOverlap", () => {
  it("returns true for overlapping date ranges", () => {
    expect(
      hasDateOverlap(
        { startsAt: "2025-06-16", endsAt: "2025-06-20" },
        { startsAt: "2025-06-18", endsAt: "2025-06-22" }
      )
    ).toBe(true);
  });

  it("returns true for contained ranges", () => {
    expect(
      hasDateOverlap(
        { startsAt: "2025-06-01", endsAt: "2025-06-30" },
        { startsAt: "2025-06-10", endsAt: "2025-06-15" }
      )
    ).toBe(true);
  });

  it("returns false for non-overlapping ranges", () => {
    expect(
      hasDateOverlap(
        { startsAt: "2025-06-01", endsAt: "2025-06-07" },
        { startsAt: "2025-06-14", endsAt: "2025-06-20" }
      )
    ).toBe(false);
  });

  it("returns true for adjacent ranges (same end/start day)", () => {
    expect(
      hasDateOverlap(
        { startsAt: "2025-06-07", endsAt: "2025-06-14" },
        { startsAt: "2025-06-14", endsAt: "2025-06-21" }
      )
    ).toBe(true);
  });
});

describe("isDuplicateOf", () => {
  const base = {
    name: "Summer Splash Camp",
    lat: 35.7796,
    lng: -78.6382,
    sessions: [{ startsAt: "2025-06-16", endsAt: "2025-06-20" }],
  };

  it("flags near-identical activity at same location same week as duplicate", () => {
    const candidate = {
      name: "Summer Splash Camps",
      lat: 35.7797,
      lng: -78.6383,
      sessions: [{ startsAt: "2025-06-16", endsAt: "2025-06-20" }],
    };
    expect(isDuplicateOf(candidate, base)).toBe(true);
  });

  it("does not flag same name at distant location", () => {
    const candidate = {
      name: "Summer Splash Camp",
      lat: 35.9940,
      lng: -78.8986,
      sessions: [{ startsAt: "2025-06-16", endsAt: "2025-06-20" }],
    };
    expect(isDuplicateOf(candidate, base)).toBe(false);
  });

  it("does not flag same name same location different time of year", () => {
    const candidate = {
      name: "Summer Splash Camp",
      lat: 35.7796,
      lng: -78.6382,
      sessions: [{ startsAt: "2025-09-01", endsAt: "2025-09-05" }],
    };
    expect(isDuplicateOf(candidate, base)).toBe(false);
  });
});
