"use client";

import { useDroppable } from "@dnd-kit/core";
import type { PlannerEntryStatus } from "@/lib/supabase/types";
import { CampCard } from "./camp-card";

export interface CellEntry {
  kind: "camp";
  entryId: string;
  activityName: string;
  activitySlug: string;
  status: PlannerEntryStatus;
  timeLabel?: string | null;
  priceLabel?: string | null;
  sharedWith: string[];
  isLoading: boolean;
}

interface Props {
  childId: string;
  weekStart: string; // YYYY-MM-DD
  entries: CellEntry[];
  onAddClick: (childId: string, weekStart: string) => void;
  onChanged: () => void;
}

export function PlannerCell({ childId, weekStart, entries, onAddClick, onChanged }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${childId}-${weekStart}`,
    data: { type: "cell", childId, weekStart },
  });

  const overCls = isOver ? "border-sunset bg-sunset/5" : "";

  if (entries.length === 0) {
    return (
      <button
        ref={setNodeRef}
        onClick={() => onAddClick(childId, weekStart)}
        className={`w-full h-full min-h-[60px] border border-dashed border-driftwood/60 rounded-lg text-stone/70 hover:border-driftwood hover:text-stone hover:bg-driftwood/5 transition-colors font-mono text-[11px] uppercase tracking-wide ${overCls}`}
      >
        + Add camp
      </button>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`space-y-2 rounded-lg border border-transparent transition-colors ${overCls}`}
    >
      {entries.map((e) => (
        <CampCard
          key={e.entryId}
          entryId={e.entryId}
          activityName={e.activityName}
          activitySlug={e.activitySlug}
          status={e.status}
          timeLabel={e.timeLabel}
          priceLabel={e.priceLabel}
          sharedWith={e.sharedWith}
          isLoading={e.isLoading}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}
