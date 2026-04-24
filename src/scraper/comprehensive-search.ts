/**
 * Comprehensive search-and-scrape pipeline for Kidtinerary.
 *
 * Runs a matrix of (town × category) Bing searches, collects unique org URLs,
 * fetches + LLM-extracts each, and upserts to Supabase.
 *
 * Usage (via run.ts):
 *   npx tsx src/scraper/run.ts --comprehensive           # batch 1
 *   npx tsx src/scraper/run.ts --comprehensive --batch 2 # batch 2
 *   npx tsx src/scraper/run.ts --comprehensive --all     # all batches
 */

import { createClient } from "@supabase/supabase-js";
import { load as cheerioLoad } from "cheerio";
import { extractWithLLM } from "@/scraper/adapters/llm-extractor";
import { upsertActivity } from "@/scraper/upsert";

// ---------------------------------------------------------------------------
// Search matrix
// ---------------------------------------------------------------------------

export const BATCH1_TOWNS = [
  "Raleigh",
  "Cary",
  "Apex",
  "Durham",
  "Wake Forest",
  "Chapel Hill",
];

export const BATCH2_TOWNS = [
  "Holly Springs",
  "Fuquay-Varina",
  "Garner",
  "Knightdale",
  "Morrisville",
  "Carrboro",
  "Wendell",
  "Zebulon",
  "Rolesville",
  "Clayton",
  "Pittsboro",
  "Hillsborough",
];

export const ALL_TOWNS = [...BATCH1_TOWNS, ...BATCH2_TOWNS];

export const BATCH1_CATEGORIES = [
  "summer camp",
  "sports camp",
  "art class",
  "STEM camp",
  "swim lessons",
  "dance class",
  "gymnastics",
  "martial arts",
  "music lessons",
  "theater camp",
  "coding class",
  "nature camp",
  "cooking class",
  "tennis",
  "soccer",
];

export const BATCH2_CATEGORIES = [
  "day camp",
  "basketball",
  "baseball",
  "swim team",
  "karate",
  "taekwondo",
  "ballet",
  "painting class",
  "pottery",
  "robotics",
  "science camp",
  "piano lessons",
  "guitar lessons",
  "drum lessons",
  "drama class",
  "acting class",
  "baking class",
  "outdoor adventure",
  "horseback riding",
  "golf",
  "lacrosse",
  "volleyball",
  "flag football",
  "tutoring",
  "academic enrichment",
  "language class",
  "Spanish class",
  "special needs camp",
  "sensory-friendly",
];

export const ALL_CATEGORIES = [...BATCH1_CATEGORIES, ...BATCH2_CATEGORIES];

// ---------------------------------------------------------------------------
// URL filtering
// ---------------------------------------------------------------------------

const EXCLUDED_DOMAINS = new Set([
  "fun4raleighkids.com",
  "triangleonthecheap.com",
  "kidsoutandabout.com",
  "raleighsummercamps.com",
  "campsearch.com",
  "macaronikid.com",
  "yelp.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "youtube.com",
  "pinterest.com",
  "linkedin.com",
  "tiktok.com",
  "nextdoor.com",
  "wikipedia.org",
  "amazon.com",
  "google.com",
  "bing.com",
  "indeed.com",
  "glassdoor.com",
  "bbb.org",
  "mapquest.com",
  "tripadvisor.com",
  "timeout.com",
  "eventbrite.com",
  "yellowpages.com",
  "activekids.com",
  "mykidcamp.com",
  "us-info.com",
  "active.com",
  "schoolhouse.com",
  "care.com",
  "raleighkidsguide.com",
  "reddit.com",
  "yelp.ca",
  "thumbtack.com",
  "angieslist.com",
  "homedepot.com",
  "groupon.com",
  "patch.com",
]);

function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function isExcludedUrl(url: string): boolean {
  const hostname = getHostname(url);
  if (!hostname) return true;
  return EXCLUDED_DOMAINS.has(hostname) || [...EXCLUDED_DOMAINS].some((d) => hostname.endsWith(`.${d}`));
}

