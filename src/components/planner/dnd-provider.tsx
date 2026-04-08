"use client";

import { useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useToast } from "@/components/ui/toast";
import { addPlannerEntry } from "@/lib/actions";

interface DragData {
  activityId: string;
  activityName: string;
  sessionId: string;
  sessionLabel: string;
}

interface PlannerDndProviderProps {
  children: ReactNode;
  selectedChildId: string;
  onEntryAdded: () => void;
  existingEntryCount: number;
}

export function PlannerDndProvider({
  children,
  selectedChildId,
  onEntryAdded,
  existingEntryCount,
}: PlannerDndProviderProps) {
  const [activeItem, setActiveItem] = useState<DragData | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as DragData | undefined;
    if (data) {
      setActiveItem(data);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);

    const { active, over } = event;
    if (!over) return;

    const dragData = active.data.current as DragData | undefined;
    const dropWeekKey = over.id as string;

    if (!dragData || !dropWeekKey) return;

    const result = await addPlannerEntry(
      selectedChildId,
      dragData.sessionId,
      existingEntryCount
    );

    if (result.error) {
      toast(result.error, "error");
      return;
    }

    toast(`${dragData.activityName} penciled in!`, "success");
    onEntryAdded();
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}

      <DragOverlay>
        {activeItem ? (
          <div className="rounded-lg border border-sunset/40 bg-white shadow-lg p-3 text-sm w-60 opacity-90 rotate-2">
            <p className="font-medium text-bark">{activeItem.activityName}</p>
            <p className="font-mono text-[10px] text-stone uppercase tracking-wide mt-0.5">
              {activeItem.sessionLabel}
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
