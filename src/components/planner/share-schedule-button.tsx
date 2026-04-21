"use client";

import { useState } from "react";
import { createSharedSchedule } from "@/lib/actions";

interface ShareScheduleButtonProps {
  childId: string;
  dateFrom: string;
  dateTo: string;
}

export function ShareScheduleButton({
  childId,
  dateFrom,
  dateTo,
}: ShareScheduleButtonProps) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleShare() {
    setLoading(true);
    setError(null);

    const result = await createSharedSchedule(childId, dateFrom, dateTo);

    if ("error" in result && result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    const token = (result as { success: true; token: string }).token;
    const shareUrl = `${window.location.origin}/schedule/${token}`;

    setLoading(false);

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "My Summer Schedule", url: shareUrl });
        return;
      } catch {
        // Fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy link");
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleShare}
        disabled={loading}
        className="shrink-0 flex items-center gap-1.5 font-sans text-[11px] uppercase tracking-widest text-ink hover:text-ink/80 border border-ink/40 hover:border-ink/70 rounded-full px-4 py-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        {loading ? "Generating..." : copied ? "Copied!" : "Share Schedule"}
      </button>
      {error && (
        <span className="font-sans text-[10px] text-ink">{error}</span>
      )}
    </div>
  );
}
