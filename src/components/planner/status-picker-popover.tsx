"use client";

import { useEffect, useRef } from "react";
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
  activityName: string;
  onChoose: (status: PlannerEntryStatus) => void;
  onCancel: () => void;
}

const OPTIONS: { status: PlannerEntryStatus; label: string; bg: string }[] = [
  { status: "registered", label: "Registered", bg: "var(--color-status-registered)" },
  { status: "waitlisted", label: "Waitlisted", bg: "var(--color-status-waitlisted)" },
  { status: "considering", label: "Considering", bg: "var(--color-status-considering)" },
];

export function StatusPickerPopover({ anchor, activityName, onChoose, onCancel }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    function handleDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    }
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleDown);
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
      aria-label={`Choose status for ${activityName}`}
      style={{
        position: "fixed",
        top: anchor.top + anchor.height / 2,
        left: anchor.left,
        width: anchor.width,
        minHeight: anchor.height,
        transform: "translateY(-50%)",
        containerType: "inline-size",
        zIndex: 60,
      }}
      className="bg-white/75 backdrop-blur-[1px] border border-ink rounded-lg flex flex-col items-center justify-center gap-1.5 px-2 py-3"
    >
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel status selection"
        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full text-ink-2 hover:text-ink hover:bg-ink/5 focus:outline-none cursor-pointer"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M1 1 L9 9 M9 1 L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <style>{`
        @container (max-width: 260px) {
          .status-picker-row { flex-direction: column; gap: 6px; width: 100%; }
          .status-picker-row > button { width: 100%; }
        }
      `}</style>
      <div className="flex flex-col items-center gap-0.5 max-w-full px-2">
        <div className="font-sans text-[9px] uppercase tracking-widest text-ink-2">
          Select status
        </div>
        <div className="font-display font-extrabold text-sm text-ink truncate max-w-full text-center leading-tight">
          {activityName}
        </div>
      </div>
      <div className="status-picker-row flex flex-row items-center justify-center gap-1.5">
        {OPTIONS.map((o) => (
          <button
            key={o.status}
            type="button"
            onClick={() => onChoose(o.status)}
            className="font-sans font-semibold text-[10px] uppercase tracking-widest px-2.5 py-1.5 rounded-full border border-ink text-ink whitespace-nowrap hover:brightness-95 focus:outline-none transition-[filter]"
            style={{ background: o.bg }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}
