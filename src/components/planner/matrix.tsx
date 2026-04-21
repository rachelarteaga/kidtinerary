"use client";

import { useState, useEffect } from "react";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { KidColumnHeader } from "./kid-column-header";
import { PlannerCell, type CellLegendRow } from "./planner-cell";
import { BlockCard } from "./block-card";
import { KidAvatar } from "./kid-avatar";
import { AddKidMenu } from "./add-kid-menu";
import { formatWeekLabelParts, formatWeekLabelCompact, getWeekKey } from "@/lib/format";
import type { PlannerBlockType } from "@/lib/supabase/types";
import type { TimelineEntry } from "./cell-timeline-grid";
import type { ConsideringChip } from "./considering-chips";

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
  timelineEntries: TimelineEntry[];
  legendRows: CellLegendRow[];
  consideringChips: ConsideringChip[];
}

export interface WeekRow {
  weekStart: Date;
  cells: WeekCell[];
  fullRowBlock: { blockId: string; type: PlannerBlockType; title: string; emoji?: string | null; subtitle?: string } | null;
  partialBlocksByChild: Record<string, { blockId: string; type: PlannerBlockType; title: string; emoji?: string | null }>;
}

interface Props {
  children: Child[];
  allUserKids: Child[];
  plannerId: string;
  weeks: WeekRow[];
  orderedIds: string[];
  plannerStart: Date;
  plannerEnd: Date;
  viewMode: "detail" | "simple";
  isDraggingCamp: boolean;
  onAddCampClick: (childId: string | null, weekStart: string | null) => void;
  onAddBlockClick: (childId: string | null, weekStart: string | null) => void;
  onEntryClick: (entryId: string) => void;
  onBlockClick: (blockId: string) => void;
  onRemoveKid: (childId: string) => void;
}

function ageYears(birthDate: string): number {
  const ms = Date.now() - new Date(birthDate).getTime();
  return Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
}

