import { createClient } from "@supabase/supabase-js";
import { resolveAdapter } from "@/scraper/adapters/index";
import { upsertActivity } from "@/scraper/upsert";
import { isDuplicateOf, type DupeCandidate } from "@/scraper/dedupe";
import { geocodeWithCache } from "@/scraper/geocode-cache";
import {
  createDiscoveryAdapter,
  createLLMAdapter,
  type DiscoveredActivity,
} from "@/scraper/adapters/llm-extractor";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role env vars not set");
  return createClient(url, key) as any;
}

export interface PipelineResult {
  sourceId: string;
  recordsFound: number;
  recordsUpserted: number;
  duplicatesSkipped: number;
  status: "success" | "partial" | "failed";
  errors: string[];
}

export interface DiscoveryPipelineResult {
  aggregatorUrl: string;
  discovered: number;
  withWebsite: number;
  detailScraped: number;
  detailUpserted: number;
  errors: string[];
}

/**
 * Runs the full scrape pipeline for a single ScrapeSource row.
 * Writes a scrape_logs row on completion.
 */
export async function runSource(sourceId: string): Promise<PipelineResult> {
  const supabase = getServiceClient();
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsUpserted = 0;
  let duplicatesSkipped = 0;

  // --- 1. Load the source row ---
  const { data: source, error: sourceError } = await supabase
    .from("scrape_sources")
    .select("id, url, adapter_type, error_count, is_paused")
    .eq("id", sourceId)
    .single();

  if (sourceError || !source) {
    return {
      sourceId,
      recordsFound: 0,
      recordsUpserted: 0,
      duplicatesSkipped: 0,
      status: "failed",
      errors: [`Source not found: ${sourceId}`],
    };
  }

  if (source.is_paused) {
    return {
      sourceId,
      recordsFound: 0,
      recordsUpserted: 0,
      duplicatesSkipped: 0,
      status: "failed",
      errors: ["Source is paused"],
    };
  }

  // --- 2. Resolve adapter ---
  const adapter = resolveAdapter(source.adapter_type, source.url);
  if (!adapter) {
    const msg = `No adapter for type '${source.adapter_type}' url '${source.url}'`;
    errors.push(msg);
    await writeLog(supabase, sourceId, startedAt, "failed", 0, errors);
    await incrementErrorCount(supabase, sourceId, source.error_count);
    return { sourceId, recordsFound: 0, recordsUpserted: 0, duplicatesSkipped: 0, status: "failed", errors };
  }

  // --- 3. Fetch via adapter ---
  let adapterResult;
  try {
    adapterResult = await adapter.fetch();
  } catch (err) {
    const msg = `Adapter threw: ${err instanceof Error ? err.message : String(err)}`;
    errors.push(msg);
    await writeLog(supabase, sourceId, startedAt, "failed", 0, errors);
    await incrementErrorCount(supabase, sourceId, source.error_count);
    return { sourceId, recordsFound: 0, recordsUpserted: 0, duplicatesSkipped: 0, status: "failed", errors };
  }

  errors.push(...adapterResult.errors);
  recordsFound = adapterResult.activities.length;

  // --- 4. Load existing activities for dedupe check ---
  const existingCandidates = await loadExistingCandidates(supabase);

  // --- 5. Process each scraped activity ---
  const confidence = source.adapter_type === "dedicated" ? "high"
    : source.adapter_type === "generic_llm" ? "low"
    : "medium";

  for (const scraped of adapterResult.activities) {
    try {
      // Geocode to get lat/lng for dedupe check
      const geo = await geocodeWithCache(scraped.address);

      if (geo) {
        const candidate: DupeCandidate = {
          name: scraped.name,
          lat: geo.lat,
          lng: geo.lng,
          sessions: scraped.sessions.map((s) => ({
            startsAt: s.startsAt,
            endsAt: s.endsAt,
          })),
        };

        const isDupe = existingCandidates.some((ex) => isDuplicateOf(candidate, ex));
        if (isDupe) {
          duplicatesSkipped++;
          continue;
        }

        // Add to in-memory dedupe set so we don't also dedupe against ourselves
        existingCandidates.push(candidate);
      }

      const result = await upsertActivity(scraped, confidence as "high" | "medium" | "low");
      if (result.activityId) {
        recordsUpserted++;
      }
      errors.push(...result.errors);
    } catch (err) {
      errors.push(
        `Upsert failed for "${scraped.name}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // --- 6. Update source metadata ---
  const status: "success" | "partial" | "failed" =
    errors.length === 0 ? "success"
    : recordsUpserted > 0 ? "partial"
    : "failed";

  if (status === "failed") {
    await incrementErrorCount(supabase, sourceId, source.error_count);
  } else {
    // Reset error count on success/partial
    await supabase
      .from("scrape_sources")
      .update({ last_scraped_at: new Date().toISOString(), last_success_at: new Date().toISOString(), error_count: 0 })
      .eq("id", sourceId);
  }

  await writeLog(supabase, sourceId, startedAt, status, recordsFound, errors);

  return { sourceId, recordsFound, recordsUpserted, duplicatesSkipped, status, errors };
}

// ---------------------------------------------------------------------------
// Two-pass pipeline: Discovery → Detail
// ---------------------------------------------------------------------------

/**
 * Pass 1: Discovery only — scrapes an aggregator URL to discover activities and
 * their real website URLs. Stores them as placeholder activities with
 * data_confidence: 'low'. Returns the list of discovered activities.
 */
export async function runDiscoveryPass(aggregatorUrl: string): Promise<{
  discovered: DiscoveredActivity[];
  errors: string[];
}> {
  const errors: string[] = [];
  const adapter = createDiscoveryAdapter(aggregatorUrl);

  let result;
  try {
    result = await adapter.fetch();
  } catch (err) {
    errors.push(`Discovery fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    return { discovered: [], errors };
  }

  errors.push(...result.errors);
  console.log(`[discovery] ${aggregatorUrl} → ${result.activities.length} activities found`);

  return { discovered: result.activities, errors };
}

/**
 * Pass 2: Detail scrape — fetches a single activity website URL and extracts
 * full pricing, session, and schedule data. Upserts with data_confidence: 'scraped'.
 */
export async function runDetailPass(websiteUrl: string): Promise<{
  upserted: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const adapter = createLLMAdapter(websiteUrl);

  let result;
  try {
    result = await adapter.fetch();
  } catch (err) {
    errors.push(`Detail fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    return { upserted: 0, errors };
  }

  errors.push(...result.errors);

  let upserted = 0;
  for (const activity of result.activities) {
    try {
      const upsertResult = await upsertActivity(
        { ...activity, sourceUrl: websiteUrl },
        "high" // detail-scraped from actual org site = high confidence
      );
      if (upsertResult.activityId) {
        upserted++;
      }
      errors.push(...upsertResult.errors);
    } catch (err) {
      errors.push(
        `Detail upsert failed for "${activity.name}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { upserted, errors };
}

/**
 * Full two-pass pipeline:
 * 1. Discover activities from an aggregator URL
 * 2. For each discovered activity with a website URL, run the detail pass
 *
 * Skips detail scrape for orgs whose website was already scraped within
 * `maxAgeHours` hours (default: 72h).
 */
export async function runDiscoveryThenDetail(
  aggregatorUrl: string,
  options: { maxAgeHours?: number; dryRun?: boolean } = {}
): Promise<DiscoveryPipelineResult> {
  const { maxAgeHours = 72, dryRun = false } = options;
  const supabase = getServiceClient();
  const errors: string[] = [];

  // --- Pass 1: Discovery ---
  const { discovered, errors: discoveryErrors } = await runDiscoveryPass(aggregatorUrl);
  errors.push(...discoveryErrors);

  const withWebsite = discovered.filter((a) => a.organizationWebsite);
  console.log(`[discovery] ${discovered.length} activities discovered, ${withWebsite.length} have website URLs`);

  if (dryRun) {
    console.log("[discovery] Dry run — skipping detail pass and DB writes");
    return {
      aggregatorUrl,
      discovered: discovered.length,
      withWebsite: withWebsite.length,
      detailScraped: 0,
      detailUpserted: 0,
      errors,
    };
  }

  // --- Pass 2: Detail scrape for each website URL ---
  let detailScraped = 0;
  let detailUpserted = 0;

  // Deduplicate by website URL
  const seenUrls = new Set<string>();
  const toDetail: DiscoveredActivity[] = [];
  for (const activity of withWebsite) {
    if (!activity.organizationWebsite || seenUrls.has(activity.organizationWebsite)) continue;
    seenUrls.add(activity.organizationWebsite);
    toDetail.push(activity);
  }

  for (const activity of toDetail) {
    const websiteUrl = activity.organizationWebsite!;

    // Check if we already have a recent scrape for this URL
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();
    const { data: existingSource } = await supabase
      .from("scrape_sources")
      .select("id, last_scraped_at, is_paused")
      .eq("url", websiteUrl)
      .maybeSingle();

    if (existingSource?.last_scraped_at && existingSource.last_scraped_at > cutoff) {
      console.log(`[detail] Skipping ${websiteUrl} (scraped ${existingSource.last_scraped_at})`);
      continue;
    }

    if (existingSource?.is_paused) {
      console.log(`[detail] Skipping ${websiteUrl} (source is paused)`);
      continue;
    }

    // Ensure a scrape_sources row exists for this website
    if (!existingSource) {
      const { error: insertError } = await supabase
        .from("scrape_sources")
        .insert({
          url: websiteUrl,
          adapter_type: "generic_llm",
          is_paused: false,
          error_count: 0,
        });
      if (insertError) {
        errors.push(`Failed to create scrape_sources row for ${websiteUrl}: ${insertError.message}`);
      }
    }

    console.log(`[detail] Scraping ${websiteUrl} (${activity.organizationName})`);
    const { upserted, errors: detailErrors } = await runDetailPass(websiteUrl);
    errors.push(...detailErrors);
    detailScraped++;
    detailUpserted += upserted;

    // Update the scrape_sources row with the latest scrape time
    const errorOccurred = detailErrors.length > 0 && upserted === 0;
    await supabase
      .from("scrape_sources")
      .update({
        last_scraped_at: new Date().toISOString(),
        ...(errorOccurred ? {} : { last_success_at: new Date().toISOString(), error_count: 0 }),
      })
      .eq("url", websiteUrl);
  }

  return {
    aggregatorUrl,
    discovered: discovered.length,
    withWebsite: withWebsite.length,
    detailScraped,
    detailUpserted,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadExistingCandidates(supabase: any): Promise<DupeCandidate[]> {
  // Load existing activities with at least one session + a geocoded location
  const { data } = await supabase
    .from("activities")
    .select(`
      name,
      sessions(starts_at, ends_at),
      activity_locations(location)
    `)
    .eq("is_active", true)
    .limit(5000);

  if (!data) return [];

  return (data as any[]).flatMap((row) => {
    const locationRow = row.activity_locations?.[0];
    if (!locationRow?.location) return [];

    let lat = 0;
    let lng = 0;
    try {
      const geo =
        typeof locationRow.location === "string"
          ? JSON.parse(locationRow.location)
          : locationRow.location;
      [lng, lat] = geo.coordinates as [number, number];
    } catch {
      return [];
    }

    return [
      {
        name: row.name as string,
        lat,
        lng,
        sessions: (row.sessions ?? []).map((s: any) => ({
          startsAt: s.starts_at,
          endsAt: s.ends_at,
        })),
      },
    ];
  });
}

async function writeLog(
  supabase: any,
  sourceId: string,
  startedAt: string,
  status: "success" | "partial" | "failed",
  recordsFound: number,
  errors: string[]
): Promise<void> {
  await supabase.from("scrape_logs").insert({
    source_id: sourceId,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    status,
    records_found: recordsFound,
    errors: errors.length > 0 ? errors : null,
  });
}

async function incrementErrorCount(
  supabase: any,
  sourceId: string,
  currentCount: number
): Promise<void> {
  const newCount = currentCount + 1;
  const updates: Record<string, unknown> = {
    error_count: newCount,
    last_scraped_at: new Date().toISOString(),
  };

  // Pause after 3 consecutive failures
  if (newCount >= 3) {
    updates.is_paused = true;
    console.warn(`[scraper] Source ${sourceId} paused after ${newCount} consecutive failures`);
  }

  await supabase.from("scrape_sources").update(updates).eq("id", sourceId);
}
