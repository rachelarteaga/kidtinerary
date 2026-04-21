"use client";

import { useTransition } from "react";
import Link from "next/link";
import { StateBadge } from "./state-badge";
import { SharedBadge } from "./shared-badge";
import { KidShape } from "@/components/ui/kid-shape";
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
  /** Sort-order index of the owning kid — drives the shape marker. */
  ownerIndex: number;
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
  ownerIndex,
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

  return (
    <div className={`rounded-xl border border-ink p-3 bg-surface transition-opacity ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/activity/${activitySlug}`}
          className="flex-1 font-sans font-bold text-sm text-ink hover:underline truncate flex items-center gap-1.5"
        >
          <KidShape index={ownerIndex} size={10} dotOnly stroke={false} />
          <span className="truncate">{activityName}</span>
        </Link>
        <button
          onClick={handleRemove}
          aria-label="Remove"
          className="text-ink-3 hover:text-[#ef8c8f] text-xs"
        >
          ✕
        </button>
      </div>

      {isLoading ? (
        <div className="mt-2 space-y-1.5">
          <div className="h-2 bg-disabled rounded w-2/3 animate-pulse"></div>
          <div className="h-2 bg-disabled rounded w-1/2 animate-pulse"></div>
        </div>
      ) : (
        <div className="mt-1.5 font-sans text-[11px] uppercase tracking-wide text-ink-2 font-semibold">
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
