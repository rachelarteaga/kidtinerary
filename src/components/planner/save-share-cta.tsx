"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveSharedPlanner,
  unsaveSharedPlanner,
  fetchOwnNameStatus,
} from "@/lib/actions";
import { useToast } from "@/components/ui/toast";
import { NameRequiredPrompt } from "@/components/auth/name-required-prompt";

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
  const [pendingNamePrompt, setPendingNamePrompt] = useState<
    null | { resume: () => void; first: string; last: string }
  >(null);

  async function actuallySave() {
    setIsSaved(true);
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
  }

  function handleSave() {
    startTransition(async () => {
      const status = await fetchOwnNameStatus();
      if (status.missing) {
        setPendingNamePrompt({
          resume: () => {
            setPendingNamePrompt(null);
            startTransition(actuallySave);
          },
          first: status.firstName,
          last: status.lastName,
        });
        return;
      }
      await actuallySave();
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

  return (
    <>
      {isSaved ? (
        <button
          type="button"
          onClick={handleUnsave}
          className="font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full border border-ink text-ink bg-base hover:bg-surface"
        >
          Saved · remove
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-[#dfecf5] text-ink border border-ink hover:brightness-95"
        >
          <span aria-hidden="true">+</span>
          Save to my planners
        </button>
      )}
      {pendingNamePrompt && (
        <NameRequiredPrompt
          defaultFirst={pendingNamePrompt.first}
          defaultLast={pendingNamePrompt.last}
          reason="Add your name so the planner owner knows who saved their share."
          onComplete={pendingNamePrompt.resume}
          onCancel={() => setPendingNamePrompt(null)}
        />
      )}
    </>
  );
}
