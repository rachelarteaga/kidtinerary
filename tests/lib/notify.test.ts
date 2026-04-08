import { describe, it, expect } from "vitest";
import { filterDueReminders, type ReminderRow } from "@/lib/notify";

describe("filterDueReminders", () => {
  const now = new Date("2026-06-01T08:00:00Z");

  it("includes reminders whose remind_at is in the past and sent_at is null", () => {
    const reminders: ReminderRow[] = [
      {
        id: "r1",
        user_id: "u1",
        activity_id: "a1",
        type: "registration_opens",
        remind_at: "2026-06-01T07:00:00Z",
        sent_at: null,
        user_email: "parent@example.com",
        activity_name: "Nature Explorers",
        activity_slug: "nature-explorers",
        notification_preferences: null,
      },
    ];
    expect(filterDueReminders(reminders, now)).toHaveLength(1);
  });

  it("excludes reminders already sent", () => {
    const reminders: ReminderRow[] = [
      {
        id: "r2",
        user_id: "u1",
        activity_id: "a1",
        type: "registration_opens",
        remind_at: "2026-05-31T07:00:00Z",
        sent_at: "2026-05-31T07:05:00Z",
        user_email: "parent@example.com",
        activity_name: "Art Camp",
        activity_slug: "art-camp",
        notification_preferences: null,
      },
    ];
    expect(filterDueReminders(reminders, now)).toHaveLength(0);
  });

  it("excludes reminders in the future", () => {
    const reminders: ReminderRow[] = [
      {
        id: "r3",
        user_id: "u1",
        activity_id: "a1",
        type: "custom",
        remind_at: "2026-06-02T07:00:00Z",
        sent_at: null,
        user_email: "parent@example.com",
        activity_name: "Soccer Stars",
        activity_slug: "soccer-stars",
        notification_preferences: null,
      },
    ];
    expect(filterDueReminders(reminders, now)).toHaveLength(0);
  });

  it("respects notification_preferences toggle — skips when type is disabled", () => {
    const reminders: ReminderRow[] = [
      {
        id: "r4",
        user_id: "u1",
        activity_id: "a1",
        type: "registration_opens",
        remind_at: "2026-06-01T06:00:00Z",
        sent_at: null,
        user_email: "parent@example.com",
        activity_name: "Swim Camp",
        activity_slug: "swim-camp",
        notification_preferences: { registration_opens: false },
      },
    ];
    expect(filterDueReminders(reminders, now)).toHaveLength(0);
  });

  it("allows reminder when preference is explicitly true", () => {
    const reminders: ReminderRow[] = [
      {
        id: "r5",
        user_id: "u1",
        activity_id: "a1",
        type: "registration_closes",
        remind_at: "2026-06-01T06:00:00Z",
        sent_at: null,
        user_email: "parent@example.com",
        activity_name: "Dance Studio",
        activity_slug: "dance-studio",
        notification_preferences: { registration_closes: true },
      },
    ];
    expect(filterDueReminders(reminders, now)).toHaveLength(1);
  });
});