export function filterUrls(urls: string[]): string[] {
  return urls.filter((url) => {
    if (!url.startsWith("http")) return false;
    if (isExcludedUrl(url)) return false;
    // Strip query strings and fragments — we want canonical origin/path
    try {
      const parsed = new URL(url);
      // Keep only scheme + host + pathname (drop query/hash)
      return true;
    } catch {
      return false;
    }
  });
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Normalize to origin only (strip path query fragment) for dedup purposes
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Bing search
// ---------------------------------------------------------------------------

export async function searchBing(query: string): Promise<string[]> {
  const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=20`;

  let html: string;
  try {
    const res = await globalThis.fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn(`[bing] HTTP ${res.status} for query "${query}"`);
      return [];
    }
    html = await res.text();
  } catch (err) {
    console.warn(`[bing] Fetch failed for "${query}": ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }

  const $ = cheerioLoad(html);
  const urls: string[] = [];

  // Bing uses <cite> tags with displayed URLs and <a> tags with actual href in result cards
  // Strategy 1: extract hrefs from result links (li.b_algo a[href])
  $("li.b_algo h2 a, li.b_algo .b_title a").each((_i, el) => {
    const href = $(el).attr("href");
    if (href && href.startsWith("http") && !href.includes("bing.com")) {
      urls.push(href);
    }
  });

  // Strategy 2: fallback — parse <cite> tags (domain text)
  if (urls.length === 0) {
    $("cite").each((_i, el) => {
      const raw = $(el).text().trim();
      if (!raw) return;
      const domain = raw.split("›")[0].trim();
      if (!domain) return;
      const urlStr = domain.startsWith("http") ? domain : `https://${domain}`;
      try {
        new URL(urlStr);
        urls.push(urlStr);
      } catch {
        // ignore invalid
      }
    });
  }

  return filterUrls(urls);
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role env vars not set");
  return createClient(url, key) as any;
}

export async function isAlreadyScraped(url: string): Promise<boolean> {
  const supabase = getServiceClient();
  const normalized = normalizeUrl(url);
  const { data } = await supabase
    .from("scrape_sources")
    .select("id, last_scraped_at")
    .or(`url.eq.${url},url.eq.${normalized}`)
    .not("last_scraped_at", "is", null)
    .maybeSingle();
  return !!data;
}

async function markScraped(url: string, supabase: any): Promise<void> {
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("scrape_sources")
    .select("id")
    .eq("url", url)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("scrape_sources")
      .update({ last_scraped_at: now, last_success_at: now, error_count: 0 })
      .eq("id", existing.id);
  } else {
    await supabase.from("scrape_sources").insert({
      url,
      adapter_type: "generic_llm",
      is_paused: false,
      error_count: 0,
      last_scraped_at: now,
      last_success_at: now,
    });
  }
}

// ---------------------------------------------------------------------------
// Scrape + upsert a single URL
// ---------------------------------------------------------------------------

