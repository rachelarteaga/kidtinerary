import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runSource, type PipelineResult } from "@/scraper/pipeline";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role env vars not set");
  return createClient(url, key) as any;
}

export async function GET(req: NextRequest) {
  // Validate Authorization header
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch active sources that are due for scraping
  let supabase: ReturnType<typeof getServiceClient>;
  try {
    supabase = getServiceClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  // A source is "due" if it has never been scraped or was last scraped > 23 hours ago
  const cutoff = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();

  const { data: sources, error: sourcesError } = await supabase
    .from("scrape_sources")
    .select("id, url, adapter_type")
    .eq("is_paused", false)
    .or(`last_scraped_at.is.null,last_scraped_at.lt.${cutoff}`);

  if (sourcesError) {
    return NextResponse.json({ error: `Failed to fetch sources: ${sourcesError.message}` }, { status: 500 });
  }

  const sourceRows = sources ?? [];

  if (sourceRows.length === 0) {
    return NextResponse.json({ message: "No sources due for scraping", ran: 0, results: [] });
  }

  // Run pipeline for each source
  const results: Array<PipelineResult & { url: string }> = [];

  for (const row of sourceRows) {
    const result = await runSource(row.id as string);
    results.push({ ...result, url: row.url as string });
  }

  const succeeded = results.filter((r) => r.status === "success" || r.status === "partial").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const totalUpserted = results.reduce((sum, r) => sum + r.recordsUpserted, 0);
  const totalFound = results.reduce((sum, r) => sum + r.recordsFound, 0);

  return NextResponse.json({
    ran: results.length,
    succeeded,
    failed,
    totalFound,
    totalUpserted,
    results: results.map((r) => ({
      sourceId: r.sourceId,
      url: r.url,
      status: r.status,
      recordsFound: r.recordsFound,
      recordsUpserted: r.recordsUpserted,
      duplicatesSkipped: r.duplicatesSkipped,
      errors: r.errors,
    })),
  });
}
