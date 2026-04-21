import { describe, it, expect } from "vitest";
import { CAMP_PALETTE, paletteColorForCampIndex } from "@/lib/camp-palette";

describe("camp palette", () => {
  it("has 4 distinct colors", () => {
    expect(CAMP_PALETTE.length).toBe(4);
    expect(new Set(CAMP_PALETTE).size).toBe(4);
  });

  it("assigns colors in order", () => {
    expect(paletteColorForCampIndex(0)).toBe(CAMP_PALETTE[0]);
    expect(paletteColorForCampIndex(1)).toBe(CAMP_PALETTE[1]);
  });

  it("wraps after 4", () => {
    expect(paletteColorForCampIndex(4)).toBe(CAMP_PALETTE[0]);
    expect(paletteColorForCampIndex(5)).toBe(CAMP_PALETTE[1]);
  });
});
