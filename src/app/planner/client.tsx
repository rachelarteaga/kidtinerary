"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
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
import { PlannerMatrix, type WeekRow } from "@/components/planner/matrix";
import { MyCampsRail } from "@/components/planner/my-camps-rail";
import { AddEntryModal } from "@/components/planner/add-entry-modal";
import { CampDetailDrawer } from "@/components/planner/camp-detail-drawer";
import { BlockDetailDrawer } from "@/components/planner/block-detail-drawer";
import { PlannerRangePicker } from "@/components/planner/planner-range-picker";
import { PlannerTitle } from "@/components/planner/planner-title";
import { CampQuickViewModal } from "@/components/planner/camp-quick-view-modal";
import { useScrapeJob } from "@/lib/use-scrape-job";
import { reorderKidColumns, assignCampToWeek, removeKidFromPlanner } from "@/lib/actions";
import { generateWeeks, getWeekKey } from "@/lib/format";
import type { PlannerEntryRow, UserCampWithActivity, PlannerBlockWithKids } from "@/lib/queries";
import type { PlannerRow } from "@/lib/supabase/types";

// Module-level constants so the references stay stable across renders.
// dnd-kit's useSensor memoizes on these, so a fresh object each render causes
// the sensor array to churn (and DndContext to resubscribe sensors).
const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 8 } };

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
  allUserKids: Kid[];
  entries: PlannerEntryRow[];
  userCamps: UserCampWithActivity[];
  blocks: PlannerBlockWithKids[];
  shareCampsDefault: boolean;
  planner: PlannerRow;
}

