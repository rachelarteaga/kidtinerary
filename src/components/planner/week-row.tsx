"use client";

import { useDroppable } from "@dnd-kit/core";
import type { PlannerEntryRow } from "@/lib/queries";
import { formatWeekRange } from "@/lib/format";
import { PlannerEntryCard } from "./entry-card";

interface WeekRowProps {
  weekKey: string;
  weekStart: Date;
  entries: PlannerEntryRow[];
  hasLockedIn: boolean;
  isCoverageGap: boolean;
  selectedChildId: string;
  onEntryUpdated: (entry: PlannerEntryRow) => void;
  onEntryRemoved: (entryId: string) => void;
}

export function WeekRow({
  weekKey,
  weekStart,
  entries,
  hasLockedIn,
  isCoverageGap,
  selectedChildId: _selectedChildId,
  onEntryUpdated,
  onEntryRemoved,
}: WeekRowProps) {
  const { isOver, setNodeRef } = useDroppable({ id: weekKey });

  const fridayStr = new Date(
    weekStart.getTime() + 4 * 86400000
  ).toISOString().split("T")[0];
  const mondayStr = weekStart.toISOString().split("T")[0];

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border p-4 transition-colors ${
        isOver
          ? "border-sunset bg-sunset/8 shadow-md"
          : isCoverageGap
            ? "border-sunset/30 bg-sunset/5"
            : "border-driftwood/30 bg-white"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-mono text-xs uppercase tracking-widest text-stone">
          {formatWeekRange(weekStart)}
        </h3>
        {isCoverageGap && (
          <a
            href={`/explore?dateFrom=${mondayStr}&dateTo=${fridayStr}`}
            className="font-mono text-[10px] uppercase tracking-wide text-sunset hover:text-sunset/80 transition-colors"
          >
            Need coverage &rarr;
          </a>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-driftwood italic py-3">
          {isOver
            ? "Drop here to pencil it in"
            : "Nothing penciled in for this week yet"}
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <PlannerEntryCard
              key={entry.id}
              entry={entry}
              isGreyedOut={hasLockedIn && entry.status !== "locked_in"}
              onEntryUpdated={onEntryUpdated}
              onEntryRemoved={onEntryRemoved}
            />
          ))}
        </div>
      )}
    </div>
  );
}
