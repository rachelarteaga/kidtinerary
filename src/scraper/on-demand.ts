// Runs a single scrape job: pulls the scrape_jobs row, scrapes, scores, writes back.
//
// Called by the on-demand scrape API route (and eventually a worker). Reads a
// scrape_jobs row, fetches HTML either directly (URL input) or via Bing search
// (free-text input), runs the Tier 3 LLM extractor, scores confidence, and —
// if high or partial — upserts the activity. The job row is updated with the
// final status, confidence, and top candidates.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { scoreConfidence, type Candidate } from "@/scraper/confidence";
import { extractWithLLM } from "@/scraper/adapters/llm-extractor";
import { searchAndScrapeOrg } from "@/scraper/pipeline";
import { upsertActivity } from "@/scraper/upsert";
import type { ScrapedActivity } from "@/scraper/types";

interface RunJobArgs {
  jobId: string;
}

function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role env vars not set");
  return createClient(url, key);
}

const USER_AGENT = "KidtineraryBot/1.0 (+https://kidtinerary.app)";

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await globalThis.fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function runScrapeJob({ jobId }: RunJobArgs): Promise<void> {
  const supabase = createServiceClient() as any;

  const { data: job } = await supabase
    .from("scrape_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (!job) return;

  await supabase.from("scrape_jobs").update({ status: "running" }).eq("id", jobId);

  try {
    const input = (job.input as string).trim();
    const isURL = /^https?:\/\//i.test(input);
    let html: string | null = null;
    let sourceUrl: string | null = null;

    if (isURL) {
      sourceUrl = input;
      html = await fetchHtml(input);
    } else {
      // Free-text input: Bing search for the org's official site, then fetch.
      // searchAndScrapeOrg filters out aggregator domains and returns the first
      // plausible official URL, or null.
      const locationHint =
        typeof job.context?.location_hint === "string" && job.context.location_hint.length > 0
          ? (job.context.location_hint as string)
          : "Raleigh NC";
      const foundUrl = await searchAndScrapeOrg(input, locationHint);
      if (!foundUrl) {
        await supabase
          .from("scrape_jobs")
          .update({
            status: "resolved",
            confidence: "none",
            resolved_at: new Date().toISOString(),
          })
          .eq("id", jobId);
        return;
      }
      sourceUrl = foundUrl;
      html = await fetchHtml(foundUrl);
    }

    if (!html || !sourceUrl) {
      await supabase
        .from("scrape_jobs")
        .update({
          status: "failed",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      return;
    }

    const extracted = await extractWithLLM(sourceUrl, html);

    const candidates: Candidate[] = (extracted.activities ?? []).map((a) => ({
      name: a.name,
      // Activities from the LLM extractor don't carry a numeric score today;
      // default to 0.8 which is the "strong enough" threshold. If/when the
      // extractor starts emitting per-candidate confidence, surface it here.
      score: 0.8,
      fields: {
        name: !!a.name,
        dates: (a.sessions?.length ?? 0) > 0,
        price: (a.prices?.length ?? 0) > 0,
        location: !!a.address,
        ages: !!a.ageText,
      },
    }));

    const confidence = scoreConfidence({ candidates });

    const stubActivityId =
      typeof job.context?.activity_id === "string" ? (job.context.activity_id as string) : null;
    let activityId: string | null = stubActivityId;

    if ((confidence === "high" || confidence === "partial") && extracted.activities.length > 0) {
      const best = extracted.activities[0] as ScrapedActivity;
      const upsertConfidence = confidence === "high" ? "high" : "medium";
      // When submitCamp created a stub activity for this user, enrich that
      // row in place so user_activities.activity_id keeps pointing at the same
      // row after scraping completes. Without this the slug-based upsert
      // below would create a parallel canonical row and the stub would be
      // orphaned — leaving the user's shortlist stuck on the URL-as-name.
      const result = await upsertActivity(best, upsertConfidence, {
        existingActivityId: stubActivityId ?? undefined,
      });
      if (result.activityId) {
        activityId = result.activityId;
      }
    }

    // Serialize candidates in the shape expected by scrape_jobs.candidates:
    // { activity_id, name, score }[]. We don't have per-candidate activity IDs
    // at this point (only the top one is upserted), so we pass the resolved
    // activity_id for the first candidate and null for the rest.
    const serializedCandidates = candidates.slice(0, 3).map((c, i) => ({
      activity_id: i === 0 ? activityId : null,
      name: c.name,
      score: c.score,
    }));

    await supabase
      .from("scrape_jobs")
      .update({
        status: "resolved",
        confidence,
        activity_id: activityId,
        candidates: serializedCandidates,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  } catch (err) {
    console.error("runScrapeJob error:", err);
    await supabase
      .from("scrape_jobs")
      .update({
        status: "failed",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  }
}
