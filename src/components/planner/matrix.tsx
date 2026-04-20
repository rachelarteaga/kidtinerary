"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { KidColumnHeader } from "./kid-column-header";
import { PlannerCell, type CellEntry } from "./planner-cell";
import { BlockCard } from "./block-card";
import { reorderKidColumns } from "@/lib/actions";
import { formatWeekRange, getWeekKey } from "@/lib/format";
import type { PlannerBlockType } from "@/lib/supabase/types";

interface Child {
  id: string;
  name: string;
  birth_date: string;
  color: string;
  avatar_url: string | null;
  sort_order: number;
}

export interface WeekCell {
  childId: string;
  entries: CellEntry[];
}

export interface WeekRow {
  weekStart: Date;
  cells: WeekCell[];
  fullRowBlock: { blockId: string; type: PlannerBlockType; title: string; emoji?: string | null; subtitle?: string } | null;
  partialBlocksByChild: Record<string, { blockId: string; type: PlannerBlockType; title: string; emoji?: string | null }>;
}

interface Props {
  children: Child[];
  weeks: WeekRow[];
  onAddCampClick: (childId: string | null, weekStart: string | null) => void;
  onAddBlockClick: (childId: string | null, weekStart: string | null) => void;
  onChanged: () => void;
}

function ageYears(birthDate: string): number {
  const ms = Date.now() - new Date(birthDate).getTime();
  return Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
}

export function PlannerMatrix({ children, weeks, onAddCampClick, onAddBlockClick, onChanged }: Props) {
  const [orderedIds, setOrderedIds] = useState(children.map((c) => c.id));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    setOrderedIds(children.map((c) => c.id));
  }, [children]);

  const childById = new Map(children.map((c) => [c.id, c]));
  const orderedChildren = orderedIds.map((id) => childById.get(id)!).filter(Boolean);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(active.id as string);
    const newIndex = orderedIds.indexOf(over.id as string);
    const next = arrayMove(orderedIds, oldIndex, newIndex);
    setOrderedIds(next);
    void reorderKidColumns(next);
  }

  const cols = orderedChildren.length;
  const gridTemplate = `100px ${"1fr ".repeat(cols).trim()}`;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="space-y-3">
        {/* Header row: kids */}
        <div className="grid gap-2" style={{ gridTemplateColumns: gridTemplate }}>
          <div />
          <SortableContext items={orderedIds} strategy={horizontalListSortingStrategy}>
            {orderedChildren.map((c) => (
              <KidColumnHeader key={c.id} child={c} ageYears={ageYears(c.birth_date)} />
            ))}
          </SortableContext>
        </div>

        {/* Week rows */}
        {weeks.map((w) => {
          const weekKey = getWeekKey(w.weekStart);
          const weekStartStr = w.weekStart.toISOString().split("T")[0];

          if (w.fullRowBlock) {
            return (
              <div key={weekKey} className="grid gap-2" style={{ gridTemplateColumns: "100px 1fr" }}>
                <div className="font-mono text-[10px] uppercase tracking-widest text-stone self-center px-1.5">
                  {formatWeekRange(w.weekStart)}
                </div>
                <BlockCard
                  blockId={w.fullRowBlock.blockId}
                  type={w.fullRowBlock.type}
                  title={w.fullRowBlock.title}
                  emoji={w.fullRowBlock.emoji}
                  subtitle={w.fullRowBlock.subtitle}
                  onChanged={onChanged}
                />
              </div>
            );
          }

          return (
            <div key={weekKey} className="grid gap-2" style={{ gridTemplateColumns: gridTemplate }}>
              <div className="font-mono text-[10px] uppercase tracking-widest text-stone self-center px-1.5">
                {formatWeekRange(w.weekStart)}
              </div>
              {orderedChildren.map((child) => {
                const partial = w.partialBlocksByChild[child.id];
                if (partial) {
                  return (
                    <BlockCard
                      key={`${weekKey}-${child.id}`}
                      blockId={partial.blockId}
                      type={partial.type}
                      title={partial.title}
                      emoji={partial.emoji}
                      onChanged={onChanged}
                    />
                  );
                }
                const cell = w.cells.find((c) => c.childId === child.id);
                return (
                  <PlannerCell
                    key={`${weekKey}-${child.id}`}
                    childId={child.id}
                    weekStart={weekStartStr}
                    entries={cell?.entries ?? []}
                    onAddClick={(cid, ws) => onAddCampClick(cid, ws)}
                    onChanged={onChanged}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </DndContext>
  );
}
