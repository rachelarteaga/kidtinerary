import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchScrapeJob } from "@/lib/queries";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const job = await fetchScrapeJob(id, user.id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // When the job has resolved to an activity, include the scraped fields the
  // Add-Camp drawer renders in its review step. Before then, `activity` is null
  // and the client keeps polling.
  let activity = null;
  if (job.activity_id) {
    const { data: activityRow } = await supabase
      .from("activities")
      .select(
        "id, name, description, registration_url, source_url, age_min, age_max, indoor_outdoor, categories, data_confidence, verified, organization:organizations(id, name, website)"
      )
      .eq("id", job.activity_id)
      .maybeSingle();

    if (activityRow) {
      const [sessionsRes, pricesRes, locationsRes] = await Promise.all([
        supabase
          .from("sessions")
          .select("id, starts_at, ends_at, time_slot, hours_start, hours_end, is_sold_out")
          .eq("activity_id", job.activity_id)
          .order("starts_at", { ascending: true }),
        supabase
          .from("price_options")
          .select("id, label, price_cents, price_unit, confidence")
          .eq("activity_id", job.activity_id)
          .order("price_cents", { ascending: true }),
        supabase
          .from("activity_locations")
          .select("id, location_name, address")
          .eq("activity_id", job.activity_id),
      ]);

      activity = {
        ...activityRow,
        sessions: sessionsRes.data ?? [],
        prices: pricesRes.data ?? [],
        locations: locationsRes.data ?? [],
      };
    }
  }

  return NextResponse.json({ job, activity });
}
