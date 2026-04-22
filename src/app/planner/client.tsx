"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
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
import { StatusPickerPopover, type StatusPickerAnchor } from "@/components/planner/status-picker-popover";
import { ScrapeConfirmDrawer } from "@/components/planner/scrape-confirm-drawer";
import { CampPreviewModal, type PreviewSummary } from "@/components/planner/camp-preview-modal";
import { SharePlannerModal } from "@/components/planner/share-planner-modal";
import { useScrapeJob } from "@/lib/use-scrape-job";
import { reorderKidColumns, assignCampToWeek, removeKidFromPlanner } from "@/lib/actions";
import { generateWeeks, getWeekKey, formatWeekRange } from "@/lib/format";
import { extrasTotalCents } from "@/lib/extras-calc";
import type { PlannerEntryRow, UserCampWithActivity, PlannerBlockWithKids } from "@/lib/queries";
import type { PlannerEntryStatus, PlannerRow } from "@/lib/supabase/types";

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
  const [shortlistCampId, setShortlistCampId] = useState<string | null>(null);
  const [drawerBlockId, setDrawerBlockId] = useState<string | null>(null);
  const [quickViewCampId, setQuickViewCampId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [scrapeDrawer, setScrapeDrawer] = useState<{ jobId: string; userCampId: string | null; url: string; scopeLabel: string | null } | null>(null);
  const [draggingCamp, setDraggingCamp] = useState<{ name: string; color: string } | null>(null);
  const isDraggingCamp = draggingCamp !== null;
  const [pendingAssignment, setPendingAssignment] = useState<{
    userCampId: string;
    name: string;
    color: string;
    childId: string;
    weekStart: string;
    anchor: StatusPickerAnchor;
  } | null>(null);
  const [viewMode, setViewMode] = useState<"detail" | "simple">("detail");
  const plannerGridRef = useRef<HTMLDivElement>(null);
  const [shareOpen, setShareOpen] = useState(false);

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
      const dragged = draggingCamp;
      setDraggingCamp(null);
      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current as { type?: string; userCampId?: string; name?: string; color?: string } | undefined;
      const overData = over.data.current as { type?: string; childId?: string; weekStart?: string } | undefined;

      if (activeData?.type === "camp" && overData?.type === "cell-drop" && overData.childId && overData.weekStart) {
        const r = over.rect;
        setPendingAssignment({
          userCampId: activeData.userCampId!,
          name: dragged?.name ?? String(activeData.name ?? ""),
          color: dragged?.color ?? String(activeData.color ?? "#f4b76f"),
          childId: overData.childId,
          weekStart: overData.weekStart,
          anchor: { top: r.top, left: r.left, width: r.width, height: r.height },
        });
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
    [draggingCamp, orderedIds, planner.id]
  );

  const handleStatusChoice = useCallback(
    async (status: PlannerEntryStatus) => {
      if (!pendingAssignment) return;
      const { userCampId, childId, weekStart } = pendingAssignment;
      setPendingAssignment(null);
      const result = await assignCampToWeek(userCampId, childId, weekStart, status);
      if (result.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    },
    [pendingAssignment, router]
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
        .map((e) => {
          let priceWeeklyCents: number | null = null;
          if (e.price_cents != null) {
            const daysPerWeek = e.days_of_week.length;
            const basePerWeek =
              e.price_unit === "per_day" ? e.price_cents * daysPerWeek : e.price_cents;
            const extrasCents = extrasTotalCents(e.extras, daysPerWeek);
            priceWeeklyCents = basePerWeek + extrasCents;
          }
          return {
            entryId: e.id,
            activityName: e.session.activity.name,
            orgName: e.session.activity.organization?.name ?? null,
            color: colorByActivityId.get(e.session.activity.id) ?? "#f4b76f",
            status: e.status,
            isOvernight: e.session_part === "overnight",
            priceWeeklyCents,
          };
        });

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

  const committedCents = useMemo(() => {
    return entries
      .filter((e) => e.status === "registered" && e.price_cents != null)
      .reduce((sum, e) => {
        const daysPerWeek = e.days_of_week.length;
        const basePerWeek =
          e.price_unit === "per_day" ? e.price_cents! * daysPerWeek : e.price_cents!;
        return sum + basePerWeek + extrasTotalCents(e.extras, daysPerWeek);
      }, 0);
  }, [entries]);

  const spentByKid = useMemo(() => {
    const m = new Map<string, number>(kids.map((k) => [k.id, 0]));
    entries.forEach((e) => {
      if (e.status !== "registered" || e.price_cents == null) return;
      const daysPerWeek = e.days_of_week.length;
      const basePerWeek =
        e.price_unit === "per_day" ? e.price_cents * daysPerWeek : e.price_cents;
      const extras = extrasTotalCents(e.extras, daysPerWeek);
      m.set(e.child_id, (m.get(e.child_id) ?? 0) + basePerWeek + extras);
    });
    return m;
  }, [entries, kids]);

  const previewCamp = useMemo(
    () => (quickViewCampId ? userCamps.find((c) => c.id === quickViewCampId) ?? null : null),
    [quickViewCampId, userCamps],
  );

  const previewSummary = useMemo<PreviewSummary | null>(() => {
    if (!previewCamp) return null;
    const activityId = previewCamp.activity.id;
    const matching = entries.filter((e) => e.session.activity.id === activityId);
    const counts = { considering: 0, waitlisted: 0, registered: 0 };
    let totalRegisteredPerWeekCents = 0;
    let registeredWithPriceCount = 0;
    for (const e of matching) {
      counts[e.status] = (counts[e.status] ?? 0) + 1;
      if (e.status === "registered" && e.price_cents != null) {
        const daysPerWeek = e.days_of_week.length;
        const basePerWeek =
          e.price_unit === "per_day" ? e.price_cents * daysPerWeek : e.price_cents;
        totalRegisteredPerWeekCents += basePerWeek + extrasTotalCents(e.extras, daysPerWeek);
        registeredWithPriceCount += 1;
      }
    }
    return {
      counts,
      avgPricePaidPerWeekCents:
        registeredWithPriceCount > 0
          ? Math.round(totalRegisteredPerWeekCents / registeredWithPriceCount)
          : null,
    };
  }, [previewCamp, entries]);

  const drawerEntry = useMemo(() => {
    // Two entry points: clicked a placed entry in a cell (drawerEntryId),
    // or clicked "Edit camp details" from the rail preview (shortlistCampId).
    if (drawerEntryId) {
      const e = entries.find((x) => x.id === drawerEntryId);
      if (!e) return null;
      const uc = userCamps.find((u) => u.activity.id === e.session.activity.id);
      const primaryLoc = uc?.activity.activity_locations?.[0] ?? null;
      return {
        userCampId: uc?.id ?? "",
        activityId: e.session.activity.id,
        activityName: e.session.activity.name,
        activitySlug: e.session.activity.slug,
        source: uc?.activity.source ?? "user",
        orgId: uc?.activity.organization_id ?? null,
        activityUrl: uc?.activity.registration_url ?? null,
        activityDescription: uc?.activity.description ?? null,
        ageMin: uc?.activity.age_min ?? null,
        ageMax: uc?.activity.age_max ?? null,
        categories: uc?.activity.categories ?? [],
        orgName: uc?.activity.organization?.name ?? null,
        verified: uc?.activity.verified ?? false,
        locationName: primaryLoc?.location_name ?? null,
        address: primaryLoc?.address ?? null,
        scrapedPrices: uc?.activity.price_options ?? [],
        scrapedSessions: uc?.activity.sessions ?? [],
        placed: {
          id: e.id,
          childId: e.child_id,
          weekStart: new Date(e.session.starts_at + "T00:00:00"),
          status: e.status,
          sessionPart: e.session_part,
          daysOfWeek: e.days_of_week,
          priceCents: e.price_cents,
          priceUnit: e.price_unit,
          extras: e.extras,
          notes: e.notes,
          kidsAlreadyPlacedIds: entries
            .filter(
              (x) =>
                x.session.activity.id === e.session.activity.id &&
                x.session.starts_at === e.session.starts_at,
            )
            .map((x) => x.child_id),
        },
      };
    }
    if (shortlistCampId) {
      const uc = userCamps.find((u) => u.id === shortlistCampId);
      if (!uc) return null;
      const primaryLoc = uc.activity.activity_locations?.[0] ?? null;
      return {
        userCampId: uc.id,
        activityId: uc.activity.id,
        activityName: uc.activity.name,
        activitySlug: uc.activity.slug,
        source: uc.activity.source,
        orgId: uc.activity.organization_id ?? null,
        activityUrl: uc.activity.registration_url ?? null,
        activityDescription: uc.activity.description ?? null,
        ageMin: uc.activity.age_min ?? null,
        ageMax: uc.activity.age_max ?? null,
        categories: uc.activity.categories ?? [],
        orgName: uc.activity.organization?.name ?? null,
        verified: uc.activity.verified ?? false,
        locationName: primaryLoc?.location_name ?? null,
        address: primaryLoc?.address ?? null,
        scrapedPrices: uc.activity.price_options ?? [],
        scrapedSessions: uc.activity.sessions ?? [],
        placed: null,
      };
    }
    return null;
  }, [drawerEntryId, shortlistCampId, entries, userCamps]);

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
                  <p className="text-ink-2">
                    {kids.length} kid{kids.length === 1 ? "" : "s"} · {weekStarts.length} weeks
                    {committedCents > 0 && (
                      <>
                        {" · "}
                        <span className="relative inline-block group align-baseline">
                          <span className="text-ink font-semibold cursor-help border-b border-dotted border-ink">
                            ${Math.round(committedCents / 100).toLocaleString()} spent
                          </span>
                          <span
                            className="pointer-events-none absolute left-full top-0 ml-2 whitespace-nowrap text-ink-2 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"
                            aria-hidden
                          >
                            —{" "}
                            {kids.map((kid, i) => {
                              const cents = spentByKid.get(kid.id) ?? 0;
                              return (
                                <span key={kid.id}>
                                  {i > 0 ? " · " : ""}
                                  <span className="text-ink font-semibold">{kid.name}</span>{" "}
                                  ${Math.round(cents / 100).toLocaleString()}
                                </span>
                              );
                            })}
                          </span>
                        </span>
                      </>
                    )}
                  </p>
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
                    onClick={() => setShareOpen(true)}
                    className="font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-surface text-ink hover:bg-base border border-ink"
                  >
                    Share
                  </button>
                  <button
                    onClick={() => setEntryModal({ childId: null, weekStart: null, tab: "camp" })}
                    className="font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-ink text-ink-inverse hover:bg-[#333] border border-ink"
                  >
                    + Add
                  </button>
                </div>
              </header>

              <div ref={plannerGridRef} className="border-y-[1.5px] border-ink-3 pt-5 pb-4 flex-1 min-h-0 flex flex-col">
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
            if (result.url && result.jobId) {
              // URL flow: open the scrape-confirm drawer and let it poll. Skip
              // setting activeJobId so we don't double-poll.
              const kid = result.url && entryModal?.childId
                ? kids.find((k) => k.id === entryModal.childId)
                : null;
              const weekLabel = entryModal?.weekStart
                ? `Week of ${formatWeekRange(new Date(entryModal.weekStart + "T00:00:00"))}`
                : null;
              const scopeLabel = kid && weekLabel
                ? `${kid.name} · ${weekLabel}`
                : kid
                ? kid.name
                : weekLabel;
              setScrapeDrawer({ jobId: result.jobId, userCampId: result.userCampId ?? null, url: result.url, scopeLabel });
            } else if (result.jobId) {
              setActiveJobId(result.jobId);
            }
            setEntryModal(null);
            router.refresh();
          }}
          onBlockSubmitted={() => {
            setEntryModal(null);
            router.refresh();
          }}
        />

        <CampDetailDrawer
          open={drawerEntryId !== null || shortlistCampId !== null}
          onClose={() => {
            setDrawerEntryId(null);
            setShortlistCampId(null);
          }}
          entry={drawerEntry}
          kids={kids}
          onChanged={() => router.refresh()}
        />
        <CampPreviewModal
          camp={previewCamp}
          summary={previewSummary}
          onClose={() => setQuickViewCampId(null)}
          onEdit={() => {
            if (previewCamp) setShortlistCampId(previewCamp.id);
            setQuickViewCampId(null);
          }}
        />
        <BlockDetailDrawer
          open={drawerBlockId !== null}
          onClose={() => setDrawerBlockId(null)}
          block={drawerBlock}
          kids={kids}
          onChanged={() => router.refresh()}
        />
        <ScrapeConfirmDrawer
          open={scrapeDrawer !== null}
          jobId={scrapeDrawer?.jobId ?? null}
          userCampId={scrapeDrawer?.userCampId ?? null}
          inputUrl={scrapeDrawer?.url ?? ""}
          scopeLabel={scrapeDrawer?.scopeLabel ?? null}
          onClose={() => setScrapeDrawer(null)}
        />
        <SharePlannerModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          plannerId={planner.id}
          plannerName={planner.name}
          kids={kids.map((k, i) => ({
            id: k.id,
            name: k.name,
            avatar_url: k.avatar_url,
            index: i,
          }))}
          plannerElementRef={plannerGridRef}
        />

        {pendingAssignment && (
          <StatusPickerPopover
            anchor={pendingAssignment.anchor}
            campName={pendingAssignment.name}
            campColor={pendingAssignment.color}
            onChoose={handleStatusChoice}
            onCancel={() => setPendingAssignment(null)}
          />
        )}
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