export async function scrapeAndUpsert(
  url: string,
  orgHint?: string
): Promise<number> {
  let html: string;
  try {
    const res = await globalThis.fetch(url, {
      headers: {
        "User-Agent": "Kidtinerary-Scraper/1.0 (+https://kidtinerary.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.warn(`[scrape] HTTP ${res.status} for ${url}`);
      return 0;
    }
    html = await res.text();
  } catch (err) {
    console.warn(`[scrape] Fetch failed ${url}: ${err instanceof Error ? err.message : String(err)}`);
    return 0;
  }

  // Strip boilerplate before sending to LLM
  const $ = cheerioLoad(html);
  $("script, style, noscript, iframe, nav, header, footer, [aria-hidden='true']").remove();
  const content = $("body").text().replace(/\s+/g, " ").trim();
  const extractContent = content.length > 500 ? content : html;

  const result = await extractWithLLM(url, extractContent);

  if (result.errors.length > 0 && result.activities.length === 0) {
    console.warn(`[scrape] LLM errors for ${url}: ${result.errors[0]}`);
  }

  let upserted = 0;
  const supabase = getServiceClient();

  for (const activity of result.activities) {
    try {
      const upsertResult = await upsertActivity(
        { ...activity, sourceUrl: url },
        "high"
      );
      if (upsertResult.activityId) {
        upserted++;
      }
    } catch (err) {
      console.warn(
        `[scrape] Upsert failed for "${activity.name}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Record the scrape in scrape_sources regardless of upsert count
  await markScraped(url, supabase);

  return upserted;
}

// ---------------------------------------------------------------------------
// Delay helper
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface ComprehensiveStats {
  totalSearches: number;
  totalUrlsFound: number;
  totalUniqueUrls: number;
  totalScraped: number;
  totalUpserted: number;
  errors: string[];
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Main batch runner
// ---------------------------------------------------------------------------

export async function runBatch(
  towns: string[],
  categories: string[]
): Promise<ComprehensiveStats> {
  const startTime = Date.now();
  const stats: ComprehensiveStats = {
    totalSearches: 0,
    totalUrlsFound: 0,
    totalUniqueUrls: 0,
    totalScraped: 0,
    totalUpserted: 0,
    errors: [],
    durationMs: 0,
  };

  // Global dedup set — keyed by normalized origin (scheme + hostname)
  const seenOrigins = new Set<string>();

  // Pre-load already-scraped URLs from DB to avoid re-scraping
  console.log("[comprehensive] Loading previously scraped URLs from DB...");
  const supabase = getServiceClient();
  try {
    const { data: existing } = await supabase
      .from("scrape_sources")
      .select("url")
      .not("last_scraped_at", "is", null);
    for (const row of existing ?? []) {
      seenOrigins.add(normalizeUrl(row.url));
    }
    console.log(`[comprehensive] ${seenOrigins.size} previously scraped URLs loaded`);
  } catch (err) {
    console.warn(`[comprehensive] Could not load existing scrape_sources: ${err instanceof Error ? err.message : String(err)}`);
  }

  const totalSearches = towns.length * categories.length;
  let searchIdx = 0;

  // Queue of URLs to scrape (deduplicated across all searches)
  const scrapeQueue: string[] = [];

  // --- Phase 1: Run all searches, collect unique URLs ---
  console.log(`\n[comprehensive] Phase 1: Running ${totalSearches} Bing searches...\n`);

  for (const town of towns) {
    for (const category of categories) {
      searchIdx++;
      const query = `${category} ${town} NC kids children`;
      process.stdout.write(`  [${searchIdx}/${totalSearches}] "${query}" → `);

      await sleep(2000); // rate limit between searches

      const urls = await searchBing(query);
      stats.totalUrlsFound += urls.length;
      stats.totalSearches++;

      // Deduplicate by normalized origin
      let newCount = 0;
      for (const url of urls) {
        const origin = normalizeUrl(url);
        if (!seenOrigins.has(origin)) {
          seenOrigins.add(origin);
          scrapeQueue.push(url);
          newCount++;
        }
      }

      console.log(`${urls.length} URLs (${newCount} new)`);
    }
  }

  stats.totalUniqueUrls = scrapeQueue.length;
  console.log(`\n[comprehensive] Phase 1 complete: ${scrapeQueue.length} unique URLs to scrape\n`);

  // --- Phase 2: Scrape each unique URL ---
  console.log(`[comprehensive] Phase 2: Scraping ${scrapeQueue.length} URLs...\n`);

  for (let i = 0; i < scrapeQueue.length; i++) {
    const url = scrapeQueue[i];
    const hostname = getHostname(url) ?? url;
    process.stdout.write(`  [${i + 1}/${scrapeQueue.length}] ${hostname} → `);

    await sleep(3000); // rate limit between LLM calls

    try {
      const upserted = await scrapeAndUpsert(url);
      stats.totalScraped++;
      stats.totalUpserted += upserted;
      console.log(`${upserted} activities upserted`);
    } catch (err) {
      const msg = `Scrape failed for ${url}: ${err instanceof Error ? err.message : String(err)}`;
      stats.errors.push(msg);
      console.log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  stats.durationMs = Date.now() - startTime;
  return stats;
}

// ---------------------------------------------------------------------------
// Entry point (called from run.ts)
// ---------------------------------------------------------------------------

export async function runComprehensive(options: {
  batch?: number;
  all?: boolean;
}): Promise<ComprehensiveStats> {
  let towns: string[];
  let categories: string[];

  if (options.all) {
    towns = ALL_TOWNS;
    categories = ALL_CATEGORIES;
    console.log(`\n=== COMPREHENSIVE SEARCH: All ${towns.length} towns × ${categories.length} categories = ${towns.length * categories.length} searches ===\n`);
  } else if (options.batch === 2) {
    towns = BATCH2_TOWNS;
    categories = BATCH2_CATEGORIES;
    console.log(`\n=== COMPREHENSIVE SEARCH Batch 2: ${towns.length} towns × ${categories.length} categories = ${towns.length * categories.length} searches ===\n`);
  } else {
    // Default: batch 1
    towns = BATCH1_TOWNS;
    categories = BATCH1_CATEGORIES;
    console.log(`\n=== COMPREHENSIVE SEARCH Batch 1: ${towns.length} towns × ${categories.length} categories = ${towns.length * categories.length} searches ===\n`);
  }

  const stats = await runBatch(towns, categories);

  // Final summary
  const mins = Math.floor(stats.durationMs / 60000);
  const secs = Math.floor((stats.durationMs % 60000) / 1000);

  console.log("\n=== Comprehensive Search Summary ===");
  console.log(`  Searches executed:       ${stats.totalSearches}`);
  console.log(`  Total URLs from results: ${stats.totalUrlsFound}`);
  console.log(`  Unique org URLs:         ${stats.totalUniqueUrls}`);
  console.log(`  Sites scraped:           ${stats.totalScraped}`);
  console.log(`  Activities upserted:     ${stats.totalUpserted}`);
  console.log(`  Duration:                ${mins}m ${secs}s`);
  if (stats.errors.length > 0) {
    console.log(`  Errors (${stats.errors.length}):`);
    stats.errors.slice(0, 10).forEach((e) => console.log(`    - ${e}`));
    if (stats.errors.length > 10) {
      console.log(`    ... and ${stats.errors.length - 10} more`);
    }
  }
  console.log("\nDone.");

  return stats;
}
