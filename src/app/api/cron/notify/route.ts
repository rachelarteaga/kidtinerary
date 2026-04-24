import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { filterDueReminders, type ReminderRow } from "@/lib/notify";
import {
  registrationReminderHtml,
  sendEmail,
} from "@/lib/email";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role env vars not set");
  return createClient(url, key) as any;
}

function verifyCron(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return req.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const now = new Date();

  // Fetch all unsent reminders that are due, joining user email + activity name
  const { data: rows, error } = await supabase
    .from("reminders")
    .select(`
      id, user_id, activity_id, type, remind_at, sent_at,
      activity:activities(name, slug),
      profile:profiles(email:users(email), notification_preferences)
    `)
    .is("sent_at", null)
    .lte("remind_at", now.toISOString());

  if (error) {
    console.error("notify cron fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten to ReminderRow shape (Supabase join nesting)
  const reminders: ReminderRow[] = (rows ?? []).map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    activity_id: r.activity_id,
    type: r.type,
    remind_at: r.remind_at,
    sent_at: r.sent_at,
    user_email: r.profile?.email ?? "",
    activity_name: r.activity?.name ?? "an activity",
    activity_slug: r.activity?.slug ?? "",
    notification_preferences: r.profile?.notification_preferences ?? null,
  }));

  const due = filterDueReminders(reminders, now);

  let sent = 0;
  let failed = 0;

  for (const reminder of due) {
    if (!reminder.user_email) continue;

    const activityUrl = `https://kidtinerary.com/activity/${reminder.activity_slug}`;
    const subjectMap: Record<string, string> = {
      registration_opens: `Registration opens soon — ${reminder.activity_name}`,
      registration_closes: `Registration closes soon — ${reminder.activity_name}`,
      custom: `Your reminder — ${reminder.activity_name}`,
    };

    try {
      await sendEmail({
        to: reminder.user_email,
        subject: subjectMap[reminder.type] ?? `Reminder: ${reminder.activity_name}`,
        html: registrationReminderHtml({
          activityName: reminder.activity_name,
          reminderType: reminder.type,
          remindAt: reminder.remind_at,
          activityUrl,
        }),
      });

      // Mark as sent
      await supabase
        .from("reminders")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", reminder.id);

      sent++;
    } catch (err) {
      console.error(`Failed to send reminder ${reminder.id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({ due: due.length, sent, failed });
}
