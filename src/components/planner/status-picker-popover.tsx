"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import type { PlannerEntryStatus } from "@/lib/supabase/types";

export interface StatusPickerAnchor {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  anchor: StatusPickerAnchor;
  campName: string;
  campColor: string;
  onChoose: (status: PlannerEntryStatus) => void;
  onCancel: () => void;
}

const OPTIONS: { status: PlannerEntryStatus; label: string }[] = [
  { status: "registered", label: "Registered" },
  { status: "waitlisted", label: "Waitlisted" },
  { status: "considering", label: "Considering" },
];

const WIDTH = 200;
// Static content: header row + 3 option buttons + padding. Stable across renders.
const HEIGHT = 150;
const GAP = 6;

export function StatusPickerPopover({ anchor, campName, campColor, onChoose, onCancel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useMemo(() => {
    const vh = typeof window === "undefined" ? 800 : window.innerHeight;
    const vw = typeof window === "undefined" ? 1200 : window.innerWidth;
    const below = anchor.top + anchor.height + HEIGHT + GAP <= vh;
    const top = below
      ? anchor.top + anchor.height + GAP
      : Math.max(8, anchor.top - HEIGHT - GAP);
    const rawLeft = anchor.left + anchor.width / 2 - WIDTH / 2;
    const left = Math.min(Math.max(8, rawLeft), vw - WIDTH - 8);
    return { top, left };
  }, [anchor]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    function handleDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    }
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleDown);
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleDown);
    };
  }, [onCancel]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`Choose status for ${campName}`}
      style={{ position: "fixed", top: pos.top, left: pos.left, width: WIDTH, zIndex: 60 }}
      className="bg-surface rounded-lg border border-ink shadow-[3px_3px_0_0_rgba(0,0,0,0.15)] p-2"
    >
      <div className="flex items-center gap-1.5 px-2 pt-1 pb-2 border-b border-ink-3 mb-1">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: campColor }} />
        <div className="font-medium text-sm text-ink truncate">{campName}</div>
      </div>
      <div className="flex flex-col gap-0.5">
        {OPTIONS.map((o) => (
          <button
            key={o.status}
            type="button"
            onClick={() => onChoose(o.status)}
            className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-hero-light/40 focus:bg-hero-light/40 focus:outline-none font-sans font-semibold text-[11px] uppercase tracking-widest text-ink"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}