export function PlannerClient({ kids, allUserKids, entries, userCamps, blocks, shareCampsDefault, planner }: Props) {
  const router = useRouter();

  const [entryModal, setEntryModal] = useState<{ childId: string | null; weekStart: string | null; tab: "camp" | "block" } | null>(null);
  const [drawerEntryId, setDrawerEntryId] = useState<string | null>(null);
  const [drawerBlockId, setDrawerBlockId] = useState<string | null>(null);
  const [quickViewCampId, setQuickViewCampId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [draggingCamp, setDraggingCamp] = useState<{ name: string; color: string } | null>(null);
  const isDraggingCamp = draggingCamp !== null;
  const [viewMode, setViewMode] = useState<"detail" | "simple">("detail");

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("planner-view-mode");
    if (stored === "simple" || stored === "detail") setViewMode(stored);
  }, []);

  // Persist on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("planner-view-mode", viewMode);
  }, [viewMode]);

  const { done } = useScrapeJob(activeJobId);
  useEffect(() => {
    if (done && activeJobId) {
      setActiveJobId(null);
      router.refresh();
    }
  }, [done, activeJobId, router]);

  const [orderedIds, setOrderedIds] = useState(kids.map((c) => c.id));
  useEffect(() => setOrderedIds(kids.map((c) => c.id)), [kids]);

  // Stable sensor options reference so useSensor's memo doesn't thrash.
  const pointerSensor = useSensor(PointerSensor, POINTER_SENSOR_OPTIONS);
  const sensors = useSensors(pointerSensor);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === "camp") {
      setDraggingCamp({ name: String(data.name ?? ""), color: String(data.color ?? "#f4b76f") });
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setDraggingCamp(null);
      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current as { type?: string; userCampId?: string } | undefined;
      const overData = over.data.current as { type?: string; childId?: string; weekStart?: string; status?: "considering" | "waitlisted" | "registered" } | undefined;

      if (activeData?.type === "camp" && overData?.type === "cell-drop" && overData.childId && overData.weekStart) {
        const status = overData.status ?? "considering";
        const result = await assignCampToWeek(activeData.userCampId!, overData.childId, overData.weekStart, status);
        if (result.error) {
          alert(result.error);
          return;
        }
        router.refresh();
        return;
      }

      if (activeData?.type === "kid-column") {
        if (active.id === over.id) return;
        const oldIndex = orderedIds.indexOf(active.id as string);
        const newIndex = orderedIds.indexOf(over.id as string);
        if (oldIndex === -1 || newIndex === -1) return;
        const next = arrayMove(orderedIds, oldIndex, newIndex);
        setOrderedIds(next);
        await reorderKidColumns(planner.id, next);
      }
    },
    [orderedIds, router, planner.id]
  );

  const handleRemoveKid = useCallback(
    async (childId: string) => {
      const result = await removeKidFromPlanner(planner.id, childId);
      if (result.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    },
    [planner.id, router]
  );

  const plannerStart = useMemo(() => new Date(planner.start_date + "T00:00:00"), [planner.start_date]);
  const plannerEnd = useMemo(() => new Date(planner.end_date + "T23:59:59"), [planner.end_date]);
  const weekStarts = useMemo(() => generateWeeks(plannerStart, plannerEnd), [plannerStart, plannerEnd]);

  const colorByActivityId = useMemo(() => {
    const m = new Map<string, string>();
    for (const uc of userCamps) m.set(uc.activity.id, uc.color);
    return m;
  }, [userCamps]);

  const weeks: WeekRow[] = weekStarts.map((weekStart) => {
    const weekKey = getWeekKey(weekStart);
    const cells = kids.map((kid) => {
      const kidEntries = entries.filter((e) => {
        if (e.child_id !== kid.id) return false;
        const ws = new Date(e.session.starts_at + "T00:00:00");
        return getWeekKey(ws) === weekKey;
      });

      const timelineEntries = kidEntries
        .filter((e) => e.status !== "considering")
        .map((e) => ({
          id: e.id,
          color: colorByActivityId.get(e.session.activity.id) ?? "#f4b76f",
          status: e.status,
          sessionPart: e.session_part,
          daysOfWeek: e.days_of_week,
        }));

      const legendRows = kidEntries
        .filter((e) => e.status !== "considering")
        .map((e) => ({
          entryId: e.id,
          activityName: e.session.activity.name,
          color: colorByActivityId.get(e.session.activity.id) ?? "#f4b76f",
          status: e.status,
          isOvernight: e.session_part === "overnight",
        }));

      const consideringChips = kidEntries
        .filter((e) => e.status === "considering")
        .map((e) => ({
          entryId: e.id,
          activityName: e.session.activity.name,
          color: colorByActivityId.get(e.session.activity.id) ?? "#f4b76f",
          isOvernight: e.session_part === "overnight",
        }));

      return { childId: kid.id, timelineEntries, legendRows, consideringChips };
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
        fullRowBlock = { blockId: b.id, type: b.type, title: b.title, emoji: b.emoji };
      } else {
        for (const cid of b.child_ids) partialBlocksByChild[cid] = { blockId: b.id, type: b.type, title: b.title, emoji: b.emoji };
      }
    }

    return { weekStart, cells, fullRowBlock, partialBlocksByChild };
  });

  const drawerEntry = useMemo(() => {
    if (!drawerEntryId) return null;
    const e = entries.find((x) => x.id === drawerEntryId);
    if (!e) return null;
    const uc = userCamps.find((u) => u.activity.id === e.session.activity.id);
    return {
      id: e.id,
      childId: e.child_id,
      weekStart: new Date(e.session.starts_at + "T00:00:00"),
      userCampId: uc?.id ?? "",
      activityName: e.session.activity.name,
      activitySlug: e.session.activity.slug,
      activityUrl: null as string | null,
      activityDescription: null as string | null,
      orgName: uc?.activity.organization?.name ?? null,
      verified: uc?.activity.verified ?? false,
      status: e.status,
      sessionPart: e.session_part,
      daysOfWeek: e.days_of_week,
      priceCents: e.price_cents,
      priceUnit: e.price_unit,
      extras: e.extras,
      notes: e.notes,
    };
  }, [drawerEntryId, entries, userCamps]);

  const drawerBlock = useMemo(() => {
    if (!drawerBlockId) return null;
    const b = blocks.find((x) => x.id === drawerBlockId);
    if (!b) return null;
    return {
      id: b.id,
      type: b.type,
      title: b.title,
      emoji: b.emoji,
      startDate: b.start_date,
      endDate: b.end_date,
      childIds: b.child_ids,
    };
  }, [drawerBlockId, blocks]);

  const rangePickerEntries = entries.map((e) => ({
    startsAt: e.session.starts_at,
    endsAt: e.session.ends_at,
  }));
  const rangePickerBlocks = blocks.map((b) => ({
    startDate: b.start_date,
    endDate: b.end_date,
  }));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <main className="md:h-[calc(100dvh-73px)] flex flex-col md:overflow-hidden">
        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          <MyCampsRail
            camps={userCamps}
            onChipClick={(c) => setQuickViewCampId(c.id)}
            onAddClick={() => setEntryModal({ childId: null, weekStart: null, tab: "camp" })}
            onChanged={() => router.refresh()}
          />

          <div className="flex-1 min-w-0 flex flex-col md:h-full md:overflow-hidden">
            <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex flex-col flex-1 min-h-0">
              <header className="bg-surface flex items-start justify-between flex-wrap gap-3 pt-[22px] pb-[18px] flex-shrink-0">
                <div>
                  <div className="mb-1">
                    <PlannerTitle plannerId={planner.id} name={planner.name} />
                  </div>
                  <p className="text-ink-2">{kids.length} kid{kids.length === 1 ? "" : "s"} · {weekStarts.length} weeks</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <div className="inline-flex rounded-full border border-ink bg-surface overflow-hidden">
                    <button
                      onClick={() => setViewMode("detail")}
                      className={`font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-2 transition-colors ${
                        viewMode === "detail" ? "bg-ink text-ink-inverse" : "text-ink-2 hover:text-ink"
                      }`}
                    >
                      Detail
                    </button>
                    <button
                      onClick={() => setViewMode("simple")}
                      className={`font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-2 transition-colors ${
                        viewMode === "simple" ? "bg-ink text-ink-inverse" : "text-ink-2 hover:text-ink"
                      }`}
                    >
                      Simple
                    </button>
                  </div>
                  <PlannerRangePicker
                    plannerId={planner.id}
                    startDate={planner.start_date}
                    endDate={planner.end_date}
                    entries={rangePickerEntries}
                    blocks={rangePickerBlocks}
                    onChanged={() => router.refresh()}
                  />
                  <button
                    onClick={() => setEntryModal({ childId: null, weekStart: null, tab: "camp" })}
                    className="font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-ink text-ink-inverse hover:bg-[#333] border border-ink"
                  >
                    + Add
                  </button>
                </div>
              </header>

              <div className="border-y-[1.5px] border-ink pt-5 pb-4 flex-1 min-h-0 flex flex-col">
                <PlannerMatrix
                  children={kids}
                  allUserKids={allUserKids}
                  plannerId={planner.id}
                  weeks={weeks}
                  orderedIds={orderedIds}
                  plannerStart={plannerStart}
                  plannerEnd={plannerEnd}
                  viewMode={viewMode}
                  isDraggingCamp={isDraggingCamp}
                  onAddCampClick={(childId, weekStart) => setEntryModal({ childId, weekStart, tab: "camp" })}
                  onAddBlockClick={(childId, weekStart) => setEntryModal({ childId, weekStart, tab: "block" })}
                  onEntryClick={(entryId) => setDrawerEntryId(entryId)}
                  onBlockClick={(blockId) => setDrawerBlockId(blockId)}
                  onRemoveKid={handleRemoveKid}
                />
              </div>
            </div>
          </div>
        </div>

        <AddEntryModal
          open={entryModal !== null}
          onClose={() => setEntryModal(null)}
          scope={entryModal ?? { childId: null, weekStart: null }}
          shareCampsDefault={shareCampsDefault}
          kids={kids}
          initialTab={entryModal?.tab ?? "camp"}
          onCampSubmitted={(result) => {
            if (result.jobId) setActiveJobId(result.jobId);
            setEntryModal(null);
            router.refresh();
          }}
          onBlockSubmitted={() => {
            setEntryModal(null);
            router.refresh();
          }}
        />

        <CampDetailDrawer
          open={drawerEntryId !== null}
          onClose={() => setDrawerEntryId(null)}
          entry={drawerEntry}
          kids={kids}
          onChanged={() => router.refresh()}
        />
        <BlockDetailDrawer
          open={drawerBlockId !== null}
          onClose={() => setDrawerBlockId(null)}
          block={drawerBlock}
          kids={kids}
          onChanged={() => router.refresh()}
        />
        <CampQuickViewModal
          camp={userCamps.find((c) => c.id === quickViewCampId) ?? null}
          onClose={() => setQuickViewCampId(null)}
        />
      </main>

      <DragOverlay dropAnimation={null}>
        {draggingCamp ? (
          <div className="rounded-lg border border-ink bg-surface shadow-[3px_3px_0_0_rgba(0,0,0,0.15)] p-2.5 w-56 rotate-2 pointer-events-none" style={{ borderColor: draggingCamp.color }}>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: draggingCamp.color }} />
              <div className="font-medium text-sm text-ink truncate">{draggingCamp.name}</div>
            </div>
            <div className="mt-1 font-sans font-bold text-[9px] uppercase tracking-widest text-ink-2">
              Drop on a week ↓
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
