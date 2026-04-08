import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { ScrapedActivity, ScrapedPrice } from "@/scraper/types";
import { toSlug, priceToCents, assignCategories, extractAgeRange } from "@/scraper/normalize";
import { geocodeWithCache } from "@/scraper/geocode-cache";

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role env vars not set");
  return createClient(url, key);
}

export interface UpsertResult {
  activityId: string | null;
  created: boolean;
  errors: string[];
}

/**
 * Upserts a single scraped activity (plus its org, locations, sessions, prices)
 * into Supabase. Returns the activity UUID.
 */
export async function upsertActivity(
  scraped: ScrapedActivity,
  confidence: "high" | "medium" | "low" = "medium"
): Promise<UpsertResult> {
  const supabase = getServiceClient() as any;
  const errors: string[] = [];

  // --- 1. Upsert Organization ---
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .upsert(
      {
        name: scraped.organizationName,
        website: scraped.organizationWebsite ?? null,
      },
      { onConflict: "name", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (orgError || !org) {
    errors.push(`Org upsert failed: ${orgError?.message}`);
    return { activityId: null, created: false, errors };
  }
  const orgId: string = org.id;

  // --- 2. Normalize activity fields ---
  const name = scraped.name.trim();
  const slug = toSlug(name);
  const categories =
    scraped.categories?.length
      ? scraped.categories
      : assignCategories(name, scraped.description ?? "");
  const ageRange = scraped.ageText ? extractAgeRange(scraped.ageText) : null;

  const activityPayload = {
    organization_id: orgId,
    name,
    slug,
    description: scraped.description ?? null,
    categories,
    age_min: ageRange?.min ?? null,
    age_max: ageRange?.max ?? null,
    indoor_outdoor: scraped.indoorOutdoor,
    registration_url: scraped.registrationUrl ?? null,
    source_url: scraped.sourceUrl,
    scraped_at: new Date().toISOString(),
    data_confidence: confidence,
    is_active: true,
  };

  // --- 3. Upsert Activity ---
  const { data: activity, error: actError } = await supabase
    .from("activities")
    .upsert(activityPayload, { onConflict: "slug" })
    .select("id")
    .single();

  if (actError || !activity) {
    errors.push(`Activity upsert failed: ${actError?.message}`);
    return { activityId: null, created: false, errors };
  }
  const activityId: string = activity.id;

  // --- 4. Geocode & upsert primary location ---
  const geoResult = await geocodeWithCache(scraped.address);
  if (geoResult) {
    const locationPayload = {
      activity_id: activityId,
      address: scraped.address,
      location_name: scraped.locationName ?? null,
      // PostGIS geography point — Supabase accepts WKT via rpc or raw insert
      // Use raw string: POINT(lng lat)
      location: `POINT(${geoResult.lng} ${geoResult.lat})`,
    };
    const { error: locError } = await supabase
      .from("activity_locations")
      .upsert(locationPayload, { onConflict: "activity_id,address" });
    if (locError) {
      errors.push(`Location upsert failed: ${locError.message}`);
    }
  } else {
    errors.push(`Geocode failed for address: ${scraped.address}`);
  }

  // --- 5. Get the location ID we just upserted ---
  const { data: locationRow } = await supabase
    .from("activity_locations")
    .select("id")
    .eq("activity_id", activityId)
    .eq("address", scraped.address)
    .maybeSingle();
  const locationId: string | null = locationRow?.id ?? null;

  // --- 6. Upsert sessions ---
  for (const session of scraped.sessions) {
    const sessionPayload = {
      activity_id: activityId,
      activity_location_id: locationId,
      starts_at: session.startsAt,
      ends_at: session.endsAt,
      time_slot: session.timeSlot,
      hours_start: session.hoursStart ?? null,
      hours_end: session.hoursEnd ?? null,
      spots_available: session.spotsAvailable ?? null,
      is_sold_out: session.isSoldOut,
    };
    const { error: sessError } = await supabase
      .from("sessions")
      .upsert(sessionPayload, {
        onConflict: "activity_id,starts_at,ends_at,time_slot",
      });
    if (sessError) {
      errors.push(`Session upsert failed (${session.startsAt}): ${sessError.message}`);
    }
  }

  // --- 7. Upsert activity-level prices ---
  await upsertPrices(supabase, activityId, null, scraped.prices, confidence, errors);

  return { activityId, created: true, errors };
}

async function upsertPrices(
  supabase: any,
  activityId: string,
  sessionId: string | null,
  prices: ScrapedPrice[],
  confidence: "high" | "medium" | "low",
  errors: string[]
): Promise<void> {
  // Map confidence level: high scraper → verified, medium → scraped, low → llm_extracted
  const priceConfidence =
    confidence === "high" ? "verified" : confidence === "low" ? "llm_extracted" : "scraped";

  for (const price of prices) {
    const priceCents = priceToCents(price.priceString);
    if (priceCents === null) {
      errors.push(`Could not parse price "${price.priceString}" — skipped`);
      continue;
    }

    const payload = {
      activity_id: activityId,
      session_id: sessionId,
      label: price.label,
      price_cents: priceCents,
      price_unit: price.priceUnit,
      conditions: price.conditions ?? null,
      valid_from: price.validFrom ?? null,
      valid_until: price.validUntil ?? null,
      confidence: priceConfidence,
    };

    const { error } = await supabase
      .from("price_options")
      .upsert(payload, { onConflict: "activity_id,session_id,label" });
    if (error) {
      errors.push(`Price upsert failed ("${price.label}"): ${error.message}`);
    }
  }
}
