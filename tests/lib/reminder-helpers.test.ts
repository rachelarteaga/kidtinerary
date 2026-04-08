import { describe, it, expect } from "vitest";
import { isValidReminderType, isFutureDate } from "@/lib/reminder-helpers";

describe("isValidReminderType", () => {
  it("accepts registration_opens", () => {
    expect(isValidReminderType("registration_opens")).toBe(true);
  });

  it("accepts registration_closes", () => {
    expect(isValidReminderType("registration_closes")).toBe(true);
  });

  it("accepts custom", () => {
    expect(isValidReminderType("custom")).toBe(true);
  });

  it("rejects unknown strings", () => {
    expect(isValidReminderType("weekly_digest")).toBe(false);
    expect(isValidReminderType("")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isValidReminderType(42)).toBe(false);
    expect(isValidReminderType(null)).toBe(false);
    expect(isValidReminderType(undefined)).toBe(false);
  });
});

describe("isFutureDate", () => {
  const now = new Date("2026-06-01T12:00:00Z");

  it("returns true for a date in the future", () => {
    expect(isFutureDate("2026-06-02T12:00:00Z", now)).toBe(true);
  });

  it("returns false for a date in the past", () => {
    expect(isFutureDate("2026-05-31T12:00:00Z", now)).toBe(false);
  });

  it("returns false for a date exactly equal to now", () => {
    expect(isFutureDate("2026-06-01T12:00:00Z", now)).toBe(false);
  });

  it("returns false for an invalid date string", () => {
    expect(isFutureDate("not-a-date", now)).toBe(false);
    expect(isFutureDate("", now)).toBe(false);
  });
});
