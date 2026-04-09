/**
 * CLI runner for local testing and manual scrape triggering.
 *
 * Usage:
 *   npx tsx src/scraper/run.ts --source raleigh-parks
 *   npx tsx src/scraper/run.ts --all
 *   npx tsx src/scraper/run.ts --adapter-type dedicated
 *   npx tsx src/scraper/run.ts --dry-run --source raleigh-parks
 *
 *   # Two-pass pipeline
 *   npx tsx src/scraper/run.ts --discover <url>     # discovery pass on one aggregator
 *   npx tsx src/scraper/run.ts --detail <url>       # detail pass on one activity website
 *   npx tsx src/scraper/run.ts --full               # discover from all aggregators, then detail-scrape
 *   npx tsx src/scraper/run.ts --dry-run --discover <url>  # preview without DB writes
 *
 * Requires env vars (loaded from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GOOGLE_MAPS_API_KEY
 *   ANTHROPIC_API_KEY   (only for generic_llm sources)
 */

// Load .env.local manually (tsx doesn't auto-load it)
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { runSource, runDiscoveryThenDetail, runDiscoveryPass, runDetailPass, runEnrichment } from "@/scraper/pipeline";
import { getAdapter, getAllAdapters } from "@/scraper/adapters/index";
import { runComprehensive } from "@/scraper/comprehensive-search";

// ---------------------------------------------------------------------------
// Aggregator URLs for --full mode
// ---------------------------------------------------------------------------

