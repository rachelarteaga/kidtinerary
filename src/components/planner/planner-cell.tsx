"use client";

import { useDndMonitor, useDroppable } from "@dnd-kit/core";
import { useState } from "react";
import { CellTimelineGrid, type TimelineEntry } from "./cell-timeline-grid";
import { ConsideringChips, type ConsideringChip } from "./considering-chips";
import { CellDropZones } from "./cell-drop-zones";
import type { DayOfWeek } from "@/lib/supabase/types";
import type { ScheduleSlot } from "@/lib/schedule";

export interface CellLegendRow {
  entryId: string;
  activityName: string;
  color: string;
  description: string;
  isWaitlisted: boolean;
}

interface Props {
  childId: string;
  weekStart: string;
  weekStartDate: Date;
  plannerStart: Date;
  plannerEnd: Date;
  timelineEntries: TimelineEntry[];
  legendRows: CellLegendRow[];
  consideringChips: ConsideringChip[];
  onEntryClick: (entryId: string) => void;
  onAddClick: (childId: string, weekStart: string) => void;
}

export function PlannerCell({
  childId,
  weekStart,
  weekStartDate,
  plannerStart,
  plannerEnd,
  timelineEntries,
  legendRows,
  consideringChips,
  onEntryClick,
  onAddClick,
}: Props) {
  const [dragging, setDragging] = useState(false);

  useDndMonitor({
    onDragStart: (event) => {
      const data = event.active.data.current;
      if (data?.type === "camp") setDragging(true);
    },
    onDragEnd: () => setDragging(false),
    onDragCancel: () => setDragging(false),
  });

  const { isOver, setNodeRef } = useDroppable({
    id: `cell-hover-${childId}-${weekStart}`,
    data: { type: "cell-hover" },
  });

  const showZones = dragging && isOver;
  const hasContent = timelineEntries.length > 0 || consideringChips.length > 0;
  const dimmed = dragging && !showZones;

  function handleSquareClick(_day: DayOfWeek, _slot: ScheduleSlot) {
    if (timelineEntries.length > 0) {
      onEntryClick(timelineEntries[0].id);
    } else {
      onAddClick(childId, weekStart);
    }
  }

  let inner: React.ReactNode;
  if (showZones) {
    inner = (
      <div className="rounded-lg border border-driftwood/30 bg-cream p-2">
        <CellDropZones childId={childId} weekStart={weekStart} />
      </div>
    );
  } else if (!hasContent) {
    inner = (
      <button
        onClick={() => onAddClick(childId, weekStart)}
        className="w-full rounded-lg border border-dashed border-driftwood/50 bg-cream/50 p-3 text-xs text-stone hover:text-bark hover:border-bark font-mono uppercase tracking-widest"
      >
        + Add camp
      </button>
    );
  } else {
    inner = (
      <div className="rounded-lg border border-driftwood/30 bg-white p-2">
        <CellTimelineGrid
          entries={timelineEntries}
          weekStart={weekStartDate}
          plannerStart={plannerStart}
          plannerEnd={plannerEnd}
          onSquareClick={handleSquareClick}
        />
        {legendRows.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {legendRows.map((r) => (
              <button
                key={r.entryId}
                onClick={() => onEntryClick(r.entryId)}
                className="w-full flex items-center gap-1.5 text-left text-xs text-bark hover:underline"
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
                <span className="truncate">{r.activityName}</span>
                {r.isWaitlisted && (
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-wide text-campfire bg-campfire/10 px-1.5 py-0.5 rounded-full">
                    pending
                  </span>
                )}
                {!r.isWaitlisted && <span className="ml-auto font-mono text-[9px] text-stone">{r.description}</span>}
              </button>
            ))}
          </div>
        )}
        <ConsideringChips chips={consideringChips} onChipClick={onEntryClick} />
      </div>
    );
  }

  return (
    <div ref={setNodeRef} className={`transition-opacity ${dimmed ? "opacity-40" : "opacity-100"}`}>
      {inner}
    </div>
  );
}
