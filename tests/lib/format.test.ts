import { describe, it, expect } from "vitest";
import {
  formatPrice,
  formatPriceUnit,
  formatTimeSlot,
  formatDateRange,
  formatTime,
  formatAgeRange,
  categoryLabel,
  getWeekStart,
  getWeekKey,
  generateWeeks,
  formatWeekRange,
  formatUsPhone,
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

describe("getWeekStart", () => {
  it("returns Monday for a Wednesday", () => {
    // 2026-04-08 is a Wednesday
    const result = getWeekStart(new Date("2026-04-08T12:00:00"));
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(6); // Apr 6
    expect(result.getMonth()).toBe(3); // April (0-indexed)
  });

  it("returns Monday for a Monday (no change)", () => {
    // 2026-04-06 is a Monday
    const result = getWeekStart(new Date("2026-04-06T00:00:00"));
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(6);
  });

  it("returns the prior Monday for a Sunday", () => {
    // 2026-04-12 is a Sunday
    const result = getWeekStart(new Date("2026-04-12T00:00:00"));
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(6); // Apr 6
  });

  it("resets time to midnight", () => {
    const result = getWeekStart(new Date("2026-04-08T15:30:00"));
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });
});

describe("getWeekKey", () => {
  it("returns a string in YYYY-Www format", () => {
    const key = getWeekKey(new Date("2026-04-08T00:00:00"));
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("returns the same key for different days in the same week", () => {
    const keyWed = getWeekKey(new Date("2026-04-08T00:00:00"));
    const keyFri = getWeekKey(new Date("2026-04-10T00:00:00"));
    expect(keyWed).toBe(keyFri);
  });

  it("returns different keys for different weeks", () => {
    const keyWeek1 = getWeekKey(new Date("2026-04-06T00:00:00"));
    const keyWeek2 = getWeekKey(new Date("2026-04-13T00:00:00"));
    expect(keyWeek1).not.toBe(keyWeek2);
  });
});

describe("generateWeeks", () => {
  it("returns an array of Mondays", () => {
    const from = new Date("2026-04-06T00:00:00"); // Monday
    const to = new Date("2026-04-20T00:00:00");   // Monday + 2 weeks
    const weeks = generateWeeks(from, to);
    expect(weeks.length).toBe(3);
    for (const w of weeks) {
      expect(w.getDay()).toBe(1); // all Mondays
    }
  });

  it("returns at least one week when from equals to", () => {
    const date = new Date("2026-04-06T00:00:00");
    const weeks = generateWeeks(date, date);
    expect(weeks.length).toBe(1);
  });

  it("handles from mid-week by rounding down to Monday", () => {
    const from = new Date("2026-04-08T00:00:00"); // Wednesday
    const to = new Date("2026-04-14T00:00:00");   // Tuesday of next week
    const weeks = generateWeeks(from, to);
    expect(weeks.length).toBe(2);
    expect(weeks[0].getDay()).toBe(1);
  });
});

describe("formatWeekRange", () => {
  it("formats a same-month week as 'Mon D – D'", () => {
    // Apr 6 (Mon) to Apr 10 (Fri)
    const result = formatWeekRange(new Date("2026-04-06T00:00:00"));
    expect(result).toContain("Apr");
    expect(result).toContain("6");
    expect(result).toContain("10");
    // Should NOT have month repeated
    expect(result.split("Apr").length - 1).toBe(1);
  });

  it("formats a cross-month week with both month names", () => {
    // Apr 28 (Mon) to May 2 (Fri)
    const result = formatWeekRange(new Date("2026-04-27T00:00:00"));
    expect(result).toContain("Apr");
    expect(result).toContain("May");
  });
});

describe("formatUsPhone", () => {
  it("returns empty string for empty input", () => {
    expect(formatUsPhone("")).toBe("");
  });

  it("progressively formats digits as they're typed", () => {
    expect(formatUsPhone("2")).toBe("(2");
    expect(formatUsPhone("202")).toBe("(202");
    expect(formatUsPhone("2025")).toBe("(202) 5");
    expect(formatUsPhone("202555")).toBe("(202) 555");
    expect(formatUsPhone("2025551234")).toBe("(202) 555-1234");
  });

  it("is idempotent for already-formatted input", () => {
    expect(formatUsPhone("(202) 555-1234")).toBe("(202) 555-1234");
  });

  it("drops a leading US country code '1'", () => {
    expect(formatUsPhone("12025551234")).toBe("(202) 555-1234");
  });

  it("passes through international numbers with a leading '+'", () => {
    expect(formatUsPhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
  });

  it("ignores non-digit characters in the middle", () => {
    expect(formatUsPhone("202-555-1234")).toBe("(202) 555-1234");
    expect(formatUsPhone("202.555.1234")).toBe("(202) 555-1234");
  });

  it("truncates extra digits beyond 10 (or 11 with leading 1)", () => {
    expect(formatUsPhone("202555123456789")).toBe("(202) 555-1234");
  });
});
