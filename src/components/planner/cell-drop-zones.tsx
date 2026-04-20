"use client";

import { useDroppable } from "@dnd-kit/core";
import type { PlannerEntryStatus } from "@/lib/supabase/types";

interface Props {
  childId: string;
  weekStart: string;
}

const ZONES: { status: PlannerEntryStatus; label: string; border: string; bg: string; text: string }[] = [
  { status: "registered", label: "Register", border: "border-meadow", bg: "bg-meadow/15", text: "text-meadow" },
  { status: "waitlisted", label: "Waitlist", border: "border-campfire", bg: "bg-campfire/15", text: "text-campfire" },
  { status: "considering", label: "Consider", border: "border-driftwood", bg: "bg-driftwood/15", text: "text-stone" },
];

function Zone({
  status,
  label,
  border,
  bg,
  text,
  childId,
  weekStart,
}: { status: PlannerEntryStatus; label: string; border: string; bg: string; text: string; childId: string; weekStart: string }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `cell-drop-${childId}-${weekStart}-${status}`,
    data: { type: "cell-drop", childId, weekStart, status },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 rounded border-2 border-dashed px-2 py-2 text-center font-mono text-[10px] uppercase tracking-widest transition-colors ${border} ${bg} ${text} ${
        isOver ? "border-solid scale-[1.02]" : ""
      }`}
    >
      {label}
    </div>
  );
}

export function CellDropZones({ childId, weekStart }: Props) {
  return (
    <div className="flex gap-1.5">
      {ZONES.map((z) => (
        <Zone key={z.status} {...z} childId={childId} weekStart={weekStart} />
      ))}
    </div>
  );
}
