import { describe, it, expect } from "vitest";
import { scoreConfidence } from "@/scraper/confidence";

describe("scoreConfidence", () => {
  it("returns 'high' when all key fields are present and single candidate", () => {
    expect(scoreConfidence({
      candidates: [{ name: "Camp Kanata", score: 0.95, fields: { name: true, dates: true, price: true, location: true, ages: true } }],
    })).toBe("high");
  });

  it("returns 'partial' when one candidate but some fields missing", () => {
    expect(scoreConfidence({
      candidates: [{ name: "Camp Kanata", score: 0.9, fields: { name: true, dates: true, price: false, location: true, ages: false } }],
    })).toBe("partial");
  });

  it("returns 'ambiguous' when multiple candidates with close scores", () => {
    expect(scoreConfidence({
      candidates: [
        { name: "Art Camp A", score: 0.7, fields: { name: true, dates: true, price: true, location: true, ages: true } },
        { name: "Art Camp B", score: 0.68, fields: { name: true, dates: true, price: true, location: true, ages: true } },
      ],
    })).toBe("ambiguous");
  });

  it("returns 'none' when no candidates or all scores below threshold", () => {
    expect(scoreConfidence({ candidates: [] })).toBe("none");
    expect(scoreConfidence({ candidates: [{ name: "?", score: 0.3, fields: {} }] })).toBe("none");
  });
});
