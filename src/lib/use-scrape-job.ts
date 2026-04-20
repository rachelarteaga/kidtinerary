"use client";

import { useEffect, useState } from "react";
import type { ScrapeJobRow } from "@/lib/supabase/types";

interface UseScrapeJobResult {
  job: ScrapeJobRow | null;
  done: boolean;
}

/** Poll /api/scrape-jobs/[id] every 2s until resolved/failed, max 90s. */
export function useScrapeJob(jobId: string | null): UseScrapeJobResult {
  const [job, setJob] = useState<ScrapeJobRow | null>(null);

  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    const startedAt = Date.now();
    const MAX_MS = 90_000;
    const INTERVAL_MS = 2_000;

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/scrape-jobs/${jobId}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setJob(data.job);
          if (data.job?.status === "resolved" || data.job?.status === "failed") return;
        }
      } catch (err) {
        console.error("useScrapeJob poll error:", err);
      }
      if (Date.now() - startedAt > MAX_MS) return;
      setTimeout(poll, INTERVAL_MS);
    }

    void poll();
    return () => { cancelled = true; };
  }, [jobId]);

  const done = job?.status === "resolved" || job?.status === "failed";
  return { job, done };
}
