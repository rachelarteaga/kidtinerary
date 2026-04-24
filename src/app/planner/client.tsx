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
import { MyActivitiesRail } from "@/components/planner/my-activities-rail";
import { AddEntryModal } from "@/components/planner/add-entry-modal";
import { ActivityDetailDrawer } from "@/components/planner/activity-detail-drawer";
import { BlockDetailDrawer } from "@/components/planner/block-detail-drawer";
import { PlannerRangePicker } from "@/components/planner/planner-range-picker";
import { PlannerTitle } from "@/components/planner/planner-title";
import { StatusPickerPopover, type StatusPickerAnchor } from "@/components/planner/status-picker-popover";
import { ScrapeConfirmDrawer } from "@/components/planner/scrape-confirm-drawer";
import { ActivityPreviewModal, type PreviewSummary } from "@/components/planner/activity-preview-modal";
import { SharePlannerModal } from "@/components/planner/share-planner-modal";
import type { EntryRow as SharedEntryRow } from "@/components/planner/shared-planner-view";
import { useScrapeJob } from "@/lib/use-scrape-job";
import { useToast } from "@/components/ui/toast";
import {
  reorderKidColumns,
  assignActivityToWeek,
  removeKidFromPlanner,
  revokePlannerShareByPlanner,
  deletePlanner,
} from "@/lib/actions";
import { generateWeeks, getWeekKey, formatWeekRange } from "@/lib/format";
import { extrasTotalCents } from "@/lib/extras-calc";
import type { PlannerEntryRow, UserActivityWithDetails, PlannerBlockWithKids } from "@/lib/queries";
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
  userActivities: UserActivityWithDetails[];
  blocks: PlannerBlockWithKids[];
  shareCampsDefault: boolean;
  planner: PlannerRow;
  sharesActiveCount: number;
  ownerDisplayName: string | null;
}

