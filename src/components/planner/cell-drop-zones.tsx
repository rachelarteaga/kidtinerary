"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { PlannerEntryStatus } from "@/lib/supabase/types";

interface Props {
  childId: string;
  weekStart: string;
}

const ZONES: { status: PlannerEntryStatus; label: string; border: string; bg: string; text: string }[] = [
  { status: "registered", label: "Register", border: "border-[#5fc39c]", bg: "bg-[#d8f0e6]", text: "text-[#5fc39c]" },
  { status: "waitlisted", label: "Waitlist", border: "border-ink", bg: "bg-hero-light/40", text: "text-ink" },
  { status: "considering", label: "Consider", border: "border-ink-3", bg: "bg-hero-light/40", text: "text-ink-2" },
];

function Zone({
  status,
  label,
  border,
  bg,
  text,
  childId,
  weekStart,
  visible,
  onIsOver,
}: {
  status: PlannerEntryStatus;
  label: string;
  border: string;
  bg: string;
  text: string;
  childId: string;
  weekStart: string;
  visible: boolean;
  onIsOver: (status: PlannerEntryStatus, isOver: boolean) => void;
}) {
  const data = useMemo(
    () => ({ type: "cell-drop" as const, childId, weekStart, status }),
    [childId, weekStart, status]
  );
  const { isOver, setNodeRef } = useDroppable({
    id: `cell-drop-${childId}-${weekStart}-${status}`,
    data,
  });

  useEffect(() => {
    onIsOver(status, isOver);
  }, [status, isOver, onIsOver]);

  if (!visible) {
    return (
      <div
        ref={setNodeRef}
        className="flex-1 opacity-0 pointer-events-none"
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 rounded border-2 border-dashed px-2 py-2 text-center font-sans text-[10px] uppercase tracking-widest transition-colors ${border} ${bg} ${text} ${
        isOver ? "border-solid scale-[1.02]" : ""
      }`}
    >
      {label}
    </div>
  );
}

export function CellDropZones({ childId, weekStart }: Props) {
  const [overStatus, setOverStatus] = useState<PlannerEntryStatus | null>(null);

  const handleIsOver = useCallback(
    (status: PlannerEntryStatus, isOver: boolean) => {
      setOverStatus((prev) => {
        if (isOver) return status;
        if (prev === status) return null;
        return prev;
      });
    },
    []
  );

  const anyOver = overStatus !== null;

  return (
    <div className="flex gap-1.5 min-h-[40px]">
      {ZONES.map((z) => (
        <Zone
          key={z.status}
          {...z}
          childId={childId}
          weekStart={weekStart}
          visible={anyOver}
          onIsOver={handleIsOver}
        />
      ))}
    </div>
  );
}
