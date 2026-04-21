import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runScrapeJob } from "@/scraper/on-demand";

// Scrape typically takes 10–30s (HTTP fetch + Claude Haiku call). Give the
// lambda enough headroom so `after()` can complete the background work.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { jobId } = await request.json();
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const { data: job } = await supabase.from("scrape_jobs").select("id").eq("id", jobId).eq("user_id", user.id).maybeSingle();
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Next.js `after()` keeps the serverless lambda alive until this promise
  // resolves, without blocking the response. A bare `runScrapeJob(...).catch()`
  // gets killed on Vercel the moment the response is sent.
  after(async () => {
    try {
      await runScrapeJob({ jobId });
    } catch (err) {
      console.error("runScrapeJob background error:", err);
    }
  });

  return NextResponse.json({ ok: true });
}