export function PlannerMatrix({
  children,
  allUserKids,
  plannerId,
  weeks,
  orderedIds,
  plannerStart,
  plannerEnd,
  viewMode,
  isDraggingCamp,
  onAddCampClick,
  onAddBlockClick,
  onEntryClick,
  onBlockClick,
  onRemoveKid,
}: Props) {
  const childById = new Map(children.map((c) => [c.id, c]));
  const orderedChildren = orderedIds.map((id) => childById.get(id)!).filter(Boolean);
  const memberIdSet = new Set(orderedIds);
  const availableKids = allUserKids.filter((k) => !memberIdSet.has(k.id));
  const allowRemove = orderedChildren.length > 1;

  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setNarrow(mq.matches);
    const handler = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const [focusedKidId, setFocusedKidId] = useState<string>(orderedIds[0] ?? "");
  useEffect(() => {
    if (!orderedIds.includes(focusedKidId) && orderedIds.length > 0) setFocusedKidId(orderedIds[0]);
  }, [orderedIds, focusedKidId]);

  const cols = orderedChildren.length;
  const gridTemplate = `100px ${"1fr ".repeat(cols).trim()} 48px`;

  // Empty-planner state: no kids assigned yet. Show only the header row with Add Kid.
  if (orderedChildren.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-end">
          <AddKidMenu plannerId={plannerId} availableKids={availableKids} />
        </div>
        <div className="rounded-lg border border-dashed border-driftwood/50 bg-white/30 p-8 text-center">
          <p className="font-serif text-xl text-bark mb-1">No kids on this planner yet</p>
          <p className="text-stone text-sm">
            Use the <span className="font-mono">+</span> button above to pick someone from your profile.
          </p>
        </div>
      </div>
    );
  }

  if (narrow && orderedChildren.length > 1) {
    const focused = orderedChildren.find((c) => c.id === focusedKidId) ?? orderedChildren[0];
    return (
      <div className="flex flex-col md:h-full min-h-0 w-full">
        <div className="flex gap-2 overflow-x-auto pb-1 items-stretch flex-shrink-0 mb-3">
          {orderedChildren.map((c) => (
            <button
              key={c.id}
              onClick={() => setFocusedKidId(c.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm flex items-center gap-2 ${c.id === focusedKidId ? "bg-white" : "bg-white opacity-60"}`}
              style={{ borderColor: c.id === focusedKidId ? c.color : "#d9c9b0" }}
            >
              <KidAvatar name={c.name} color={c.color} avatarUrl={c.avatar_url} size={22} />
              {c.name}
            </button>
          ))}
          <div className="shrink-0 flex items-center pl-1">
            <AddKidMenu plannerId={plannerId} availableKids={availableKids} />
          </div>
        </div>
        <div className="md:flex-1 md:overflow-y-auto min-h-0 space-y-3">
          {weeks.map((w) => {
            const weekKey = getWeekKey(w.weekStart);
            const weekStartStr = w.weekStart.toISOString().split("T")[0];
            const compactLabel = viewMode === "simple" ? formatWeekLabelCompact(w.weekStart) : null;
            const labelParts = viewMode !== "simple" ? formatWeekLabelParts(w.weekStart) : null;
            if (w.fullRowBlock) {
              return (
                <div key={weekKey}>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-stone mb-1 whitespace-nowrap">
                    {compactLabel ?? (
                      <span className="flex flex-col leading-tight">
                        <span>{labelParts!.month}</span>
                        <span>{labelParts!.days}</span>
                      </span>
                    )}
                  </div>
                  <BlockCard
                    blockId={w.fullRowBlock.blockId}
                    type={w.fullRowBlock.type}
                    title={w.fullRowBlock.title}
                    emoji={w.fullRowBlock.emoji}
                    subtitle={w.fullRowBlock.subtitle}
                    onClick={() => onBlockClick(w.fullRowBlock!.blockId)}
                    onChanged={() => { /* parent refreshes on its own */ }}
                  />
                </div>
              );
            }
            const partial = w.partialBlocksByChild[focused.id];
            const focusedCell = w.cells.find((c) => c.childId === focused.id);
            return (
              <div key={weekKey}>
                <div className="font-mono text-[10px] uppercase tracking-widest text-stone mb-1 whitespace-nowrap">
                  {compactLabel ?? (
                    <span className="flex flex-col leading-tight">
                      <span>{labelParts!.month}</span>
                      <span>{labelParts!.days}</span>
                    </span>
                  )}
                </div>
                {partial ? (
                  <BlockCard
                    blockId={partial.blockId}
                    type={partial.type}
                    title={partial.title}
                    emoji={partial.emoji}
                    onClick={() => onBlockClick(partial.blockId)}
                    onChanged={() => { /* parent refreshes on its own */ }}
                  />
                ) : (
                  <PlannerCell
                    childId={focused.id}
                    weekStart={weekStartStr}
                    weekStartDate={w.weekStart}
                    plannerStart={plannerStart}
                    plannerEnd={plannerEnd}
                    viewMode={viewMode}
                    isDraggingCamp={isDraggingCamp}
                    timelineEntries={focusedCell?.timelineEntries ?? []}
                    legendRows={focusedCell?.legendRows ?? []}
                    consideringChips={focusedCell?.consideringChips ?? []}
                    onEntryClick={onEntryClick}
                    onAddClick={(cid, ws) => onAddCampClick(cid, ws)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:h-full min-h-0 w-full">
      <div className="grid gap-2 mb-3 flex-shrink-0" style={{ gridTemplateColumns: gridTemplate }}>
        <div />
        <SortableContext items={orderedIds} strategy={horizontalListSortingStrategy}>
          {orderedChildren.map((c) => (
            <KidColumnHeader
              key={c.id}
              child={c}
              ageYears={ageYears(c.birth_date)}
              onRemove={allowRemove ? () => onRemoveKid(c.id) : undefined}
            />
          ))}
        </SortableContext>
        <div className="flex items-center justify-center">
          <AddKidMenu plannerId={plannerId} availableKids={availableKids} />
        </div>
      </div>

      <div className="md:flex-1 md:overflow-y-auto min-h-0 space-y-2">
      {weeks.map((w) => {
        const weekKey = getWeekKey(w.weekStart);
        const weekStartStr = w.weekStart.toISOString().split("T")[0];
        const compactLabel = viewMode === "simple" ? formatWeekLabelCompact(w.weekStart) : null;
        const labelParts = viewMode !== "simple" ? formatWeekLabelParts(w.weekStart) : null;

        if (w.fullRowBlock) {
          return (
            <div key={weekKey} className="grid gap-2" style={{ gridTemplateColumns: gridTemplate }}>
              <div className="font-mono text-[10px] uppercase tracking-widest text-stone self-center px-1.5 whitespace-nowrap">
                {compactLabel ?? (
                  <span className="flex flex-col leading-tight">
                    <span>{labelParts!.month}</span>
                    <span>{labelParts!.days}</span>
                  </span>
                )}
              </div>
              <div style={{ gridColumn: `2 / span ${cols}` }}>
                <BlockCard
                  blockId={w.fullRowBlock.blockId}
                  type={w.fullRowBlock.type}
                  title={w.fullRowBlock.title}
                  emoji={w.fullRowBlock.emoji}
                  subtitle={w.fullRowBlock.subtitle}
                  onClick={() => onBlockClick(w.fullRowBlock!.blockId)}
                  onChanged={() => { /* parent refreshes on its own */ }}
                />
              </div>
              <div />
            </div>
          );
        }

        return (
          <div key={weekKey} className="grid gap-2" style={{ gridTemplateColumns: gridTemplate }}>
            <div className="font-mono text-[10px] uppercase tracking-widest text-stone self-center px-1.5 whitespace-nowrap">
              {compactLabel ?? (
                <span className="flex flex-col leading-tight">
                  <span>{labelParts!.month}</span>
                  <span>{labelParts!.days}</span>
                </span>
              )}
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
                    onClick={() => onBlockClick(partial.blockId)}
                    onChanged={() => { /* parent refreshes on its own */ }}
                  />
                );
              }
              const cell = w.cells.find((c) => c.childId === child.id);
              return (
                <PlannerCell
                  key={`${weekKey}-${child.id}`}
                  childId={child.id}
                  weekStart={weekStartStr}
                  weekStartDate={w.weekStart}
                  plannerStart={plannerStart}
                  plannerEnd={plannerEnd}
                  viewMode={viewMode}
                  isDraggingCamp={isDraggingCamp}
                  timelineEntries={cell?.timelineEntries ?? []}
                  legendRows={cell?.legendRows ?? []}
                  consideringChips={cell?.consideringChips ?? []}
                  onEntryClick={onEntryClick}
                  onAddClick={(cid, ws) => onAddCampClick(cid, ws)}
                />
              );
            })}
            <div />
          </div>
        );
      })}
      </div>
    </div>
  );
}
