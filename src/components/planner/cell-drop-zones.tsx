"use client";

import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";

interface Props {
  childId: string;
  weekStart: string;
}

export function CellDropZones({ childId, weekStart }: Props) {
  const data = useMemo(
    () => ({ type: "cell-drop" as const, childId, weekStart }),
    [childId, weekStart]
  );
  const { isOver, setNodeRef } = useDroppable({
    id: `cell-drop-${childId}-${weekStart}`,
    data,
  });

  return (
    <div
      ref={setNodeRef}
      className={`w-full h-full rounded-lg border-2 border-dashed transition-colors flex items-center justify-center font-sans text-[11px] uppercase tracking-widest ${
        isOver
          ? "border-ink bg-hero-light/60 text-ink scale-[1.02]"
          : "border-ink-3 bg-hero-light/20 text-ink-2"
      }`}
    >
      {isOver ? "Drop to set status" : "Drop here"}
    </div>
  );
}
