"use client";

import { useEffect, useMemo, useState } from "react";
import { KidAvatar } from "./kid-avatar";
import { KidColumnHeader } from "./kid-column-header";
import { SharedActivityDetailPanel } from "./shared-activity-detail-panel";
import { CellTimelineGrid, type TimelineEntry } from "./cell-timeline-grid";
import { BlockIcon } from "./block-icon";
import { ConsideringChips, type ConsideringChip } from "./considering-chips";
import { applyShareFilters } from "@/lib/share/apply-filters";
import { generateWeeks, getWeekKey, formatWeekLabelCompact } from "@/lib/format";
import type { DayOfWeek, PlannerBlockType, PlannerEntryStatus, SessionPart } from "@/lib/supabase/types";

// Status pill colors match globals.css tokens
const STATUS_STYLE: Record<string, string> = {
  considering: "bg-status-considering",
  waitlisted: "bg-status-waitlisted",
  registered: "bg-status-registered",
};

export interface KidRow {
  id: string;
  name: string;
  birth_date: string;
  avatar_url: string | null;
  color: string;
}

export interface EntryRow {
  id: string;
  child_id: string;
  status: string;
  sort_order: number;
  notes: string | null;
  price_cents: number | null;
  price_unit: string | null;
  session_part: string | null;
  days_of_week: string[] | null;
  session: {
    id: string;
    starts_at: string;
    ends_at: string;
    activity: {
      id: string;
      name: string;
      registration_url: string | null;
      description: string | null;
      organization: { id: string; name: string } | null;
      activity_locations: { id: string; address: string; location_name: string | null }[];
    };
  };
}

export interface BlockRow {
  id: string;
  type: string;
  title: string;
  start_date: string;
  end_date: string;
  kid_ids: string[];
}

interface Props {
  token: string;
  plannerName: string;
  plannerStart: string;
  plannerEnd: string;
  ownerDisplayName: string | null;
  kids: KidRow[];
  entries: EntryRow[];
  blocks: BlockRow[];
  filters: { kidIds: string[]; includeCost: boolean; includePersonalBlockDetails: boolean };
  colorByActivityId: Record<string, string>;
  forceViewMode?: "detail" | "simple";
}

function ageYears(birthDate: string): number {
  const ms = Date.now() - new Date(birthDate).getTime();
  return Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
}

