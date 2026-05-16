"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { unsaveSharedPlanner } from "@/lib/actions";
import type { SavedShareSummary } from "@/lib/queries";

function formatDateRange(startDate: string, endDate: string): string {
  const s = new Date(startDate + "T00:00:00");
  const e = new Date(endDate + "T00:00:00");
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
    });
  return `${fmt(s, false)} – ${fmt(e, true)}`;
}

interface Props {
  share: SavedShareSummary;
  /** Called after a successful unsave so the parent can drop this card from
   * its local list immediately, without waiting on router.refresh() to deliver
   * fresh server data. */
  onRemoved?: (shareId: string) => void;
}

export function SharedWithMeCard({ share, onRemoved }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  function handleRemove() {
    startTransition(async () => {
      const r = await unsaveSharedPlanner(share.shareId);
      if (r.error) {
        toast(r.error, "error");
        return;
      }
      onRemoved?.(share.shareId);
      toast("Removed from your planners.", "success");
      router.refresh();
    });
  }

  if (share.isTombstone) {
    return (
      <div className="rounded-lg border border-dashed border-ink-3 bg-surface p-4 opacity-75">
        <p className="font-display font-extrabold text-lg text-ink-2 line-through">
          {share.plannerNameAtSave}
        </p>
        <p className="font-sans text-xs text-ink-2 mt-1">
          This planner is no longer being shared.
        </p>
        <button
          type="button"
          onClick={handleRemove}
          className="mt-3 font-sans font-bold text-[11px] uppercase tracking-widest text-ink-2 hover:text-ink"
        >
          Remove from list
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-ink-3 bg-surface p-4">
      <Link
        href={`/schedule/${share.token}`}
        className="font-display font-extrabold text-lg text-ink hover:underline"
      >
        {share.plannerName}
      </Link>
      <p className="font-sans text-sm text-ink-2 mt-1">
        Shared by{" "}
        <span className="text-ink font-semibold">
          {share.ownerDisplayName ?? "a friend"}
        </span>
      </p>
      {share.plannerStart && share.plannerEnd && (
        <p className="font-sans text-xs text-ink-2 mt-0.5">
          {formatDateRange(share.plannerStart, share.plannerEnd)}
        </p>
      )}
      <div className="mt-3 pt-3 border-t border-ink-3 flex items-center justify-between gap-2">
        <span className="font-sans text-[11px] uppercase tracking-widest text-ink-2">
          Read-only
        </span>
        <button
          type="button"
          onClick={handleRemove}
          className="font-sans font-bold text-[11px] uppercase tracking-widest text-ink-2 hover:text-ink"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