export function PlannerClient({ kids, allUserKids, entries, userActivities, blocks, shareCampsDefault, planner, sharesActiveCount, ownerDisplayName }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const isShared = sharesActiveCount > 0;
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUnsharing, setIsUnsharing] = useState(false);

  const [entryModal, setEntryModal] = useState<{ childId: string | null; weekStart: string | null; tab: "activity" | "block" } | null>(null);
  const [drawerEntryId, setDrawerEntryId] = useState<string | null>(null);
  const [shortlistActivityId, setShortlistActivityId] = useState<string | null>(null);
  const [drawerBlockId, setDrawerBlockId] = useState<string | null>(null);
  const [quickViewActivityId, setQuickViewActivityId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [scrapeDrawer, setScrapeDrawer] = useState<{ jobId: string; userCampId: string | null; url: string; scopeLabel: string | null } | null>(null);
  const [draggingActivity, setDraggingActivity] = useState<{ name: string; color: string } | null>(null);
  const [placementActivity, setPlacementActivity] = useState<{ userCampId: string; name: string; color: string } | null>(null);
  const [mobileActivitiesOpen, setMobileActivitiesOpen] = useState(false);
  // Cells render their drop-zone overlay when either a desktop drag is in
  // flight or a mobile tap-to-place is armed.
  const isDraggingActivity = draggingActivity !== null || placementActivity !== null;
  const [pendingAssignment, setPendingAssignment] = useState<{
    userCampId: string;
    name: string;
    color: string;
    childId: string;
    weekStart: string;
    anchor: StatusPickerAnchor;
    fromPlacement?: boolean;
  } | null>(null);
  const [viewMode, setViewMode] = useState<"detail" | "simple">("detail");
  const [spentBreakdownOpen, setSpentBreakdownOpen] = useState(false);
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
    if (data?.type === "activity") {
      setDraggingActivity({ name: String(data.name ?? ""), color: String(data.color ?? "#f4b76f") });
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const dragged = draggingActivity;
      setDraggingActivity(null);
      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current as { type?: string; userCampId?: string; name?: string; color?: string } | undefined;
      const overData = over.data.current as { type?: string; childId?: string; weekStart?: string } | undefined;

      if (activeData?.type === "activity" && overData?.type === "cell-drop" && overData.childId && overData.weekStart) {
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
    [draggingActivity, orderedIds, planner.id]
  );

  const handleStatusChoice = useCallback(
    async (status: PlannerEntryStatus) => {
      if (!pendingAssignment) return;
      const { userCampId, childId, weekStart, fromPlacement } = pendingAssignment;
      setPendingAssignment(null);
      const result = await assignActivityToWeek(planner.id, userCampId, childId, weekStart, status);
      if (result.error) {
        alert(result.error);
        return;
      }
      router.refresh();
      // Mobile tap-to-place only: scroll the placed cell into view + flash it
      // so the user sees where it landed. On desktop drops, the drop target
      // is already exactly where the user released — scrolling would be
      // disruptive.
      if (fromPlacement) {
        requestAnimationFrame(() => {
          const el = document.querySelector(`[data-cell-id="${childId}-${weekStart}"]`) as HTMLElement | null;
          if (!el) return;
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-hero-light", "ring-offset-2", "rounded-lg");
          window.setTimeout(() => {
            el.classList.remove("ring-2", "ring-hero-light", "ring-offset-2", "rounded-lg");
          }, 1100);
        });
      }
    },
    [pendingAssignment, planner.id, router]
  );

  // Mobile tap-to-place: the bottom sheet hands us an activity, then the user
  // taps a cell. We synthesize the same pendingAssignment shape drag-drop
  // produces, and the existing status-picker popover takes over.
  const handleActivityPlacementTap = useCallback((activity: UserActivityWithDetails) => {
    setPlacementActivity({ userCampId: activity.id, name: activity.activity.name, color: activity.color });
    setMobileActivitiesOpen(false);
  }, []);

  const handleActivityPickFromModal = useCallback(
    async (userCampId: string) => {
      const childId = entryModal?.childId;
      const weekStart = entryModal?.weekStart;
      if (!childId || !weekStart) return;
      setEntryModal(null);
      const result = await assignActivityToWeek(planner.id, userCampId, childId, weekStart);
      if (result.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    },
    [entryModal, planner.id, router]
  );

  const handlePlacementCellTap = useCallback(
    (childId: string, weekStart: string) => {
      if (!placementActivity) return;
      const el = document.querySelector(`[data-cell-id="${childId}-${weekStart}"]`) as HTMLElement | null;
      const r = el?.getBoundingClientRect();
      setPendingAssignment({
        userCampId: placementActivity.userCampId,
        name: placementActivity.name,
        color: placementActivity.color,
        childId,
        weekStart,
        anchor: r
          ? { top: r.top, left: r.left, width: r.width, height: r.height }
          : { top: 0, left: 0, width: 0, height: 0 },
        fromPlacement: true,
      });
      setPlacementActivity(null);
    },
    [placementActivity]
  );

  const handleStopSharing = useCallback(async () => {
    setIsUnsharing(true);
    const result = await revokePlannerShareByPlanner(planner.id);
    setIsUnsharing(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    toast("Sharing stopped.", "success");
    router.refresh();
  }, [planner.id, router, toast]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    const result = await deletePlanner(planner.id);
    if (result.error) {
      setIsDeleting(false);
      toast(result.error, "error");
      return;
    }
    toast("Planner deleted.", "success");
    router.push("/planner");
  }, [planner.id, router, toast]);

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
    for (const uc of userActivities) m.set(uc.activity.id, uc.color);
    return m;
  }, [userActivities]);

  const colorByActivityIdRecord = useMemo(() => {
    const r: Record<string, string> = {};
    for (const uc of userActivities) r[uc.activity.id] = uc.color;
    return r;
  }, [userActivities]);

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

  const previewActivity = useMemo(
    () => (quickViewActivityId ? userActivities.find((c) => c.id === quickViewActivityId) ?? null : null),
    [quickViewActivityId, userActivities],
  );

  const previewSummary = useMemo<PreviewSummary | null>(() => {
    if (!previewActivity) return null;
    const activityId = previewActivity.activity.id;
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
  }, [previewActivity, entries]);

  const drawerEntry = useMemo(() => {
    // Two entry points: clicked a placed entry in a cell (drawerEntryId),
    // or clicked "Edit activity details" from the rail preview (shortlistActivityId).
    if (drawerEntryId) {
      const e = entries.find((x) => x.id === drawerEntryId);
      if (!e) return null;
      const uc = userActivities.find((u) => u.activity.id === e.session.activity.id);
      const primaryLoc = uc?.activity.activity_locations?.[0] ?? null;
      return {
        userCampId: uc?.id ?? "",
        activityId: e.session.activity.id,
        activityName: e.session.activity.name,
        activitySlug: e.session.activity.slug,
        source: uc?.activity.source ?? "user",
        sourceUrl: uc?.activity.source_url ?? null,
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
    if (shortlistActivityId) {
      const uc = userActivities.find((u) => u.id === shortlistActivityId);
      if (!uc) return null;
      const primaryLoc = uc.activity.activity_locations?.[0] ?? null;
      return {
        userCampId: uc.id,
        activityId: uc.activity.id,
        activityName: uc.activity.name,
        activitySlug: uc.activity.slug,
        source: uc.activity.source,
        sourceUrl: uc.activity.source_url ?? null,
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
  }, [drawerEntryId, shortlistActivityId, entries, userActivities]);

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
        {placementActivity && (
          <div
            role="status"
            aria-live="polite"
            className="md:hidden sticky top-[73px] z-20 flex items-center justify-between gap-3 px-4 py-3 bg-ink text-ink-inverse"
          >
            <div className="min-w-0 flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: placementActivity.color }}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="font-sans text-[10px] uppercase tracking-widest opacity-75 leading-none">
                  Tap a week to place
                </p>
                <p className="font-display font-extrabold text-sm truncate mt-0.5">
                  {placementActivity.name}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPlacementActivity(null)}
              className="flex-shrink-0 font-sans font-bold text-[11px] uppercase tracking-widest px-3 min-h-[40px] rounded-full border border-white/40 hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        )}
        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          <MyActivitiesRail
            activities={userActivities}
            onChipClick={(c) => setQuickViewActivityId(c.id)}
            onAddClick={() => setEntryModal({ childId: null, weekStart: null, tab: "activity" })}
            onChanged={() => router.refresh()}
            onActivityPlacementTap={handleActivityPlacementTap}
            mobileOpen={mobileActivitiesOpen}
            onMobileOpenChange={setMobileActivitiesOpen}
          />

          <div className="flex-1 min-w-0 flex flex-col md:h-full md:overflow-hidden">
            <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex flex-col flex-1 min-h-0">
              <header className="bg-surface flex flex-col sm:flex-row sm:items-start sm:justify-between sm:flex-wrap gap-3 pt-[22px] pb-[18px] flex-shrink-0">
                <div className="min-w-0">
                  <div className="mb-1">
                    <PlannerTitle
                      plannerId={planner.id}
                      name={planner.name}
                      sharesActiveCount={sharesActiveCount}
                      onShareClick={() => setShareOpen(true)}
                    />
                  </div>
                  <p className="text-ink-2">
                    {kids.length} kid{kids.length === 1 ? "" : "s"} · {weekStarts.length} weeks
                    {committedCents > 0 && (
                      <>
                        {" · "}
                        <button
                          type="button"
                          onClick={() => setSpentBreakdownOpen((v) => !v)}
                          aria-expanded={spentBreakdownOpen}
                          className="text-ink font-semibold border-b border-dotted border-ink align-baseline cursor-pointer"
                        >
                          ${Math.round(committedCents / 100).toLocaleString()} spent
                        </button>
                      </>
                    )}
                  </p>
                  {committedCents > 0 && spentBreakdownOpen && (
                    <p className="text-ink-2 text-sm mt-1 leading-relaxed">
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
                    </p>
                  )}
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmOpen(true)}
                      className="font-sans text-xs text-ink-3 hover:text-[#c96164] cursor-pointer"
                    >
                      Delete planner
                    </button>
                  </div>
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
                    onClick={() => setEntryModal({ childId: null, weekStart: null, tab: "activity" })}
                    className="hidden sm:inline-flex font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-ink text-ink-inverse hover:bg-[#333] border border-ink items-center justify-center"
                  >
                    + Add
                  </button>
                </div>
              </header>

              <div className="border-y-[1.5px] border-ink-3 pt-5 pb-4 flex-1 min-h-0 flex flex-col">
                <PlannerMatrix
                  children={kids}
                  allUserKids={allUserKids}
                  plannerId={planner.id}
                  weeks={weeks}
                  orderedIds={orderedIds}
                  plannerStart={plannerStart}
                  plannerEnd={plannerEnd}
                  viewMode={viewMode}
                  isDraggingActivity={isDraggingActivity}
                  onPlacementTap={placementActivity ? handlePlacementCellTap : undefined}
                  onAddActivityClick={(childId, weekStart) => setEntryModal({ childId, weekStart, tab: "activity" })}
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
          plannerId={planner.id}
          scope={entryModal ?? { childId: null, weekStart: null }}
          shareCampsDefault={shareCampsDefault}
          kids={kids}
          userActivities={userActivities}
          initialTab={entryModal?.tab ?? "activity"}
          onActivityPick={handleActivityPickFromModal}
          onActivitySubmitted={(result) => {
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

        <ActivityDetailDrawer
          open={drawerEntryId !== null || shortlistActivityId !== null}
          onClose={() => {
            setDrawerEntryId(null);
            setShortlistActivityId(null);
          }}
          entry={drawerEntry}
          kids={kids}
          plannerId={planner.id}
          onChanged={() => router.refresh()}
        />
        <ActivityPreviewModal
          activity={previewActivity}
          summary={previewSummary}
          onClose={() => setQuickViewActivityId(null)}
          onEdit={() => {
            if (previewActivity) setShortlistActivityId(previewActivity.id);
            setQuickViewActivityId(null);
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
          plannerStart={planner.start_date}
          plannerEnd={planner.end_date}
          ownerDisplayName={ownerDisplayName}
          isShared={isShared}
          isUnsharing={isUnsharing}
          onStopSharing={async () => {
            await handleStopSharing();
            setShareOpen(false);
          }}
          kids={kids.map((k, i) => ({
            id: k.id,
            name: k.name,
            avatar_url: k.avatar_url,
            index: i,
          }))}
          sharedKids={kids.map((k) => ({
            id: k.id,
            name: k.name,
            birth_date: k.birth_date,
            avatar_url: k.avatar_url,
            color: k.color,
          }))}
          sharedEntries={entries as unknown as SharedEntryRow[]}
          sharedBlocks={blocks.map((b) => ({
            id: b.id,
            type: b.type,
            title: b.title,
            start_date: b.start_date,
            end_date: b.end_date,
            kid_ids: b.child_ids,
          }))}
          colorByActivityId={colorByActivityIdRecord}
        />

        {deleteConfirmOpen && (
          <DeletePlannerConfirm
            plannerName={planner.name}
            isDeleting={isDeleting}
            onCancel={() => setDeleteConfirmOpen(false)}
            onConfirm={handleDelete}
          />
        )}

        {pendingAssignment && (
          <StatusPickerPopover
            anchor={pendingAssignment.anchor}
            activityName={pendingAssignment.name}
            onChoose={handleStatusChoice}
            onCancel={() => setPendingAssignment(null)}
          />
        )}
      </main>

      <DragOverlay dropAnimation={null}>
        {draggingActivity ? (
          <div className="rounded-lg border border-ink bg-surface shadow-[3px_3px_0_0_rgba(0,0,0,0.15)] p-2.5 w-56 rotate-2 pointer-events-none" style={{ borderColor: draggingActivity.color }}>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: draggingActivity.color }} />
              <div className="font-medium text-sm text-ink truncate">{draggingActivity.name}</div>
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

function DeletePlannerConfirm({
  plannerName,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  plannerName: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-surface rounded-2xl max-w-sm w-full border border-ink-3 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display font-extrabold text-xl text-ink mb-2">
          Delete &quot;{plannerName}&quot;?
        </h3>
        <p className="font-sans text-sm text-ink-2 leading-relaxed mb-4">
          This removes the planner and every activity placement, block, kid assignment, and
          share link on it. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="font-sans font-semibold text-[11px] uppercase tracking-widest px-3 py-1.5 text-ink-2 hover:text-ink disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full bg-[#ef8c8f] text-ink border border-ink hover:brightness-95 disabled:opacity-50"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
