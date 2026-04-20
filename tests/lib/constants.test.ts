import { describe, it, expect } from "vitest";
import {
  CATEGORIES,
  PLANNER_STATUS,
  PRICE_UNITS,
  DATA_CONFIDENCE,
  CATEGORY_COLORS,
} from "@/lib/constants";

describe("constants", () => {
  it("CATEGORIES contains all expected values", () => {
    expect(CATEGORIES).toContain("sports");
    expect(CATEGORIES).toContain("arts");
    expect(CATEGORIES).toContain("stem");
    expect(CATEGORIES).toContain("nature");
    expect(CATEGORIES).toContain("music");
    expect(CATEGORIES).toContain("theater");
    expect(CATEGORIES).toContain("academic");
    expect(CATEGORIES).toContain("special_needs");
    expect(CATEGORIES).toContain("religious");
    expect(CATEGORIES).toContain("swimming");
    expect(CATEGORIES).toContain("cooking");
    expect(CATEGORIES).toContain("language");
    expect(CATEGORIES).toHaveLength(12);
  });

  it("every category has a color mapping", () => {
    for (const cat of CATEGORIES) {
      expect(CATEGORY_COLORS[cat]).toBeDefined();
      expect(CATEGORY_COLORS[cat]).toHaveProperty("bg");
      expect(CATEGORY_COLORS[cat]).toHaveProperty("text");
    }
  });

  it("PLANNER_STATUS has considering, waitlisted, registered", () => {
    expect(PLANNER_STATUS).toEqual(["considering", "waitlisted", "registered"]);
  });

  it("PRICE_UNITS has all pricing types", () => {
    expect(PRICE_UNITS).toEqual(["per_week", "per_day", "per_session", "per_block"]);
  });

  it("DATA_CONFIDENCE has all levels", () => {
    expect(DATA_CONFIDENCE).toEqual(["high", "medium", "low"]);
  });
});
