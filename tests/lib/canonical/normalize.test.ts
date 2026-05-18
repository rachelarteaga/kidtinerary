import { describe, it, expect } from "vitest";
import {
  normalizeOrgName,
  normalizeProgramName,
  normalizeRegion,
} from "@/lib/canonical/normalize";

describe("normalizeOrgName", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeOrgName("YMCA of Westport!")).toBe(normalizeOrgName("ymca of westport"));
  });

  it("is token-order-insensitive (Westport YMCA = YMCA of Westport)", () => {
    expect(normalizeOrgName("Westport YMCA")).toBe(normalizeOrgName("YMCA of Westport"));
  });

  it("expands rec → recreation", () => {
    expect(normalizeOrgName("Lions Park Rec Center")).toBe(
      normalizeOrgName("Lions Park Recreation Center"),
    );
  });

  it("expands ctr → center", () => {
    expect(normalizeOrgName("Lions Park Recreation Ctr")).toBe(
      normalizeOrgName("Lions Park Recreation Center"),
    );
  });

  it("handles apostrophes by removing them (kid's → kids)", () => {
    expect(normalizeOrgName("kid's club")).toBe(normalizeOrgName("kids club"));
  });

  it("returns empty string for empty or non-string inputs", () => {
    expect(normalizeOrgName("")).toBe("");
    expect(normalizeOrgName("   ")).toBe("");
    expect(normalizeOrgName(null as unknown as string)).toBe("");
  });
});

describe("normalizeProgramName", () => {
  it("strips years anywhere in the string", () => {
    expect(normalizeProgramName("Summer 2026 Adventure Camp")).toBe(
      normalizeProgramName("Summer Adventure Camp"),
    );
    expect(normalizeProgramName("Adventure 2025")).toBe(
      normalizeProgramName("Adventure"),
    );
  });

  it("strips session numbers", () => {
    expect(normalizeProgramName("Adventure Session 1")).toBe(
      normalizeProgramName("Adventure"),
    );
    expect(normalizeProgramName("Adventure Week 3")).toBe(
      normalizeProgramName("Adventure"),
    );
  });

  it("strips age ranges", () => {
    expect(normalizeProgramName("Adventure ages 5-7")).toBe(
      normalizeProgramName("Adventure ages 8-10"),
    );
  });

  it("strips generic tokens (camp, program, day, summer)", () => {
    expect(normalizeProgramName("Adventure Day Camp")).toBe(
      normalizeProgramName("Adventure Program"),
    );
  });

  // The Rachel-and-friend case. Both these strings, after normalization,
  // must produce the same token set so their fingerprints match.
  it("collapses 'Lions Park X-Press' with 'Summer X-Press Day Camp at Lions Park'", () => {
    const rachel = normalizeProgramName("Lions Park X-Press");
    const friend = normalizeProgramName("Summer X-Press Day Camp at Lions Park");
    expect(rachel).toBe(friend);
    expect(rachel.length).toBeGreaterThan(0); // not empty
  });

  it("preserves distinct programs (Soccer vs Tennis)", () => {
    const soccer = normalizeProgramName("Lions Park Soccer");
    const tennis = normalizeProgramName("Lions Park Tennis");
    expect(soccer).not.toBe(tennis);
  });
});

describe("normalizeRegion", () => {
  it("returns 'online' for the online flag", () => {
    expect(normalizeRegion({ online: true })).toBe("online");
  });

  it("lowercases city, uppercases state", () => {
    expect(normalizeRegion({ city: "Westport", state: "ct" })).toBe("westport, CT");
    expect(normalizeRegion({ city: "WESTPORT", state: "CT" })).toBe("westport, CT");
  });

  it("trims whitespace", () => {
    expect(normalizeRegion({ city: "  Westport  ", state: " ct " })).toBe(
      "westport, CT",
    );
  });

  it("returns empty string when city or state is missing", () => {
    expect(normalizeRegion({ city: "", state: "CT" })).toBe("");
    expect(normalizeRegion({ city: "Westport", state: "" })).toBe("");
  });
});
