import { describe, it, expect } from "vitest";
import { CAMP_PALETTE, paletteColorForCampIndex } from "@/lib/camp-palette";

describe("camp palette", () => {
  it("has 20 distinct colors", () => {
    expect(CAMP_PALETTE.length).toBe(20);
    expect(new Set(CAMP_PALETTE).size).toBe(20);
  });

  it("assigns colors in order", () => {
    expect(paletteColorForCampIndex(0)).toBe(CAMP_PALETTE[0]);
    expect(paletteColorForCampIndex(1)).toBe(CAMP_PALETTE[1]);
    expect(paletteColorForCampIndex(19)).toBe(CAMP_PALETTE[19]);
  });

  it("wraps after 20", () => {
    expect(paletteColorForCampIndex(20)).toBe(CAMP_PALETTE[0]);
    expect(paletteColorForCampIndex(21)).toBe(CAMP_PALETTE[1]);
  });
});
