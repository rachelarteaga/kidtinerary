import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { weeklyDigestHtml, sendEmail } from "@/lib/email";
import { formatWeekRange, getWeekStart } from "@/lib/format";

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

  // Fetch all users with their email and notification prefs
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, notification_preferences, users(email)")
    .not("users", "is", null);

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  // Fetch children for all users
  const { data: children, error: childrenError } = await supabase
    .from("children")
    .select("id, user_id, name, birth_date, interests");

  if (childrenError) {
    return NextResponse.json({ error: childrenError.message }, { status: 500 });
  }

  // Fetch activities added in the last 7 days that are active
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: newActivities, error: activitiesError } = await supabase
    .from("activities")
    .select("id, name, slug, categories, age_min, age_max, scraped_at")
    .eq("is_active", true)
    .gte("scraped_at", since);

  if (activitiesError) {
    return NextResponse.json({ error: activitiesError.message }, { status: 500 });
  }

  // Fetch planner entries for coverage-gap detection (next 12 weeks)
  const todayStr = new Date().toISOString().split("T")[0];
  const twelveWeeks = new Date();
  twelveWeeks.setDate(twelveWeeks.getDate() + 84);
  const twelveWeeksStr = twelveWeeks.toISOString().split("T")[0];

  const { data: plannerEntries } = await supabase
    .from("planner_entries")
    .select("child_id, session:sessions(starts_at, ends_at)")
    .neq("status", "cancelled")
    .gte("session.starts_at", todayStr)
    .lte("session.ends_at", twelveWeeksStr);

  // Build coverage map: child_id -> Set<weekKey>
  const coveredWeeks: Record<string, Set<string>> = {};
  for (const entry of plannerEntries ?? []) {
    if (!entry.session?.starts_at) continue;
    const key = entry.child_id;
    if (!coveredWeeks[key]) coveredWeeks[key] = new Set();
    const weekStart = getWeekStart(new Date(entry.session.starts_at + "T00:00:00"));
    coveredWeeks[key].add(weekStart.toISOString().split("T")[0]);
  }

  // Generate next 12 week-start dates for gap comparison
  const upcomingWeeks: Date[] = [];
  const cursor = getWeekStart(new Date());
  for (let i = 0; i < 12; i++) {
    upcomingWeeks.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  const profileList = profiles ?? [];
  const childrenList = children ?? [];
  const newActivityList = newActivities ?? [];

  for (const profile of profileList) {
    const email = profile.users?.email;
    if (!email) { skipped++; continue; }

    // Check global digest preference — default to enabled
    const prefs: Record<string, boolean> = profile.notification_preferences ?? {};
    if (prefs.weekly_digest === false) { skipped++; continue; }

    const userChildren = childrenList.filter((c: any) => c.user_id === profile.user_id);
    if (userChildren.length === 0) { skipped++; continue; }

    for (const child of userChildren) {
      // New matches: activities that overlap child's interests and age
      const childAge = child.birth_date
        ? Math.floor(
            (Date.now() - new Date(child.birth_date).getTime()) /
              (1000 * 60 * 60 * 24 * 365.25)
          )
        : null;

      const newMatches = newActivityList.filter((a: any) => {
        const interestMatch =
          !child.interests?.length ||
          (a.categories ?? []).some((cat: string) => child.interests.includes(cat));
        const ageMatch =
          childAge == null ||
          ((a.age_min == null || a.age_min <= childAge) &&
            (a.age_max == null || a.age_max >= childAge));
        return interestMatch && ageMatch;
      });

      // Coverage gaps
      const covered = coveredWeeks[child.id] ?? new Set<string>();
      const gapWeeks = upcomingWeeks
        .filter((w) => !covered.has(w.toISOString().split("T")[0]))
        .map((w) => formatWeekRange(w));

      if (newMatches.length === 0 && gapWeeks.length === 0) continue;

      try {
        await sendEmail({
          to: email,
          subject: `This week's KidPlan update for ${child.name}`,
          html: weeklyDigestHtml({
            childName: child.name,
            newMatches: newMatches.map((a: any) => ({
              name: a.name,
              slug: a.slug,
              categories: a.categories ?? [],
              ageMin: a.age_min,
              ageMax: a.age_max,
            })),
            coverageGapWeeks: gapWeeks.slice(0, 4), // max 4 gap weeks in digest
          }),
        });
        sent++;
      } catch (err) {
        console.error(`digest send failed for ${email}:`, err);
        failed++;
      }
    }
  }

  return NextResponse.json({ sent, failed, skipped });
}
