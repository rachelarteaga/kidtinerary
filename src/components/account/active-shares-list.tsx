"use client";

import { useState, useTransition } from "react";
import { revokeShare } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";

export interface PlannerShareRow {
  id: string;
  token: string;
  plannerName: string;
  kidCount: number;
  includeCost: boolean;
  includePersonalBlockDetails: boolean;
  createdAt: string;
}

interface Props {
  shares: PlannerShareRow[];
}

export function ActiveSharesList({ shares: initial }: Props) {
  const [shares, setShares] = useState<PlannerShareRow[]>(initial);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleCopy(token: string) {
    const url = `${window.location.origin}/schedule/${token}`;
    navigator.clipboard.writeText(url).then(
      () => toast("Link copied to clipboard.", "success"),
      () => toast("Could not copy link.", "error")
    );
  }

  function handleRevoke(share: PlannerShareRow) {
    if (!confirm(`Stop sharing "${share.plannerName}"? Anyone with this link will lose access.`)) return;
    startTransition(async () => {
      const result = await revokeShare(share.id);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      setShares((prev) => prev.filter((s) => s.id !== share.id));
      toast("Share revoked.", "success");
    });
  }

  if (shares.length === 0) {
    return (
      <div className="rounded-lg border border-ink-3 bg-surface p-6">
        <p className="font-sans text-sm text-ink-2">
          You haven&apos;t shared any planners yet. Open a planner and tap{" "}
          <strong className="text-ink">Share</strong> to generate a live link.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="font-sans text-[10px] uppercase tracking-widest text-ink-2 font-semibold">
        Shared planners
      </p>
      {shares.map((s) => (
        <div key={s.id} className="rounded-lg border border-ink-3 bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-extrabold text-lg truncate">{s.plannerName}</h3>
              <p className="font-sans text-xs text-ink-2 mt-0.5">
                {s.kidCount} kid{s.kidCount === 1 ? "" : "s"} · Shared on{" "}
                {new Date(s.createdAt).toLocaleDateString()}
              </p>
              <p className="font-sans text-[11px] text-ink-2 mt-1">
                Includes: {s.includeCost ? "cost" : "no cost"} ·{" "}
                {s.includePersonalBlockDetails ? "block details" : "hidden blocks"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-ink-3">
            <button
              type="button"
              onClick={() => handleCopy(s.token)}
              className="font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full border border-ink hover:bg-base"
            >
              Copy link
            </button>
            <button
              type="button"
              onClick={() => handleRevoke(s)}
              disabled={isPending}
              className="font-sans font-bold text-[11px] uppercase tracking-widest text-[#ef8c8f] hover:text-[#e87073] disabled:opacity-50"
            >
              Stop sharing
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
