"use client";

import { useState } from "react";
import type { ExtraItem } from "@/lib/supabase/types";

interface Props {
  extras: ExtraItem[];
  onChange: (next: ExtraItem[]) => void;
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(0);
}

function parseCents(value: string): number {
  const n = Math.round(parseFloat(value) * 100);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function ExtrasEditor({ extras, onChange }: Props) {
  const [expanded, setExpanded] = useState(extras.length > 0);

  const totalCents = extras.reduce((sum, e) => sum + e.cost_cents, 0);
  const summary = extras.length === 0
    ? "No extras"
    : `${extras.length} added · $${(totalCents / 100).toFixed(0)}`;

  function updateItem(idx: number, patch: Partial<ExtraItem>) {
    const next = [...extras];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }

  function addItem() {
    onChange([...extras, { label: "", cost_cents: 0, unit: "per_week" }]);
    setExpanded(true);
  }

  function removeItem(idx: number) {
    onChange(extras.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between rounded-lg border border-ink-3 bg-surface px-3 py-2 text-sm text-ink hover:border-ink"
      >
        <span>+ Extras <span className="text-ink-2">({summary})</span></span>
        <span className="text-ink-2">{expanded ? "▴" : "▾"}</span>
      </button>

      {expanded && (
        <div className="space-y-2 rounded-lg border border-ink-3 bg-surface/50 p-3">
          {extras.map((e, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <input
                type="text"
                value={e.label}
                onChange={(ev) => updateItem(idx, { label: ev.target.value })}
                placeholder="Label"
                className="flex-1 rounded-md border border-ink-3 bg-surface px-2 py-1 text-sm"
              />
              <span className="text-sm text-ink">$</span>
              <input
                type="number"
                value={formatCents(e.cost_cents)}
                onChange={(ev) => updateItem(idx, { cost_cents: parseCents(ev.target.value) })}
                className="w-16 rounded-md border border-ink-3 bg-surface px-2 py-1 text-sm text-right"
                min="0"
              />
              <select
                value={e.unit}
                onChange={(ev) => updateItem(idx, { unit: ev.target.value as "per_week" | "per_day" })}
                className="rounded-md border border-ink-3 bg-surface px-2 py-1 text-xs"
              >
                <option value="per_week">/wk</option>
                <option value="per_day">/day</option>
              </select>
              <button
                onClick={() => removeItem(idx)}
                aria-label="Remove extra"
                className="text-ink-3 hover:text-[#ef8c8f] text-sm px-1"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={addItem}
            className="font-sans text-[11px] uppercase tracking-widest text-ink hover:text-ink/70"
          >
            + Add another
          </button>
        </div>
      )}
    </div>
  );
}