export function SharedPlannerView({
  token,
  plannerName,
  plannerStart,
  plannerEnd,
  ownerDisplayName,
  kids,
  entries,
  blocks,
  filters,
  colorByActivityId,
  forceViewMode,
}: Props) {
  // Apply owner's share filters (kid filter, cost mask, personal-block title mask).
  // Project raw rows into the minimal shape applyShareFilters needs, then reuse the
  // resulting id-subsets to filter the rich arrays.
  const filteredIdSets = useMemo(() => {
    const projected = applyShareFilters(
      {
        kids: kids.map((k) => ({
          id: k.id, name: k.name, avatar_url: k.avatar_url, birth_date: k.birth_date, color: k.color,
        })),
        entries: entries.map((e) => ({
          id: e.id, child_id: e.child_id, activity_name: e.session.activity.name,
          price_weekly_cents: e.price_cents,
        })),
        blocks: blocks.map((b) => ({
          id: b.id, child_id: b.kid_ids[0] ?? "", type: b.type, title: b.title,
        })),
      },
      filters
    );
    return {
      kidIds: new Set(projected.kids.map((k) => k.id)),
      entryIds: new Set(projected.entries.map((e) => e.id)),
      blockIds: new Set(projected.blocks.map((b) => b.id)),
    };
  }, [kids, entries, blocks, filters]);

  const visibleKids = kids.filter((k) => filteredIdSets.kidIds.has(k.id));
  const visibleEntries = entries.filter((e) => filteredIdSets.entryIds.has(e.id));
  const visibleBlocks = blocks
    .filter((b) => filteredIdSets.blockIds.has(b.id))
    .map((b) => ({ ...b, title: filters.includePersonalBlockDetails ? b.title : "" }));

  const [viewMode, setViewMode] = useState<"detail" | "simple">(() => forceViewMode ?? "detail");
  const storageKey = `share-view-mode:${token}`;
  useEffect(() => {
    if (forceViewMode) return;
    const saved = window.localStorage.getItem(storageKey);
    if (saved === "detail" || saved === "simple") setViewMode(saved);
  }, [storageKey, forceViewMode]);
  function setMode(m: "detail" | "simple") {
    setViewMode(m);
    window.localStorage.setItem(storageKey, m);
  }

  const [openActivityEntryId, setOpenActivityEntryId] = useState<string | null>(null);
  const openActivity = useMemo(() => {
    if (!openActivityEntryId) return null;
    const e = visibleEntries.find((x) => x.id === openActivityEntryId);
    if (!e) return null;
    const loc = e.session.activity.activity_locations[0];
    return {
      entryId: e.id,
      org: e.session.activity.organization?.name ?? "",
      name: e.session.activity.name,
      location: loc ? `${loc.location_name ? loc.location_name + "\n" : ""}${loc.address}` : "",
      url: e.session.activity.registration_url,
      about: e.session.activity.description ?? "",
      weeklyCostCents: filters.includeCost ? e.price_cents : null,
    };
  }, [openActivityEntryId, visibleEntries, filters.includeCost]);

  const weekStartDates = useMemo(() => {
    const from = new Date(plannerStart + "T00:00:00");
    const to = new Date(plannerEnd + "T00:00:00");
    return generateWeeks(from, to);
  }, [plannerStart, plannerEnd]);

  const plannerStartDate = useMemo(() => new Date(plannerStart + "T00:00:00"), [plannerStart]);
  const plannerEndDate = useMemo(() => new Date(plannerEnd + "T00:00:00"), [plannerEnd]);

  function buildTimelineEntries(cellEntries: EntryRow[]): TimelineEntry[] {
    return cellEntries
      .filter((e) => e.status !== "considering" && e.session_part && e.days_of_week)
      .map((e) => ({
        id: e.id,
        color: colorByActivityId[e.session.activity.id] ?? "#f4b76f",
        status: e.status as PlannerEntryStatus,
        sessionPart: e.session_part as SessionPart,
        daysOfWeek: (e.days_of_week ?? []) as DayOfWeek[],
      }));
  }

  // Build per-kid per-week legend rows (camps) + block detection.
  const rowsByWeek = useMemo(() => {
    return weekStartDates.map((weekStart) => {
      const weekKey = getWeekKey(weekStart);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const cellsByKid: Record<string, { entries: EntryRow[] }> = {};
      for (const k of visibleKids) cellsByKid[k.id] = { entries: [] };

      for (const e of visibleEntries) {
        const ws = new Date(e.session.starts_at + "T00:00:00");
        if (getWeekKey(ws) !== weekKey) continue;
        if (!cellsByKid[e.child_id]) continue;
        cellsByKid[e.child_id].entries.push(e);
      }

      // Blocks overlapping this week
      const overlappingBlocks = visibleBlocks.filter(
        (b) => new Date(b.start_date) <= weekEnd && new Date(b.end_date) >= weekStart
      );
      const blockByKid: Record<string, BlockRow | undefined> = {};
      for (const b of overlappingBlocks) {
        for (const kidId of b.kid_ids) {
          if (filteredIdSets.kidIds.has(kidId)) blockByKid[kidId] = b;
        }
      }

      return { weekStart, weekKey, cellsByKid, blockByKid };
    });
  }, [weekStartDates, visibleKids, visibleEntries, visibleBlocks, filteredIdSets.kidIds]);

  const cols = visibleKids.length;
  const gridTemplate = `140px ${"1fr ".repeat(cols).trim()}`;

  // Narrow-screen fallback: one-kid-at-a-time with a pill selector, mirroring
  // the owner's PlannerMatrix. Engages below the same 768px breakpoint.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setNarrow(mq.matches);
    const handler = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const [focusedKidId, setFocusedKidId] = useState<string>("");
  useEffect(() => {
    if (visibleKids.length === 0) return;
    if (!visibleKids.some((k) => k.id === focusedKidId)) {
      setFocusedKidId(visibleKids[0].id);
    }
  }, [visibleKids, focusedKidId]);

  const useNarrowLayout = narrow && visibleKids.length > 1;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between sm:flex-wrap gap-3 sm:gap-4">
        <div className="min-w-0">
          <p className="font-sans text-[10px] uppercase tracking-widest text-ink-2 font-semibold">Shared · view-only</p>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl mt-1">
            {plannerName}
          </h1>
          {ownerDisplayName && (
            <p className="font-sans text-ink-2 font-medium text-sm sm:text-base mt-1">
              {ownerDisplayName}&apos;s planner
            </p>
          )}
          <p className="text-ink-2 text-sm mt-1">
            {visibleKids.length} kid{visibleKids.length === 1 ? "" : "s"}
          </p>
        </div>
        {!forceViewMode && (
          <div className="self-start inline-flex rounded-full border border-ink bg-surface overflow-hidden">
            <button
              type="button"
              onClick={() => setMode("detail")}
              className={`font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-2 transition-colors ${
                viewMode === "detail" ? "bg-ink text-ink-inverse" : "text-ink-2 hover:text-ink"
              }`}
            >
              Detail
            </button>
            <button
              type="button"
              onClick={() => setMode("simple")}
              className={`font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-2 transition-colors ${
                viewMode === "simple" ? "bg-ink text-ink-inverse" : "text-ink-2 hover:text-ink"
              }`}
            >
              Simple
            </button>
          </div>
        )}
      </header>

      {visibleKids.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-3 bg-surface/30 p-8 text-center">
          <p className="font-display font-extrabold text-xl text-ink">Nothing to show</p>
          <p className="text-ink-2 text-sm mt-1">The share link doesn&apos;t include any kids.</p>
        </div>
      ) : useNarrowLayout ? (
        <div>
          <div className="flex gap-2 overflow-x-auto pb-1 items-stretch mb-4">
            {visibleKids.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFocusedKidId(c.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm flex items-center gap-2 ${c.id === focusedKidId ? "bg-white border-ink" : "bg-white opacity-60 border-ink-3"}`}
              >
                <KidAvatar name={c.name} index={i} avatarUrl={c.avatar_url} size={22} />
                {c.name}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {rowsByWeek.map((row) => {
              const weekLabel = formatWeekLabelCompact(row.weekStart);
              return (
                <div key={row.weekKey}>
                  <div className="font-sans text-[11px] font-bold uppercase tracking-widest text-ink-2 mb-1 whitespace-nowrap">
                    {weekLabel}
                  </div>
                  {renderSharedCell({
                    kidId: focusedKidId,
                    row,
                    viewMode,
                    colorByActivityId,
                    includeCost: filters.includeCost,
                    plannerStartDate,
                    plannerEndDate,
                    buildTimelineEntries,
                    onOpenActivity: (id) => setOpenActivityEntryId(id),
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <div className="grid gap-2 mb-[14px]" style={{ gridTemplateColumns: gridTemplate }}>
            <div />
            {visibleKids.map((c, i) => (
              <KidColumnHeader
                key={c.id}
                child={{ id: c.id, name: c.name, birth_date: c.birth_date, color: c.color, avatar_url: c.avatar_url }}
                index={i}
                ageYears={ageYears(c.birth_date)}
                readOnly
              />
            ))}
          </div>

          <div className="space-y-2">
            {rowsByWeek.map((row) => {
              const weekLabel = formatWeekLabelCompact(row.weekStart);
              return (
                <div key={row.weekKey} className="grid gap-2" style={{ gridTemplateColumns: gridTemplate }}>
                  <div className="font-sans text-[11px] font-bold uppercase tracking-widest text-ink-2 self-stretch flex items-center pl-1.5 pr-3 border-r border-ink-3 whitespace-nowrap text-left">
                    {weekLabel}
                  </div>
                  {visibleKids.map((kid) =>
                    renderSharedCell({
                      kidId: kid.id,
                      row,
                      viewMode,
                      colorByActivityId,
                      includeCost: filters.includeCost,
                      plannerStartDate,
                      plannerEndDate,
                      buildTimelineEntries,
                      onOpenActivity: (id) => setOpenActivityEntryId(id),
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <SharedActivityDetailPanel
        open={openActivityEntryId !== null && openActivity !== null}
        onClose={() => setOpenActivityEntryId(null)}
        camp={openActivity ?? { org: "", name: "", location: "", url: null, about: "" }}
      />
    </main>
  );
}

interface SharedCellRow {
  weekStart: Date;
  weekKey: string;
  cellsByKid: Record<string, { entries: EntryRow[] }>;
  blockByKid: Record<string, BlockRow | undefined>;
}

function renderSharedCell({
  kidId,
  row,
  viewMode,
  colorByActivityId,
  includeCost,
  plannerStartDate,
  plannerEndDate,
  buildTimelineEntries,
  onOpenActivity,
}: {
  kidId: string;
  row: SharedCellRow;
  viewMode: "detail" | "simple";
  colorByActivityId: Record<string, string>;
  includeCost: boolean;
  plannerStartDate: Date;
  plannerEndDate: Date;
  buildTimelineEntries: (entries: EntryRow[]) => TimelineEntry[];
  onOpenActivity: (entryId: string) => void;
}) {
  const block = row.blockByKid[kidId];
  const cellEntries = row.cellsByKid[kidId]?.entries ?? [];
  const hasUnmaskedBlockTitle = !!(block && block.title?.trim());
  const cellIsEmpty = !block && cellEntries.length === 0;
  const compact = viewMode === "simple";
  const key = `${row.weekKey}-${kidId}`;

  if (cellIsEmpty || (block && !hasUnmaskedBlockTitle)) {
    return (
      <div
        key={key}
        className={`rounded-lg border border-ink-3 flex items-center justify-center text-center ${compact ? "px-2 py-1.5" : "p-3 min-h-[60px]"}`}
        style={{
          backgroundImage: "radial-gradient(rgba(21,21,21,0.09) 0.7px, transparent 0.7px)",
          backgroundSize: "5px 5px",
          backgroundColor: "rgba(21,21,21,0.04)",
        }}
      >
        <span className={`font-sans uppercase tracking-[0.08em] text-ink-2 leading-tight ${compact ? "text-[10px]" : "text-[11px]"}`}>
          NOTHING SCHEDULED
        </span>
      </div>
    );
  }

  if (block && hasUnmaskedBlockTitle) {
    return (
      <div
        key={key}
        className={`rounded-lg border border-ink-3 flex items-center ${compact ? "gap-2 px-2 py-1.5" : "gap-3 p-3 min-h-[60px]"}`}
        style={{
          backgroundImage: "radial-gradient(rgba(21,21,21,0.09) 0.7px, transparent 0.7px)",
          backgroundSize: "5px 5px",
          backgroundColor: "rgba(21,21,21,0.04)",
        }}
      >
        <span className="shrink-0 leading-none">
          <BlockIcon type={block.type as PlannerBlockType} size={compact ? 14 : 20} />
        </span>
        <div className="flex-1 min-w-0">
          <div className={`font-sans font-bold text-ink truncate ${compact ? "text-xs" : "text-sm"}`}>
            {block.title}
          </div>
        </div>
      </div>
    );
  }

  const timelineEntries = buildTimelineEntries(cellEntries);
  const legendEntries = cellEntries.filter((e) => e.status !== "considering");
  const consideringChips: ConsideringChip[] = cellEntries
    .filter((e) => e.status === "considering")
    .map((e) => ({
      entryId: e.id,
      activityName: e.session.activity.name,
      color: colorByActivityId[e.session.activity.id] ?? "#f4b76f",
      isOvernight: e.session_part === "overnight",
    }));

  return (
    <div key={key} className="rounded-lg border border-ink-3 bg-surface p-2 min-h-[60px]">
      {viewMode === "detail" && timelineEntries.length > 0 && (
        <div className="mb-2">
          <CellTimelineGrid
            entries={timelineEntries}
            weekStart={row.weekStart}
            plannerStart={plannerStartDate}
            plannerEnd={plannerEndDate}
          />
        </div>
      )}
      {legendEntries.length > 0 && (
        <div className="space-y-1">
          {legendEntries.map((e) => {
            const activityId = e.session.activity.id;
            const color = colorByActivityId[activityId] ?? "#f4b76f";
            const orgName = e.session.activity.organization?.name ?? null;
            const showOrg = !!orgName && orgName !== e.session.activity.name && viewMode === "detail";
            const priceLabel = includeCost && e.price_cents != null ? `$${Math.round(e.price_cents / 100)}` : null;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => onOpenActivity(e.id)}
                className="w-full flex items-start gap-1.5 text-left text-xs text-ink hover:underline cursor-pointer"
              >
                <span className="w-2 h-2 mt-1 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="flex-1 min-w-0">
                  <span className="truncate block">{e.session.activity.name}</span>
                  {showOrg && (
                    <span className="block truncate font-sans text-[10px] text-ink-2 leading-tight">
                      {orgName}
                    </span>
                  )}
                </span>
                {priceLabel && (
                  <span className="font-sans text-[10px] font-semibold text-ink-2 flex-shrink-0 mt-0.5 py-0.5 border border-transparent leading-none">
                    {priceLabel}
                  </span>
                )}
                <span
                  className={`font-sans font-semibold text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full border border-ink flex-shrink-0 mt-0.5 ${STATUS_STYLE[e.status] ?? ""}`}
                >
                  {e.status}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <ConsideringChips
        chips={consideringChips}
        onChipClick={onOpenActivity}
      />
    </div>
  );
}
