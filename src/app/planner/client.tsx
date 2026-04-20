"use client";

import { useMemo, useState, useEffect } from "react";
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
import { AddCampModal } from "@/components/planner/add-camp-modal";
import { AddBlockModal } from "@/components/planner/add-block-modal";
import { CampDetailDrawer } from "@/components/planner/camp-detail-drawer";
import { BlockDetailDrawer } from "@/components/planner/block-detail-drawer";
import { PlannerRangePicker } from "@/components/planner/planner-range-picker";
import { useScrapeJob } from "@/lib/use-scrape-job";
import { reorderKidColumns, assignCampToWeek } from "@/lib/actions";
import { generateWeeks, getWeekKey } from "@/lib/format";
import type { PlannerEntryRow, UserCampWithActivity, PlannerBlockWithKids } from "@/lib/queries";
import type { PlannerRow } from "@/lib/supabase/types";

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
  planner: PlannerRow;
}

export function PlannerClient({ kids, entries, userCamps, blocks, shareCampsDefault, planner }: Props) {
  const router = useRouter();

  const [campModal, setCampModal] = useState<{ childId: string | null; weekStart: string | null } | null>(null);
  const [blockModal, setBlockModal] = useState<{ childId: string | null; weekStart: string | null } | null>(null);
  const [drawerEntryId, setDrawerEntryId] = useState<string | null>(null);
  const [drawerBlockId, setDrawerBlockId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [draggingCamp, setDraggingCamp] = useState<{ name: string; color: string } | null>(null);
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    if (data?.type === "camp") {
      setDraggingCamp({ name: String(data.name ?? ""), color: String(data.color ?? "#f4b76f") });
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
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
      await reorderKidColumns(next);
    }
  }

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
          description: `${e.session_part === "full" ? "Full" : e.session_part.toUpperCase()} · ${e.status}`,
          isWaitlisted: e.status === "waitlisted",
        }));

      const consideringChips = kidEntries
        .filter((e) => e.status === "considering")
        .map((e) => ({
          entryId: e.id,
          activityName: e.session.activity.name,
          color: colorByActivityId.get(e.session.activity.id) ?? "#f4b76f",
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
        fullRowBlock = { blockId: b.id, type: b.type, title: b.title, emoji: b.emoji, subtitle: `${b.child_ids.length} kids` };
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <header className="sticky top-0 z-30 bg-cream flex items-start justify-between mb-6 flex-wrap gap-3 pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pt-6">
          <div>
            <h1 className="font-serif text-4xl mb-1">{planner.name}</h1>
            <p className="text-stone">{kids.length} kid{kids.length === 1 ? "" : "s"} · {weekStarts.length} weeks</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="inline-flex rounded-full border border-driftwood/40 bg-white overflow-hidden">
              <button
                onClick={() => setViewMode("detail")}
                className={`font-mono text-[11px] uppercase tracking-widest px-3 py-2 transition-colors ${
                  viewMode === "detail" ? "bg-bark text-cream" : "text-stone hover:text-bark"
                }`}
              >
                Detail
              </button>
              <button
                onClick={() => setViewMode("simple")}
                className={`font-mono text-[11px] uppercase tracking-widest px-3 py-2 transition-colors ${
                  viewMode === "simple" ? "bg-bark text-cream" : "text-stone hover:text-bark"
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
            onChanged={() => router.refresh()}
          />

          <div className="w-full md:flex-1 min-w-0">
            <PlannerMatrix
              children={kids}
              weeks={weeks}
              orderedIds={orderedIds}
              plannerStart={plannerStart}
              plannerEnd={plannerEnd}
              viewMode={viewMode}
              onAddCampClick={(childId, weekStart) => setCampModal({ childId, weekStart })}
              onAddBlockClick={(childId, weekStart) => setBlockModal({ childId, weekStart })}
              onEntryClick={(entryId) => setDrawerEntryId(entryId)}
              onBlockClick={(blockId) => setDrawerBlockId(blockId)}
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
      </main>

      <DragOverlay dropAnimation={null}>
        {draggingCamp ? (
          <div className="rounded-lg border-2 bg-white shadow-2xl p-2.5 w-56 rotate-2 pointer-events-none" style={{ borderColor: draggingCamp.color }}>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: draggingCamp.color }} />
              <div className="font-medium text-sm text-bark truncate">{draggingCamp.name}</div>
            </div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-widest text-stone">
              Drop on a week ↓
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
