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

const ADULT_KEYWORDS = [
  "adult", "seniors", "senior", "masters swim", "lifeguard training",
  "corporate", "wedding", "teens and adults", "teen & adult",
  "50+", "55+", "60+", "65+",
];

function isAdultOnly(name: string): boolean {
  const lower = name.toLowerCase();
  return ADULT_KEYWORDS.some((kw) => lower.includes(kw));
}

export interface UpsertOptions {
  /**
   * When set, enrich this existing activity row in place instead of creating a
   * new canonical one. Used by the on-demand scraper so user_activities rows pointing
   * at the submitCamp stub stay linked after enrichment — without this, the
   * slug-based upsert creates a parallel canonical row and the stub is orphaned.
   */
  existingActivityId?: string;
}

/**
 * Upserts a single scraped activity (plus its org, locations, sessions, prices)
 * into Supabase. Returns the activity UUID.
 * Filters out adult-only activities automatically.
 */
export async function upsertActivity(
  scraped: ScrapedActivity,
  confidence: "high" | "medium" | "low" = "medium",
  options: UpsertOptions = {}
): Promise<UpsertResult> {
  // Skip adult-only activities
  if (isAdultOnly(scraped.name)) {
    return { activityId: null, created: false, errors: [`Skipped adult-only: ${scraped.name}`] };
  }

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
  if (!scraped.name) {
    errors.push("Activity skipped: missing name");
    return { activityId: null, created: false, errors };
  }
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
    indoor_outdoor: (["indoor", "outdoor", "both"].includes(scraped.indoorOutdoor) ? scraped.indoorOutdoor : "both") as "indoor" | "outdoor" | "both",
    registration_url: scraped.registrationUrl ?? null,
    source_url: scraped.sourceUrl,
    scraped_at: new Date().toISOString(),
    data_confidence: confidence,
    is_active: true,
  };

  // --- 3. Upsert / update Activity ---
  // In stub mode we preserve the existing slug (it's a URL-based placeholder
  // that's guaranteed unique; changing it to toSlug(name) risks a collision
  // with a canonical activity that already has that slug).
  let activityId: string;
  if (options.existingActivityId) {
    const { slug: _slug, ...stubUpdatePayload } = activityPayload;
    void _slug;
    // Preserve the user-submitted registration_url when the scraper didn't
    // find one — otherwise we'd wipe the URL the user originally pasted.
    if (stubUpdatePayload.registration_url == null) {
      delete (stubUpdatePayload as { registration_url?: string | null }).registration_url;
    }
    const { data: updated, error: updateError } = await supabase
      .from("activities")
      .update(stubUpdatePayload)
      .eq("id", options.existingActivityId)
      .select("id")
      .single();
    if (updateError || !updated) {
      errors.push(`Activity update failed: ${updateError?.message}`);
      return { activityId: null, created: false, errors };
    }
    activityId = updated.id;
  } else {
    const { data: activity, error: actError } = await supabase
      .from("activities")
      .upsert(activityPayload, { onConflict: "slug" })
      .select("id")
      .single();

    if (actError || !activity) {
      errors.push(`Activity upsert failed: ${actError?.message}`);
      return { activityId: null, created: false, errors };
    }
    activityId = activity.id;
  }

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
  const validTimeSlots = new Set(["full_day", "am_half", "pm_half"]);
  for (const session of scraped.sessions) {
    // Skip sessions with missing required fields
    if (!session.startsAt || !session.endsAt) {
      errors.push(`Session skipped: missing starts_at or ends_at`);
      continue;
    }
    if (!locationId) {
      errors.push(`Session skipped (${session.startsAt}): no location resolved`);
      continue;
    }
    // Normalize time_slot — LLM sometimes returns "both" or other invalid values
    const timeSlot = validTimeSlots.has(session.timeSlot) ? session.timeSlot : "full_day";

    const sessionPayload = {
      activity_id: activityId,
      activity_location_id: locationId,
      starts_at: session.startsAt,
      ends_at: session.endsAt,
      time_slot: timeSlot,
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

  const validPriceUnits = new Set(["per_week", "per_day", "per_session", "per_block"]);
  for (const price of prices) {
    const priceCents = priceToCents(price.priceString);
    if (priceCents === null) {
      errors.push(`Could not parse price "${price.priceString}" — skipped`);
      continue;
    }
    // Normalize price_unit — LLM sometimes returns values not in the enum
    const priceUnit = validPriceUnits.has(price.priceUnit) ? price.priceUnit : "per_session";

    const payload = {
      activity_id: activityId,
      session_id: sessionId,
      label: price.label,
      price_cents: priceCents,
      price_unit: priceUnit,
      conditions: price.conditions ?? null,
      valid_from: price.validFrom ?? null,
      valid_until: price.validUntil ?? null,
      confidence: priceConfidence,
    };

    // Partial unique indexes on price_options can't be used with PostgREST onConflict.
    // Instead, do a select-then-insert/update pattern.
    let existingQuery = supabase
      .from("price_options")
      .select("id")
      .eq("activity_id", activityId)
      .eq("label", price.label);
    if (sessionId) {
      existingQuery = existingQuery.eq("session_id", sessionId);
    } else {
      existingQuery = existingQuery.is("session_id", null);
    }
    const { data: existing } = await existingQuery.maybeSingle();

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("price_options")
        .update(payload)
        .eq("id", existing.id);
      if (updateError) {
        errors.push(`Price update failed ("${price.label}"): ${updateError.message}`);
      }
    } else {
      const { error: insertError } = await supabase
        .from("price_options")
        .insert(payload);
      if (insertError) {
        errors.push(`Price insert failed ("${price.label}"): ${insertError.message}`);
      }
    }
  }
}
