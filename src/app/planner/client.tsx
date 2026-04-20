"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { PlannerMatrix, type WeekRow, type CellEntry } from "@/components/planner/matrix";
import { MyCampsRail } from "@/components/planner/my-camps-rail";
import { AddCampModal } from "@/components/planner/add-camp-modal";
import { AddBlockModal } from "@/components/planner/add-block-modal";
import { useScrapeJob } from "@/lib/use-scrape-job";
import { reorderKidColumns, assignCampToWeek } from "@/lib/actions";
import { generateWeeks, getWeekKey, formatTimeSlot, formatPrice, formatPriceUnit } from "@/lib/format";
import { detectSharedEntries } from "@/lib/planner-matrix";
import type { PlannerEntryRow, UserCampWithActivity, PlannerBlockWithKids } from "@/lib/queries";

interface Kid {
  id: string;
  name: string;
  birth_date: string;
  color: string;
  avatar_url: string | null;
  sort_order: number;
  interests: string[];
}

interface Props {
  kids: Kid[];
  entries: PlannerEntryRow[];
  userCamps: UserCampWithActivity[];
  blocks: PlannerBlockWithKids[];
  shareCampsDefault: boolean;
}

export function PlannerClient({ kids, entries, userCamps, blocks, shareCampsDefault }: Props) {
  const router = useRouter();
  const [campModal, setCampModal] = useState<{ childId: string | null; weekStart: string | null } | null>(null);
  const [blockModal, setBlockModal] = useState<{ childId: string | null; weekStart: string | null } | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [draggingCamp, setDraggingCamp] = useState<{ name: string } | null>(null);

  const { done } = useScrapeJob(activeJobId);
  useEffect(() => {
    if (done && activeJobId) {
      setActiveJobId(null);
      router.refresh();
    }
  }, [done, activeJobId, router]);

  // Kid ordering lives here so the top-level drag-end handler sees it.
  const [orderedIds, setOrderedIds] = useState(kids.map((c) => c.id));
  useEffect(() => {
    setOrderedIds(kids.map((c) => c.id));
  }, [kids]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    if (data?.type === "camp") {
      setDraggingCamp({ name: String(data.name) });
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDraggingCamp(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current as
      | { type?: string; userCampId?: string; name?: string }
      | undefined;
    const overData = over.data.current as
      | { type?: string; childId?: string; weekStart?: string }
      | undefined;

    // Case 1: Camp dropped on a cell
    if (
      activeData?.type === "camp" &&
      activeData.userCampId &&
      overData?.type === "cell" &&
      overData.childId &&
      overData.weekStart
    ) {
      const result = await assignCampToWeek(activeData.userCampId, overData.childId, overData.weekStart);
      if (!result.error) router.refresh();
      return;
    }

    // Case 2: Kid column reorder
    if (activeData?.type === "kid-column") {
      if (active.id === over.id) return;
      const oldIndex = orderedIds.indexOf(active.id as string);
      const newIndex = orderedIds.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      const next = arrayMove(orderedIds, oldIndex, newIndex);
      setOrderedIds(next);
      await reorderKidColumns(next);
      return;
    }
  }

  const dateRange = useMemo(() => {
    const from = new Date();
    const to = new Date();
    to.setMonth(to.getMonth() + 3);
    return { from, to };
  }, []);

  const weekStarts = useMemo(() => generateWeeks(dateRange.from, dateRange.to), [dateRange]);

  const sharingInput = entries.map((e) => ({
    entryId: e.id,
    childId: e.child_id,
    activityId: e.session.activity.id,
    weekKey: getWeekKey(new Date(e.session.starts_at + "T00:00:00")),
  }));
  const sharedMap = detectSharedEntries(sharingInput, kids.map((k) => ({ id: k.id, name: k.name })));

  const weeks: WeekRow[] = weekStarts.map((weekStart) => {
    const weekKey = getWeekKey(weekStart);

    const cells = kids.map((kid) => {
      const kidEntries = entries.filter((e) => {
        if (e.child_id !== kid.id) return false;
        const ws = new Date(e.session.starts_at + "T00:00:00");
        return getWeekKey(ws) === weekKey;
      });
      const cellEntries: CellEntry[] = kidEntries.map((e) => {
        const act = e.session.activity;
        const lowest = act.price_options?.[0];
        return {
          kind: "camp" as const,
          entryId: e.id,
          activityName: act.name,
          activitySlug: act.slug,
          status: e.status,
          timeLabel: e.session.time_slot ? formatTimeSlot(e.session.time_slot as any) : null,
          priceLabel: lowest ? `${formatPrice(lowest.price_cents)}${formatPriceUnit(lowest.price_unit as any)}` : null,
          sharedWith: sharedMap.get(e.id) ?? [],
          isLoading: !act.verified && (act.price_options?.length ?? 0) === 0,
        };
      });
      return { childId: kid.id, entries: cellEntries };
    });

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const overlaps = blocks.filter(
      (b) => new Date(b.start_date) <= weekEnd && new Date(b.end_date) >= weekStart
    );

    let fullRowBlock: WeekRow["fullRowBlock"] = null;
    const partialBlocksByChild: WeekRow["partialBlocksByChild"] = {};
    for (const b of overlaps) {
      const coversAll = kids.every((k) => b.child_ids.includes(k.id));
      if (coversAll) {
        fullRowBlock = { blockId: b.id, type: b.type, title: b.title, emoji: b.emoji, subtitle: `${b.child_ids.length} kids` };
      } else {
        for (const cid of b.child_ids) partialBlocksByChild[cid] = { blockId: b.id, type: b.type, title: b.title, emoji: b.emoji };
      }
    }

    return { weekStart, cells, fullRowBlock, partialBlocksByChild };
  });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-serif text-4xl mb-1">Planner</h1>
            <p className="text-stone">{kids.length} kid{kids.length === 1 ? "" : "s"} · {weeks.length} weeks</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCampModal({ childId: null, weekStart: null })}
              className="font-mono text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-bark text-cream hover:bg-bark/90"
            >
              + Add camp
            </button>
            <button
              onClick={() => setBlockModal({ childId: null, weekStart: null })}
              className="font-mono text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-white border border-driftwood text-bark hover:border-bark"
            >
              + Add block
            </button>
          </div>
        </header>

        <div className="flex flex-col md:flex-row gap-6 items-start">
          <MyCampsRail
            camps={userCamps}
            onChipClick={(c) => router.push(`/activity/${c.activity.slug}`)}
            onAddClick={() => setCampModal({ childId: null, weekStart: null })}
          />

          <div className="flex-1 min-w-0 w-full">
            <PlannerMatrix
              children={kids}
              weeks={weeks}
              orderedIds={orderedIds}
              onAddCampClick={(childId, weekStart) => setCampModal({ childId, weekStart })}
              onAddBlockClick={(childId, weekStart) => setBlockModal({ childId, weekStart })}
              onChanged={() => router.refresh()}
            />
          </div>
        </div>

        <AddCampModal
          open={campModal !== null}
          onClose={() => setCampModal(null)}
          scope={campModal ?? { childId: null, weekStart: null }}
          shareCampsDefault={shareCampsDefault}
          onSubmitted={(result) => {
            if (result.jobId) setActiveJobId(result.jobId);
            router.refresh();
          }}
        />
        <AddBlockModal
          open={blockModal !== null}
          onClose={() => setBlockModal(null)}
          children={kids}
          scope={blockModal ?? { childId: null, weekStart: null }}
          onSubmitted={() => router.refresh()}
        />
      </main>

      <DragOverlay>
        {draggingCamp ? (
          <div className="rounded-lg border border-sunset bg-white shadow-xl p-2.5 w-56 opacity-90 rotate-2">
            <div className="font-medium text-sm text-bark truncate">{draggingCamp.name}</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
