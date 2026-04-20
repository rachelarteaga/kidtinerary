"use client";

import { useTransition } from "react";
import Link from "next/link";
import { StateBadge } from "./state-badge";
import { SharedBadge } from "./shared-badge";
import { updatePlannerEntryStatus, removePlannerEntry } from "@/lib/actions";
import type { PlannerEntryStatus } from "@/lib/supabase/types";

interface CampCardProps {
  entryId: string;
  activityName: string;
  activitySlug: string;
  status: PlannerEntryStatus;
  timeLabel?: string | null;
  priceLabel?: string | null;
  sharedWith: string[];
  isLoading: boolean;
  onChanged: () => void;
}

const NEXT_STATUS: Record<PlannerEntryStatus, PlannerEntryStatus> = {
  considering: "waitlisted",
  waitlisted: "registered",
  registered: "considering",
};

export function CampCard({
  entryId,
  activityName,
  activitySlug,
  status,
  timeLabel,
  priceLabel,
  sharedWith,
  isLoading,
  onChanged,
}: CampCardProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await updatePlannerEntryStatus(entryId, NEXT_STATUS[status]);
      onChanged();
    });
  }

  function handleRemove() {
    startTransition(async () => {
      await removePlannerEntry(entryId);
      onChanged();
    });
  }

  const bg =
    status === "registered" ? "bg-meadow/5 border-meadow/30"
    : sharedWith.length > 0 ? "bg-meadow/5 border-meadow/20"
    : "bg-white border-driftwood/30";

  return (
    <div className={`rounded-lg border p-3 transition-opacity ${bg} ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/activity/${activitySlug}`}
          className="flex-1 font-medium text-sm text-bark hover:text-sunset transition-colors truncate"
        >
          {activityName}
        </Link>
        <button
          onClick={handleRemove}
          aria-label="Remove"
          className="text-driftwood hover:text-red-500 text-xs"
        >
          ✕
        </button>
      </div>

      {isLoading ? (
        <div className="mt-2 space-y-1.5">
          <div className="h-2 bg-driftwood/20 rounded w-2/3 animate-pulse"></div>
          <div className="h-2 bg-driftwood/20 rounded w-1/2 animate-pulse"></div>
        </div>
      ) : (
        <div className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-stone">
          {[timeLabel, priceLabel].filter(Boolean).join(" · ") || "Details loading…"}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <StateBadge status={status} onClick={handleToggle} />
      </div>

      <SharedBadge sharedWith={sharedWith} />
    </div>
  );
}
