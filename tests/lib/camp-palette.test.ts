import { describe, it, expect } from "vitest";
import { CAMP_PALETTE, paletteColorForCampIndex, nextAvailablePaletteColor } from "@/lib/camp-palette";

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

describe("nextAvailablePaletteColor", () => {
  it("returns the first color when nothing is used", () => {
    expect(nextAvailablePaletteColor([])).toBe(CAMP_PALETTE[0]);
  });

  it("skips colors already in use", () => {
    expect(nextAvailablePaletteColor([CAMP_PALETTE[0], CAMP_PALETTE[1]])).toBe(CAMP_PALETTE[2]);
  });

  it("finds a gap left by a delete (count does not match index)", () => {
    // Camps at positions 0, 1, 3 (position 2 was deleted). count=3 but index 2 is free.
    const used = [CAMP_PALETTE[0], CAMP_PALETTE[1], CAMP_PALETTE[3]];
    expect(nextAvailablePaletteColor(used)).toBe(CAMP_PALETTE[2]);
  });

  it("is case-insensitive on stored hex values", () => {
    expect(nextAvailablePaletteColor([CAMP_PALETTE[0].toUpperCase()])).toBe(CAMP_PALETTE[1]);
  });

  it("falls back to cycling when all palette colors are used", () => {
    const all = [...CAMP_PALETTE];
    expect(nextAvailablePaletteColor(all)).toBe(CAMP_PALETTE[0]);
  });
});
