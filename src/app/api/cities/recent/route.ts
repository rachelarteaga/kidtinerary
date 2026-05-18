import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Returns the list of (city, state) pairs the current user has previously
 *  submitted activities for, deduped and ordered by most-recent use. Feeds
 *  the city autocomplete in the add-activity modal so parents rarely have
 *  to retype their local town. */
export async function GET() {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ cities: [] });

  // Pull the user's activities and group by region. Region is stored
  // pre-normalized as "{lowercased city}, {STATE}" — we split that back into
  // a display-formatted "City, ST" string for the datalist option.
  const { data } = await supabase
    .from("user_activities")
    .select("activity:activities!inner(region, created_at)")
    .eq("user_id", user.id)
    .order("activity(created_at)", { ascending: false })
    .limit(50);

  const seen = new Set<string>();
  const cities: string[] = [];
  for (const row of (data ?? []) as { activity: { region: string | null } }[]) {
    const region = row.activity?.region;
    if (!region || region === "online") continue;
    // Region format is "city, ST" (city lowercased, state uppercased). For
    // display we titlecase the city words so the datalist looks natural.
    const [rawCity, state] = region.split(",").map((s) => s.trim());
    if (!rawCity || !state) continue;
    const niceCity = rawCity
      .split(/\s+/)
      .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
    const display = `${niceCity}`;
    if (seen.has(display)) continue;
    seen.add(display);
    cities.push(display);
    if (cities.length >= 10) break;
  }

  return NextResponse.json({ cities });
}
