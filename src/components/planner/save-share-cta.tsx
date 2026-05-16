"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveSharedPlanner,
  unsaveSharedPlanner,
} from "@/lib/actions";
import { useToast } from "@/components/ui/toast";

interface Props {
  shareId: string;
  plannerName: string;
  initialIsSaved: boolean;
}

export function SaveShareCTA({ shareId, plannerName, initialIsSaved }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  // Keep local state in sync with refreshed props after router.refresh()
  // (e.g., DrainPendingSaves auto-saves the current share post-signup).
  useEffect(() => {
    setIsSaved(initialIsSaved);
  }, [initialIsSaved]);
  const [, startTransition] = useTransition();

  function handleSave() {
    setIsSaved(true);
    startTransition(async () => {
      const r = await saveSharedPlanner({
        shareId,
        plannerNameAtSave: plannerName,
      });
      if (r.error) {
        setIsSaved(false);
        toast(r.error, "error");
        return;
      }
      toast("Saved to your planners.", "success");
      router.refresh();
    });
  }

  function handleUnsave() {
    setIsSaved(false);
    startTransition(async () => {
      const r = await unsaveSharedPlanner(shareId);
      if (r.error) {
        setIsSaved(true);
        toast(r.error, "error");
        return;
      }
      toast("Removed from your planners.", "success");
      router.refresh();
    });
  }

  if (isSaved) {
    return (
      <button
        type="button"
        onClick={handleUnsave}
        className="font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full border border-ink text-ink bg-base hover:bg-surface"
      >
        Saved · remove
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSave}
      className="inline-flex items-center gap-1.5 font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-hero text-ink border border-ink hover:brightness-95"
    >
      <span aria-hidden="true">+</span>
      Save to my planners
    </button>
  );
}
