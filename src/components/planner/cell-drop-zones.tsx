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
      className={`w-full h-full rounded-lg border-2 border-dashed transition-colors ${
        isOver
          ? "border-ink bg-[#dfecf5]/80 scale-[1.02]"
          : "border-ink-3 bg-[#dfecf5]/30"
      }`}
    />
  );
}