const AGGREGATOR_URLS = [
  "https://fun4raleighkids.com/Camps/Variety-Camps/",
  "https://fun4raleighkids.com/Camps/Art-Camps/",
  "https://fun4raleighkids.com/Camps/Sports-Camps/",
  "https://fun4raleighkids.com/Camps/Academic-Camps/",
  "https://triangleonthecheap.com/summer-camps/",
  "https://rt.kidsoutandabout.com/content/guide-summer-camps-research-triangle-area",
  "https://www.raleighkidsguide.com/Summer_Camps.php",
];

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): {
  source?: string;
  all: boolean;
  adapterType?: string;
  dryRun: boolean;
  discover?: string;
  detail?: string;
  full: boolean;
  enrich: boolean;
  comprehensive: boolean;
  batch?: number;
} {
  const args = argv.slice(2);
  let source: string | undefined;
  let all = false;
  let adapterType: string | undefined;
  let dryRun = false;
  let discover: string | undefined;
  let detail: string | undefined;
  let full = false;
  let enrich = false;
  let comprehensive = false;
  let batch: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) {
      source = args[++i];
    } else if (args[i] === "--all") {
      all = true;
    } else if (args[i] === "--adapter-type" && args[i + 1]) {
      adapterType = args[++i];
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--discover" && args[i + 1]) {
      discover = args[++i];
    } else if (args[i] === "--detail" && args[i + 1]) {
      detail = args[++i];
    } else if (args[i] === "--full") {
      full = true;
    } else if (args[i] === "--enrich") {
      enrich = true;
    } else if (args[i] === "--comprehensive") {
      comprehensive = true;
    } else if (args[i] === "--batch" && args[i + 1]) {
      batch = parseInt(args[++i], 10);
    }
  }

  return { source, all, adapterType, dryRun, discover, detail, full, enrich, comprehensive, batch };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { source, all, adapterType, dryRun, discover, detail, full, enrich, comprehensive, batch } = parseArgs(process.argv);

  const hasCommand = source || all || adapterType || discover || detail || full || enrich || comprehensive;
  if (!hasCommand) {
    console.error("Usage:");
    console.error("  npx tsx src/scraper/run.ts --source <adapter-name>");
    console.error("  npx tsx src/scraper/run.ts --all");
    console.error("  npx tsx src/scraper/run.ts --adapter-type dedicated|generic_llm");
    console.error("  npx tsx src/scraper/run.ts --discover <aggregator-url>");
    console.error("  npx tsx src/scraper/run.ts --detail <activity-website-url>");
    console.error("  npx tsx src/scraper/run.ts --full");
    console.error("  npx tsx src/scraper/run.ts --enrich");
    console.error("  npx tsx src/scraper/run.ts --comprehensive          # batch 1 (top 6 towns × 15 categories)");
    console.error("  npx tsx src/scraper/run.ts --comprehensive --batch 2 # batch 2 (remaining towns/categories)");
    console.error("  npx tsx src/scraper/run.ts --comprehensive --all    # all towns × all categories");
    console.error("  Add --dry-run to preview without writing to DB");
    process.exit(1);
  }

  // --- Comprehensive search mode ---
  if (comprehensive) {
    await runComprehensive({ batch, all });
    return;
  }

  // --- Enrich mode ---
  if (enrich) {
    console.log("\n=== ENRICH: search + scrape low-confidence orgs ===\n");
    const result = await runEnrichment();
    console.log("\n=== Enrichment summary ===");
    console.log(`  Unique orgs:     ${result.total}`);
    console.log(`  Searched:        ${result.searched}`);
    console.log(`  Websites found:  ${result.found}`);
    console.log(`  Sites scraped:   ${result.scraped}`);
    console.log(`  Activities added:${result.upserted}`);
    console.log(`  Skipped:         ${result.skipped}`);
    if (result.errors.length > 0) {
      console.log(`  Errors (${result.errors.length}):`);
      result.errors.slice(0, 10).forEach((e) => console.log(`    - ${e}`));
      if (result.errors.length > 10) console.log(`    ... and ${result.errors.length - 10} more`);
    }
    console.log("\nDone.");
    return;
  }

  // --- Two-pass modes ---

  if (full) {
    console.log(`\n=== FULL two-pass scrape: ${AGGREGATOR_URLS.length} aggregators ===\n`);
    let totalDiscovered = 0;
    let totalWithWebsite = 0;
    let totalDetailScraped = 0;
    let totalDetailUpserted = 0;
    const allErrors: string[] = [];

    for (const url of AGGREGATOR_URLS) {
      console.log(`\n→ Aggregator: ${url}`);
      try {
        const result = await runDiscoveryThenDetail(url, { dryRun });
        totalDiscovered += result.discovered;
        totalWithWebsite += result.withWebsite;
        totalDetailScraped += result.detailScraped;
        totalDetailUpserted += result.detailUpserted;
        allErrors.push(...result.errors);

        console.log(`  Discovered:      ${result.discovered}`);
        console.log(`  With website:    ${result.withWebsite}`);
        console.log(`  Detail scraped:  ${result.detailScraped}`);
        console.log(`  Detail upserted: ${result.detailUpserted}`);
        if (result.errors.length > 0) {
          console.log(`  Errors (${result.errors.length}):`);
          result.errors.slice(0, 5).forEach((e) => console.log(`    - ${e}`));
          if (result.errors.length > 5) console.log(`    ... and ${result.errors.length - 5} more`);
        }
      } catch (err) {
        console.error(`  FATAL: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    console.log("\n=== Full run summary ===");
    console.log(`  Total discovered:      ${totalDiscovered}`);
    console.log(`  Total with website:    ${totalWithWebsite}`);
    console.log(`  Total detail scraped:  ${totalDetailScraped}`);
    console.log(`  Total detail upserted: ${totalDetailUpserted}`);
    if (allErrors.length > 0) {
      console.log(`  Total errors: ${allErrors.length}`);
    }
    console.log("\nDone.");
    return;
  }

  if (discover) {
    console.log(`\n=== DISCOVERY pass: ${discover} ===\n`);
    if (dryRun) {
      const { discovered, errors } = await runDiscoveryPass(discover);
      console.log(`Found ${discovered.length} activities:`);
      discovered.forEach((a, i) => {
        console.log(`  [${i + 1}] ${a.name}`);
        console.log(`      org:     ${a.organizationName}`);
        console.log(`      website: ${a.organizationWebsite ?? "(none)"}`);
        console.log(`      address: ${a.address ?? "(none)"}`);
        console.log(`      cats:    ${a.categories.join(", ") || "(none)"}`);
      });
      if (errors.length > 0) {
        console.log(`\nErrors (${errors.length}):`);
        errors.forEach((e) => console.log(`  - ${e}`));
      }
    } else {
      const result = await runDiscoveryThenDetail(discover, { dryRun: false });
      console.log(`  Discovered:      ${result.discovered}`);
      console.log(`  With website:    ${result.withWebsite}`);
      console.log(`  Detail scraped:  ${result.detailScraped}`);
      console.log(`  Detail upserted: ${result.detailUpserted}`);
      if (result.errors.length > 0) {
        console.log(`  Errors (${result.errors.length}):`);
        result.errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
      }
    }
    console.log("\nDone.");
    return;
  }

  if (detail) {
    console.log(`\n=== DETAIL pass: ${detail} ===\n`);
    if (dryRun) {
      // Just fetch and show what the LLM returns
      const { createLLMAdapter } = await import("@/scraper/adapters/llm-extractor");
      const adapter = createLLMAdapter(detail);
      const result = await adapter.fetch();
      console.log(`Activities found: ${result.activities.length}`);
      result.activities.forEach((a, i) => {
        console.log(`  [${i + 1}] ${a.name}`);
        console.log(`      org:      ${a.organizationName}`);
        console.log(`      address:  ${a.address}`);
        console.log(`      sessions: ${a.sessions.length}`);
        console.log(`      prices:   ${a.prices.length}`);
        if (a.prices.length > 0) {
          a.prices.forEach((p) => console.log(`        · ${p.label}: ${p.priceString} ${p.priceUnit}`));
        }
      });
      if (result.errors.length > 0) {
        console.log(`\nErrors: ${result.errors.join("; ")}`);
      }
    } else {
      const { upserted, errors } = await runDetailPass(detail);
      console.log(`  Upserted: ${upserted}`);
      if (errors.length > 0) {
        console.log(`  Errors (${errors.length}):`);
        errors.forEach((e) => console.log(`  - ${e}`));
      }
    }
    console.log("\nDone.");
    return;
  }

  // --- Legacy modes (--source, --all, --adapter-type) ---

  if (dryRun) {
    await runDryRun(source, all);
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey) as any;

  // Build list of source IDs to run
  let sourceIds: string[] = [];

  if (source) {
    // Find by adapter name or URL
    const adapter = getAdapter(source);
    if (!adapter) {
      console.error(`No adapter found for name: ${source}`);
      process.exit(1);
    }
    const { data: sources } = await supabase
      .from("scrape_sources")
      .select("id")
      .eq("url", adapter.sourceUrl)
      .limit(1);
    if (!sources || sources.length === 0) {
      console.warn(`No scrape_sources row found for URL ${adapter.sourceUrl}.`);
      console.warn("Create a row in scrape_sources with that URL, then retry.");
      process.exit(1);
    }
    sourceIds = sources.map((r: any) => r.id as string);
  } else if (all || adapterType) {
    let query = supabase
      .from("scrape_sources")
      .select("id, adapter_type")
      .eq("is_paused", false);
    if (adapterType) {
      query = query.eq("adapter_type", adapterType);
    }
    const { data: sources } = await query;
    sourceIds = (sources ?? []).map((r: any) => r.id as string);
  }

  if (sourceIds.length === 0) {
    console.log("No matching sources found.");
    return;
  }

  console.log(`Running ${sourceIds.length} source(s)...`);

  for (const id of sourceIds) {
    console.log(`\n→ Source ${id}`);
    try {
      const result = await runSource(id);
      console.log(`  Status:     ${result.status}`);
      console.log(`  Found:      ${result.recordsFound}`);
      console.log(`  Upserted:   ${result.recordsUpserted}`);
      console.log(`  Dupes skip: ${result.duplicatesSkipped}`);
      if (result.errors.length > 0) {
        console.log(`  Errors (${result.errors.length}):`);
        result.errors.forEach((e) => console.log(`    - ${e}`));
      }
    } catch (err) {
      console.error(`  FATAL: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log("\nDone.");
}

async function runDryRun(source: string | undefined, all: boolean) {
  const adapters = source
    ? [getAdapter(source)].filter(Boolean)
    : getAllAdapters();

  if (adapters.length === 0) {
    console.error("No adapters to run.");
    process.exit(1);
  }

  for (const adapter of adapters) {
    if (!adapter) continue;
    console.log(`\n[DRY RUN] ${adapter.name} → ${adapter.sourceUrl}`);
    try {
      const result = await adapter.fetch();
      console.log(`  Activities found: ${result.activities.length}`);
      result.activities.slice(0, 3).forEach((a, i) => {
        console.log(`  [${i + 1}] ${a.name}`);
        console.log(`      org: ${a.organizationName}`);
        console.log(`      address: ${a.address}`);
        console.log(`      sessions: ${a.sessions.length}, prices: ${a.prices.length}`);
      });
      if (result.activities.length > 3) {
        console.log(`  ... and ${result.activities.length - 3} more`);
      }
      if (result.errors.length > 0) {
        console.log(`  Errors: ${result.errors.join("; ")}`);
      }
    } catch (err) {
      console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
