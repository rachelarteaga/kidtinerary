import { createClient } from "@supabase/supabase-js";
import { resolveAdapter } from "@/scraper/adapters/index";
import { upsertActivity } from "@/scraper/upsert";
import { isDuplicateOf, type DupeCandidate } from "@/scraper/dedupe";
import { geocodeWithCache } from "@/scraper/geocode-cache";

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
