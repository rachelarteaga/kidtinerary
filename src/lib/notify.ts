// src/lib/notify.ts
// Pure logic helpers for the notification cron routes.

export interface ReminderRow {
  id: string;
  user_id: string;
  activity_id: string;
  type: "registration_opens" | "registration_closes" | "custom";
  remind_at: string;
  sent_at: string | null;
  user_email: string;
  activity_name: string;
  activity_slug: string;
  notification_preferences: Record<string, boolean> | null;
}

/**
 * Returns reminders that should fire now:
 *  - remind_at <= now
 *  - sent_at IS NULL
 *  - the relevant notification_preferences key is not explicitly false
 */
export function filterDueReminders(reminders: ReminderRow[], now: Date): ReminderRow[] {
  return reminders.filter((r) => {
    if (r.sent_at !== null) return false;
    if (new Date(r.remind_at) > now) return false;
    const prefs = r.notification_preferences;
    if (prefs !== null && prefs[r.type] === false) return false;
    return true;
  });
}
