"use client";

import type { UserCampWithActivity } from "@/lib/queries";

interface Props {
  camps: UserCampWithActivity[];
  onChipClick: (camp: UserCampWithActivity) => void;
  onAddClick: () => void;
}

export function MyCampsRow({ camps, onChipClick, onAddClick }: Props) {
  return (
    <section className="mb-6">
      <h2 className="font-mono text-[10px] uppercase tracking-widest text-stone mb-2">My camps</h2>
      <div className="flex gap-2 flex-wrap">
        {camps.map((c) => (
          <button
            key={c.id}
            onClick={() => onChipClick(c)}
            className={`rounded-full px-3 py-1.5 text-sm border flex items-center gap-2 transition-colors ${c.activity.verified ? "bg-white border-meadow/30" : "bg-white border-driftwood/40"} hover:border-bark`}
          >
            <span className="font-medium text-bark">{c.activity.name}</span>
            {c.plannerEntryCount > 0 && (
              <span className="font-mono text-[10px] uppercase tracking-wide text-stone">{c.plannerEntryCount}</span>
            )}
            {c.activity.verified && (
              <span className="font-mono text-[9px] uppercase tracking-wide text-meadow">verified</span>
            )}
          </button>
        ))}
        <button
          onClick={onAddClick}
          className="rounded-full px-3 py-1.5 text-sm border border-dashed border-driftwood/60 text-stone hover:border-bark hover:text-bark transition-colors"
        >
          + Add
        </button>
      </div>
    </section>
  );
}
