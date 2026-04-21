"use client";

import { CellTimelineGrid, type TimelineEntry } from "./cell-timeline-grid";
import { ConsideringChips, type ConsideringChip } from "./considering-chips";
import { CellDropZones } from "./cell-drop-zones";
import type { DayOfWeek, PlannerEntryStatus } from "@/lib/supabase/types";
import type { ScheduleSlot } from "@/lib/schedule";

export interface CellLegendRow {
  entryId: string;
  activityName: string;
  color: string;
  status: PlannerEntryStatus;
  isOvernight: boolean;
  /** Weekly total in cents (base + extras). Null if no price set. Only shown when status === "registered". */
  priceWeeklyCents: number | null;
}

const STATUS_STYLE: Record<PlannerEntryStatus, { bg: string; text: string }> = {
  considering: { bg: "bg-status-considering", text: "text-ink" },
  waitlisted:  { bg: "bg-status-waitlisted",  text: "text-ink" },
  registered:  { bg: "bg-status-registered",  text: "text-ink" },
};

interface Props {
  childId: string;
  weekStart: string;
  weekStartDate: Date;
  plannerStart: Date;
  plannerEnd: Date;
  viewMode: "detail" | "simple";
  isDraggingCamp: boolean;
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
  viewMode,
  isDraggingCamp,
  timelineEntries,
  legendRows,
  consideringChips,
  onEntryClick,
  onAddClick,
}: Props) {
  const hasContent = timelineEntries.length > 0 || consideringChips.length > 0;

  function handleSquareClick(_day: DayOfWeek, _slot: ScheduleSlot) {
    if (timelineEntries.length > 0) {
      onEntryClick(timelineEntries[0].id);
    } else {
      onAddClick(childId, weekStart);
    }
  }

  let content: React.ReactNode;
  if (viewMode === "simple") {
    if (!hasContent) {
      content = (
        <button
          onClick={() => onAddClick(childId, weekStart)}
          className="w-full h-full rounded-lg border border-dashed border-ink-3 bg-transparent py-1.5 text-[11px] text-ink-2 hover:text-ink hover:border-ink font-sans uppercase tracking-wide font-bold"
        >
          + Add
        </button>
      );
    } else if (timelineEntries.length === 0) {
      content = (
        <div className="rounded-lg border border-ink-3 bg-white px-2 py-1.5 h-full flex items-center">
          <div className="font-sans text-[11px] uppercase tracking-wide text-ink-3 font-semibold italic truncate">
            {consideringChips.length} considering
          </div>
        </div>
      );
    } else {
      const first = legendRows[0];
      const extraCount = legendRows.length - 1;
      const s = STATUS_STYLE[first.status];
      content = (
        <button
          onClick={() => onEntryClick(first.entryId)}
          className="w-full h-full rounded-lg border border-ink-3 bg-surface px-2 py-1.5 flex items-center gap-1.5 text-xs text-ink hover:underline text-left"
        >
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: first.color }} />
          <span className="truncate flex-1 inline-flex items-center gap-1">
            <span className="truncate">{first.activityName}</span>
            {first.isOvernight ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#151515" className="flex-shrink-0" aria-label="Overnight">
                <path d="M14 2 A 10 10 0 1 0 22 13 A 8 8 0 0 1 14 2 Z" />
              </svg>
            ) : null}
            {extraCount > 0 && <span className="text-ink-2 font-sans text-[10px] font-semibold ml-1">+{extraCount}</span>}
          </span>
          <span className={`font-sans font-semibold text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full border border-ink flex-shrink-0 ${s.bg} ${s.text}`}>
            {first.status}
          </span>
        </button>
      );
    }
  } else if (!hasContent) {
    content = (
      <button
        onClick={() => onAddClick(childId, weekStart)}
        className="w-full h-full rounded-lg border border-dashed border-ink-3 bg-surface p-3 text-xs text-ink-2 hover:text-ink hover:border-ink font-sans font-bold uppercase tracking-widest"
      >
        + Add
      </button>
    );
  } else {
    content = (
      <div className="rounded-lg border border-ink-3 bg-surface p-2 h-full">
        <CellTimelineGrid
          entries={timelineEntries}
          weekStart={weekStartDate}
          plannerStart={plannerStart}
          plannerEnd={plannerEnd}
          onSquareClick={handleSquareClick}
        />
        {legendRows.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {legendRows.map((r) => {
              const s = STATUS_STYLE[r.status];
              return (
                <button
                  key={r.entryId}
                  onClick={() => onEntryClick(r.entryId)}
                  className="w-full flex items-center gap-1.5 text-left text-xs text-ink hover:underline"
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
                  <span className="truncate">{r.activityName}</span>
                  {r.isOvernight ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="#151515" className="flex-shrink-0" aria-label="Overnight">
                      <path d="M14 2 A 10 10 0 1 0 22 13 A 8 8 0 0 1 14 2 Z" />
                    </svg>
                  ) : null}
                  {r.status === "registered" && r.priceWeeklyCents != null ? (
                    <span className="ml-auto font-sans text-[10px] font-semibold text-ink-2 flex-shrink-0">
                      ${Math.round(r.priceWeeklyCents / 100)}
                    </span>
                  ) : null}
                  <span className={`${r.status === "registered" && r.priceWeeklyCents != null ? "" : "ml-auto "}font-sans font-semibold text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full border border-ink ${s.bg} ${s.text}`}>
                    {r.status}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <ConsideringChips chips={consideringChips} onChipClick={onEntryClick} />
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div className={`h-full ${isDraggingCamp ? "opacity-40 pointer-events-none" : ""}`}>{content}</div>
      {isDraggingCamp && (
        <div className="absolute inset-0">
          <CellDropZones childId={childId} weekStart={weekStart} />
        </div>
      )}
    </div>
  );
}
