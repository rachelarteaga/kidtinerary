"use client";

import { useEffect, useRef, useState } from "react";
import type { PlannerEntryStatus } from "@/lib/supabase/types";

interface Props {
  status: PlannerEntryStatus;
  onChange: (next: PlannerEntryStatus) => void;
  size?: "sm" | "md";
}

const OPTIONS: { value: PlannerEntryStatus; label: string; color: string }[] = [
  { value: "considering", label: "Considering", color: "#c8a76a" },
  { value: "waitlisted", label: "Waitlisted", color: "#e5c89a" },
  { value: "registered", label: "Registered", color: "#7fa06a" },
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
        className={`${pad} inline-flex items-center gap-1.5 rounded-full border border-driftwood/40 bg-white hover:border-bark transition-colors`}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: current.color }} />
        <span className="font-medium text-bark">{current.label}</span>
        <span className="text-stone">▾</span>
      </button>

      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-driftwood/30 rounded-lg shadow-lg p-1 min-w-[160px]">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm hover:bg-driftwood/10 ${
                opt.value === status ? "bg-driftwood/5" : ""
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: opt.color }} />
              <span className="text-bark">{opt.label}</span>
              {opt.value === status && <span className="ml-auto text-meadow text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
