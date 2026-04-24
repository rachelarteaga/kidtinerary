"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updatePlannerRangeWithCleanup } from "@/lib/actions";

interface EntryDateLike {
  startsAt: string;
  endsAt: string;
}
interface BlockDateLike {
  startDate: string;
  endDate: string;
}

interface Props {
  plannerId: string;
  startDate: string;
  endDate: string;
  entries: EntryDateLike[];
  blocks: BlockDateLike[];
  onChanged: () => void;
}

function formatRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}

export function PlannerRangePicker({
  plannerId,
  startDate,
  endDate,
  entries,
  blocks,
  onChanged,
}: Props) {
  const [open, setOpen] = useState(false);
  const [localStart, setLocalStart] = useState(startDate);
  const [localEnd, setLocalEnd] = useState(endDate);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setLocalStart(startDate);
    setLocalEnd(endDate);
  }, [startDate, endDate]);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function countOutOfRange() {
    let removedEntries = 0;
    for (const e of entries) {
      if (e.endsAt < localStart || e.startsAt > localEnd) removedEntries++;
    }
    let removedBlocks = 0;
    for (const b of blocks) {
      if (b.endDate < localStart || b.startDate > localEnd) removedBlocks++;
    }
    return { removedEntries, removedBlocks };
  }

  function commitSave() {
    startTransition(async () => {
      const result = await updatePlannerRangeWithCleanup(plannerId, localStart, localEnd);
      if (result.error) {
        alert(result.error);
        return;
      }
      onChanged();
      setOpen(false);
      setConfirming(false);
    });
  }

  function handleSaveClick() {
    const { removedEntries, removedBlocks } = countOutOfRange();
    if (removedEntries > 0 || removedBlocks > 0) {
      setConfirming(true);
    } else {
      commitSave();
    }
  }

  const { removedEntries, removedBlocks } = countOutOfRange();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-white border border-ink-3 text-ink hover:border-ink inline-flex items-center gap-1.5"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="#151515" aria-hidden>
          <rect x="1.5" y="3" width="13" height="12" rx="1.5" />
          <rect x="4" y="1" width="1.5" height="3" />
          <rect x="10.5" y="1" width="1.5" height="3" />
          <rect x="1.5" y="6" width="13" height="1" fill="#ffffff" />
        </svg>
        <span>{formatRange(startDate, endDate)}</span>
        <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white border border-ink-3 rounded-lg shadow-lg p-4 z-20 min-w-[280px]">
          {!confirming ? (
            <>
              <div className="space-y-2 mb-3">
                <div>
                  <label className="font-sans text-[10px] uppercase tracking-widest text-ink-2">Start</label>
                  <input
                    type="date"
                    value={localStart}
                    onChange={(e) => setLocalStart(e.target.value)}
                    className="w-full mt-1 rounded-md border border-ink-3 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="font-sans text-[10px] uppercase tracking-widest text-ink-2">End</label>
                  <input
                    type="date"
                    value={localEnd}
                    onChange={(e) => setLocalEnd(e.target.value)}
                    className="w-full mt-1 rounded-md border border-ink-3 px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setOpen(false)} className="font-sans text-[11px] uppercase tracking-widest px-3 py-1.5 text-ink-2">Cancel</button>
                <button
                  onClick={handleSaveClick}
                  disabled={isPending}
                  className="font-sans text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full bg-ink text-white disabled:opacity-50"
                >
                  {isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="font-medium text-sm text-ink mb-2">Remove items outside the new range?</div>
              <p className="text-xs text-ink-2 mb-3 leading-relaxed">
                {removedEntries > 0 && <span>{removedEntries} activity entr{removedEntries === 1 ? "y" : "ies"}</span>}
                {removedEntries > 0 && removedBlocks > 0 && <span> and </span>}
                {removedBlocks > 0 && <span>{removedBlocks} block{removedBlocks === 1 ? "" : "s"}</span>}
                {" "}fall outside the new range and will be deleted. This cannot be undone.
              </p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setConfirming(false)} className="font-sans text-[11px] uppercase tracking-widest px-3 py-1.5 text-ink-2">Back</button>
                <button
                  onClick={commitSave}
                  disabled={isPending}
                  className="font-sans text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full bg-[#ef8c8f] text-white disabled:opacity-50"
                >
                  {isPending ? "Saving…" : "Remove & save"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
