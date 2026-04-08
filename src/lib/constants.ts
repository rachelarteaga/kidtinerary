export const CATEGORIES = [
  "sports",
  "arts",
  "stem",
  "nature",
  "music",
  "theater",
  "academic",
  "special_needs",
  "religious",
  "swimming",
  "cooking",
  "language",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_COLORS: Record<Category, { bg: string; text: string }> = {
  sports: { bg: "bg-[#D4A574]/15", text: "text-[#b85c3c]" },
  arts: { bg: "bg-[#E07845]/10", text: "text-[#b85c3c]" },
  stem: { bg: "bg-[#6B8CBB]/12", text: "text-[#4a6d8c]" },
  nature: { bg: "bg-[#5A8F6E]/12", text: "text-[#3d7a54]" },
  music: { bg: "bg-[#D4A574]/15", text: "text-[#8a6d4b]" },
  theater: { bg: "bg-[#E07845]/10", text: "text-[#b85c3c]" },
  academic: { bg: "bg-[#6B8CBB]/12", text: "text-[#4a6d8c]" },
  special_needs: { bg: "bg-[#5A8F6E]/12", text: "text-[#3d7a54]" },
  religious: { bg: "bg-[#D4A574]/15", text: "text-[#8a6d4b]" },
  swimming: { bg: "bg-[#6B8CBB]/12", text: "text-[#4a6d8c]" },
  cooking: { bg: "bg-[#E07845]/10", text: "text-[#b85c3c]" },
  language: { bg: "bg-[#6B8CBB]/12", text: "text-[#4a6d8c]" },
};

export const PLANNER_STATUS = ["penciled_in", "locked_in", "cancelled"] as const;
export type PlannerStatus = (typeof PLANNER_STATUS)[number];

export const PRICE_UNITS = ["per_week", "per_day", "per_session", "per_block"] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];

export const DATA_CONFIDENCE = ["high", "medium", "low"] as const;
export type DataConfidence = (typeof DATA_CONFIDENCE)[number];

export const TIME_SLOTS = ["full_day", "am_half", "pm_half"] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number];

export const INDOOR_OUTDOOR = ["indoor", "outdoor", "both"] as const;
export type IndoorOutdoor = (typeof INDOOR_OUTDOOR)[number];

export const REMINDER_TYPES = ["registration_opens", "registration_closes", "custom"] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];

export const REPORT_REASONS = ["wrong_price", "cancelled", "wrong_dates", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
