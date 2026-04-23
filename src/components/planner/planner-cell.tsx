"use client";

import { CellTimelineGrid, type TimelineEntry } from "./cell-timeline-grid";
import { ConsideringChips, type ConsideringChip } from "./considering-chips";
import { CellDropZones } from "./cell-drop-zones";
import type { DayOfWeek, PlannerEntryStatus } from "@/lib/supabase/types";
import type { ScheduleSlot } from "@/lib/schedule";

export interface CellLegendRow {
  entryId: string;
  activityName: string;
  /** Hosting organization. Null/empty, matching the activity name, or the
   * placeholder "User-submitted" suppresses the subtitle. */
  orgName: string | null;
  color: string;
  status: PlannerEntryStatus;
  isOvernight: boolean;
  /** Weekly total in cents (base + extras). Null if no price set. Only shown when status === "registered". */
  priceWeeklyCents: number | null;
}

function shouldShowOrg(orgName: string | null | undefined, activityName: string): boolean {
  if (!orgName) return false;
  if (orgName === activityName) return false;
  if (orgName === "User-submitted") return false;
  return true;
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
  if (!hasContent) {
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
        {viewMode === "detail" && (
          <CellTimelineGrid
            entries={timelineEntries}
            weekStart={weekStartDate}
            plannerStart={plannerStart}
            plannerEnd={plannerEnd}
            onSquareClick={handleSquareClick}
          />
        )}
        {legendRows.length > 0 && (
          <div className={viewMode === "detail" ? "mt-1.5 space-y-1" : "space-y-1"}>
            {legendRows.map((r) => {
              const s = STATUS_STYLE[r.status];
              const showOrg = shouldShowOrg(r.orgName, r.activityName);
              return (
                <button
                  key={r.entryId}
                  onClick={() => onEntryClick(r.entryId)}
                  className="w-full flex items-start gap-1.5 text-left text-xs text-ink hover:underline cursor-pointer"
                >
                  <span className="w-2 h-2 mt-1 rounded-full flex-shrink-0" style={{ background: r.color }} />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1">
                      <span className="truncate">{r.activityName}</span>
                      {r.isOvernight ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="#151515" className="flex-shrink-0" aria-label="Overnight">
                          <path d="M14 2 A 10 10 0 1 0 22 13 A 8 8 0 0 1 14 2 Z" />
                        </svg>
                      ) : null}
                    </span>
                    {showOrg && (
                      <span className="block truncate font-sans text-[10px] text-ink-2 leading-tight">{r.orgName}</span>
                    )}
                  </span>
                  {r.priceWeeklyCents != null ? (
                    <span className="font-sans text-[10px] font-semibold text-ink-2 flex-shrink-0 mt-0.5 py-0.5 border border-transparent leading-none">
                      ${Math.round(r.priceWeeklyCents / 100)}
                    </span>
                  ) : null}
                  <span className={`font-sans font-semibold text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full border border-ink flex-shrink-0 mt-0.5 ${s.bg} ${s.text}`}>
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
