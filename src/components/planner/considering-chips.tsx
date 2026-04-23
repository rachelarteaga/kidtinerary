"use client";

export interface ConsideringChip {
  entryId: string;
  activityName: string;
  color: string;
  isOvernight: boolean;
}

interface Props {
  chips: ConsideringChip[];
  onChipClick: (entryId: string) => void;
}

export function ConsideringChips({ chips, onChipClick }: Props) {
  if (chips.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-dashed border-ink-3">
      <div className="font-sans text-[9px] font-bold uppercase tracking-widest text-ink-2 mb-1">
        Considering ({chips.length})
      </div>
      <div className="flex gap-1 flex-wrap">
        {chips.map((c) => (
          <button
            key={c.entryId}
            onClick={() => onChipClick(c.entryId)}
            className="flex items-center gap-1 rounded-full border border-dashed border-ink-3 bg-surface px-2 py-0.5 text-[11px] text-ink hover:border-ink cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
            {c.activityName}
            {c.isOvernight ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#151515" aria-label="Overnight">
                <path d="M14 2 A 10 10 0 1 0 22 13 A 8 8 0 0 1 14 2 Z" />
              </svg>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
