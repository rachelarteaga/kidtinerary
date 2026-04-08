import { describe, it, expect } from "vitest";
import {
  formatPrice,
  formatPriceUnit,
  formatTimeSlot,
  formatDateRange,
  formatTime,
  formatAgeRange,
  categoryLabel,
} from "@/lib/format";

describe("formatPrice", () => {
  it("formats whole dollar amounts without decimals", () => {
    expect(formatPrice(28500)).toBe("$285");
  });
  it("formats cents with two decimal places", () => {
    expect(formatPrice(28550)).toBe("$285.50");
  });
  it("formats zero", () => {
    expect(formatPrice(0)).toBe("$0");
  });
});

describe("formatPriceUnit", () => {
  it("returns /week for per_week", () => {
    expect(formatPriceUnit("per_week")).toBe("/week");
  });
  it("returns /block for per_block", () => {
    expect(formatPriceUnit("per_block")).toBe("/block");
  });
});

describe("formatTimeSlot", () => {
  it("returns Full Day for full_day", () => {
    expect(formatTimeSlot("full_day")).toBe("Full Day");
  });
  it("returns Morning for am_half", () => {
    expect(formatTimeSlot("am_half")).toBe("Morning");
  });
});

describe("formatDateRange", () => {
  it("formats a week range", () => {
    const result = formatDateRange("2026-06-15", "2026-06-19");
    expect(result).toContain("Jun");
    expect(result).toContain("15");
    expect(result).toContain("19");
  });
});

describe("formatTime", () => {
  it("formats morning time", () => {
    expect(formatTime("09:00")).toBe("9AM");
  });
  it("formats afternoon time with minutes", () => {
    expect(formatTime("13:30")).toBe("1:30PM");
  });
  it("formats noon", () => {
    expect(formatTime("12:00")).toBe("12PM");
  });
});

describe("formatAgeRange", () => {
  it("formats min and max", () => {
    expect(formatAgeRange(5, 9)).toBe("Ages 5–9");
  });
  it("formats min only", () => {
    expect(formatAgeRange(5, null)).toBe("Ages 5+");
  });
  it("formats max only", () => {
    expect(formatAgeRange(null, 9)).toBe("Up to age 9");
  });
  it("formats neither", () => {
    expect(formatAgeRange(null, null)).toBe("All ages");
  });
});

describe("categoryLabel", () => {
  it("returns human label for known category", () => {
    expect(categoryLabel("stem")).toBe("STEM");
    expect(categoryLabel("arts")).toBe("Arts & Crafts");
  });
  it("returns raw string for unknown category", () => {
    expect(categoryLabel("unknown")).toBe("unknown");
  });
});
