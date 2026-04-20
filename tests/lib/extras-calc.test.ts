import { describe, it, expect } from "vitest";
import { extrasTotalCents } from "@/lib/extras-calc";

describe("extrasTotalCents", () => {
  it("returns 0 for no extras", () => {
    expect(extrasTotalCents([], 5)).toBe(0);
  });

  it("sums per_week extras regardless of day count", () => {
    expect(
      extrasTotalCents(
        [
          { label: "Lunch", cost_cents: 2500, unit: "per_week" },
          { label: "After care", cost_cents: 4000, unit: "per_week" },
        ],
        5
      )
    ).toBe(6500);
  });

  it("multiplies per_day extras by daysPerWeek", () => {
    expect(
      extrasTotalCents([{ label: "Bus", cost_cents: 500, unit: "per_day" }], 3)
    ).toBe(1500);
  });

  it("mixes per_week and per_day", () => {
    expect(
      extrasTotalCents(
        [
          { label: "Lunch", cost_cents: 2500, unit: "per_week" },
          { label: "Bus", cost_cents: 500, unit: "per_day" },
        ],
        5
      )
    ).toBe(2500 + 5 * 500);
  });
});
