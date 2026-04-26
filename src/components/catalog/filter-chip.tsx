"use client";

import { useRef, useState } from "react";
import { AnchoredPopover } from "@/components/ui/anchored-popover";

interface Props {
  /** Label shown on the chip in its current state. e.g. "All kids" or "Maya, Theo" */
  label: string;
  /** Whether the filter has a non-default value (controls active styling). */
  active: boolean;
  /** Popover content — usually a checkbox / radio list. */
  children: React.ReactNode;
}

export function FilterChip({ label, active, children }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`font-sans text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-full border transition-colors inline-flex items-center gap-1
          ${active ? "bg-ink text-ink-inverse border-ink" : "bg-surface text-ink border-ink-3 hover:border-ink"}`}
      >
        {label} <span aria-hidden>▾</span>
      </button>
      <AnchoredPopover
        anchorRef={ref}
        open={open}
        onClose={() => setOpen(false)}
        align="start"
        className="bg-surface border border-ink rounded-xl shadow-[3px_3px_0_0_rgba(0,0,0,0.12)] p-3 min-w-[220px]"
      >
        {children}
      </AnchoredPopover>
    </>
  );
}
