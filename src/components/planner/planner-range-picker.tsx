"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updatePlannerRange } from "@/lib/actions";

interface Props {
  plannerId: string;
  startDate: string;
  endDate: string;
  onChanged: () => void;
}

function formatRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const sStr = s.toLocaleDateString(undefined, opts);
  const eStr = e.toLocaleDateString(undefined, opts);
  return `${sStr} – ${eStr}`;
}

export function PlannerRangePicker({ plannerId, startDate, endDate, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [localStart, setLocalStart] = useState(startDate);
  const [localEnd, setLocalEnd] = useState(endDate);
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

  function save() {
    startTransition(async () => {
      const result = await updatePlannerRange(plannerId, localStart, localEnd);
      if (result.error) {
        alert(result.error);
        return;
      }
      onChanged();
      setOpen(false);
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="font-mono text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-white border border-driftwood/40 text-bark hover:border-bark"
      >
        📅 {formatRange(startDate, endDate)} ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white border border-driftwood/30 rounded-lg shadow-lg p-4 z-20 min-w-[280px]">
          <div className="space-y-2 mb-3">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-stone">Start</label>
              <input
                type="date"
                value={localStart}
                onChange={(e) => setLocalStart(e.target.value)}
                className="w-full mt-1 rounded-md border border-driftwood/40 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-stone">End</label>
              <input
                type="date"
                value={localEnd}
                onChange={(e) => setLocalEnd(e.target.value)}
                className="w-full mt-1 rounded-md border border-driftwood/40 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setOpen(false)} className="font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 text-stone">Cancel</button>
            <button onClick={save} disabled={isPending} className="font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full bg-bark text-cream disabled:opacity-50">
              {isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
