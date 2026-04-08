/**
 * CLI runner for local testing and manual scrape triggering.
 *
 * Usage:
 *   npx tsx src/scraper/run.ts --source raleigh-parks
 *   npx tsx src/scraper/run.ts --all
 *   npx tsx src/scraper/run.ts --adapter-type dedicated
 *   npx tsx src/scraper/run.ts --dry-run --source raleigh-parks
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
import { runSource } from "@/scraper/pipeline";
import { getAdapter, getAllAdapters } from "@/scraper/adapters/index";

function parseArgs(argv: string[]): {
  source?: string;
  all: boolean;
  adapterType?: string;
  dryRun: boolean;
} {
  const args = argv.slice(2);
  let source: string | undefined;
  let all = false;
  let adapterType: string | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) {
      source = args[++i];
    } else if (args[i] === "--all") {
      all = true;
    } else if (args[i] === "--adapter-type" && args[i + 1]) {
      adapterType = args[++i];
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  return { source, all, adapterType, dryRun };
}

async function main() {
  const { source, all, adapterType, dryRun } = parseArgs(process.argv);

  if (!source && !all && !adapterType) {
    console.error("Usage:");
    console.error("  npx tsx src/scraper/run.ts --source <adapter-name>");
    console.error("  npx tsx src/scraper/run.ts --all");
    console.error("  npx tsx src/scraper/run.ts --adapter-type dedicated|generic_llm");
    console.error("  Add --dry-run to see adapter output without writing to DB");
    process.exit(1);
  }

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
