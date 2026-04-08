// src/lib/reminder-helpers.ts
// Pure validation helpers for reminder creation.

export type ReminderType = "registration_opens" | "registration_closes" | "custom";

const VALID_TYPES: ReminderType[] = [
  "registration_opens",
  "registration_closes",
  "custom",
];

/**
 * Returns true if value is a valid ReminderType enum member.
 */
export function isValidReminderType(value: unknown): value is ReminderType {
  return typeof value === "string" && (VALID_TYPES as string[]).includes(value);
}

/**
 * Returns true if the given ISO date string is a valid date in the future
 * relative to `now` (defaults to the current time).
 */
export function isFutureDate(isoString: string, now: Date = new Date()): boolean {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return false;
  return date > now;
}
