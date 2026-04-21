"use client";

import { useEffect, useRef, useState } from "react";
import type { PlannerEntryStatus } from "@/lib/supabase/types";

interface Props {
  status: PlannerEntryStatus;
  onChange: (next: PlannerEntryStatus) => void;
  size?: "sm" | "md";
}

const OPTIONS: { value: PlannerEntryStatus; label: string; color: string }[] = [
  { value: "considering", label: "Considering", color: "#e8edf1" },
  { value: "waitlisted", label: "Waitlisted", color: "#ffd4b8" },
  { value: "registered", label: "Registered", color: "#fbbf0e" },
];

export function StatusDropdown({ status, onChange, size = "md" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((o) => o.value === status) ?? OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const pad = size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs";

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`${pad} inline-flex items-center gap-1.5 rounded-full border border-ink-3 bg-surface hover:border-ink transition-colors`}
      >
        <span className="w-2 h-2 rounded-full border border-ink" style={{ background: current.color }} />
        <span className="font-sans font-semibold text-ink">{current.label}</span>
        <span className="text-ink-2">▾</span>
      </button>

      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-ink rounded-xl shadow-[3px_3px_0_0_rgba(0,0,0,0.15)] p-1 min-w-[160px]">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm hover:bg-base ${
                opt.value === status ? "bg-base/50" : ""
              }`}
            >
              <span className="w-2 h-2 rounded-full border border-ink" style={{ background: opt.color }} />
              <span className="text-ink">{opt.label}</span>
              {opt.value === status && <span className="ml-auto text-[#5fc39c] text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
