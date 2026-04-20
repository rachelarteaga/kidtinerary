"use client";

export interface ConsideringChip {
  entryId: string;
  activityName: string;
  color: string;
}

interface Props {
  chips: ConsideringChip[];
  onChipClick: (entryId: string) => void;
}

export function ConsideringChips({ chips, onChipClick }: Props) {
  if (chips.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-dashed border-driftwood/40">
      <div className="font-mono text-[8px] uppercase tracking-widest text-driftwood mb-1">
        Considering ({chips.length})
      </div>
      <div className="flex gap-1 flex-wrap">
        {chips.map((c) => (
          <button
            key={c.entryId}
            onClick={() => onChipClick(c.entryId)}
            className="flex items-center gap-1 rounded-full border border-dashed border-driftwood/50 bg-white px-2 py-0.5 text-[11px] text-bark hover:border-bark"
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
            {c.activityName}
          </button>
        ))}
      </div>
    </div>
  );
}
