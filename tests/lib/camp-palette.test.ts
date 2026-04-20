import { describe, it, expect } from "vitest";
import { CAMP_PALETTE, paletteColorForCampIndex } from "@/lib/camp-palette";

describe("camp palette", () => {
  it("has 8 distinct colors", () => {
    expect(CAMP_PALETTE.length).toBe(8);
    expect(new Set(CAMP_PALETTE).size).toBe(8);
  });

  it("assigns colors in order", () => {
    expect(paletteColorForCampIndex(0)).toBe(CAMP_PALETTE[0]);
    expect(paletteColorForCampIndex(1)).toBe(CAMP_PALETTE[1]);
  });

  it("wraps after 8", () => {
    expect(paletteColorForCampIndex(8)).toBe(CAMP_PALETTE[0]);
    expect(paletteColorForCampIndex(9)).toBe(CAMP_PALETTE[1]);
  });
});
