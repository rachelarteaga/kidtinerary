"use client";

import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";

interface Props {
  childId: string;
  weekStart: string;
  /** When provided, the overlay is tappable and calls this on click (mobile
   * tap-to-place flow). Drag-and-drop still works regardless. */
  onTap?: () => void;
}

export function CellDropZones({ childId, weekStart, onTap }: Props) {
  const data = useMemo(
    () => ({ type: "cell-drop" as const, childId, weekStart }),
    [childId, weekStart]
  );
  const { isOver, setNodeRef } = useDroppable({
    id: `cell-drop-${childId}-${weekStart}`,
    data,
  });

  const className = `w-full h-full rounded-lg border-2 border-dashed transition-colors ${
    isOver ? "border-ink bg-[#dfecf5]/80 scale-[1.02]" : "border-ink-3 bg-[#dfecf5]/30"
  }`;

  if (onTap) {
    return (
      <button
        ref={setNodeRef}
        type="button"
        onClick={onTap}
        className={`${className} cursor-pointer`}
        aria-label="Place activity here"
      />
    );
  }

  return <div ref={setNodeRef} className={className} />;
}
