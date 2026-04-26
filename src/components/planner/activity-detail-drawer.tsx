"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { StatusDropdown } from "./status-dropdown";
import { StateBadge } from "./state-badge";
import { ScheduleEditor } from "./schedule-editor";
import { ExtrasEditor } from "./extras-editor";
import { KidAvatar } from "./kid-avatar";
import {
  updateEntrySchedule,
  updateEntryPrice,
  updateEntryExtras,
  updateEntryNotes,
  updatePlannerEntryStatus,
  removePlannerEntry,
  assignActivityToWeek,
  updateActivityFields,
  removeActivityFromShortlist,
} from "@/lib/actions";
import { extrasTotalCents } from "@/lib/extras-calc";
import { formatWeekRange } from "@/lib/format";
import { CATEGORIES } from "@/lib/constants";
import type {
  PlannerEntryStatus,
  SessionPart,
  DayOfWeek,
  ExtraItem,
  PriceUnit,
} from "@/lib/supabase/types";
import type { UserActivityWithDetails } from "@/lib/queries";

function PencilIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  sports: "Sports",
  arts: "Arts",
  stem: "STEM",
  nature: "Nature",
  music: "Music",
  theater: "Theater",
  academic: "Academic",
  special_needs: "Special needs",
  religious: "Religious",
  swimming: "Swimming",
  cooking: "Cooking",
  language: "Language",
};

interface Kid {
  id: string;
  name: string;
  color: string;
  avatar_url: string | null;
}

interface PlacedFields {
  id: string;
  childId: string;
  weekStart: Date;
  status: PlannerEntryStatus;
  sessionPart: SessionPart;
  daysOfWeek: DayOfWeek[];
  priceCents: number | null;
  priceUnit: PriceUnit | null;
  extras: ExtraItem[];
  notes: string | null;
  /** Kid IDs that already have this activity placed on this same week — used to hide them from "Also add for". */
  kidsAlreadyPlacedIds: string[];
}

interface ScrapedPrice {
  id: string;
  label: string;
  price_cents: number;
  price_unit: string;
}

interface ScrapedSession {
  id: string;
  starts_at: string;
  ends_at: string;
  time_slot: string;
}

interface DrawerEntry {
  userCampId: string;
  activityId: string;
  orgId: string | null;
  source: "user" | "curated";
  sourceUrl: string | null;
  /** ISO timestamp from `user_activities.created_at`. Null only when the row could
   * not be matched (defensive — should always be present in normal flows). */
  addedAt: string | null;
  activityName: string;
  activitySlug: string;
  activityUrl: string | null;
  activityDescription: string | null;
  ageMin: number | null;
  ageMax: number | null;
  categories: string[];
  orgName: string | null;
  verified: boolean;
  locationName: string | null;
  address: string | null;
  scrapedPrices: ScrapedPrice[];
  scrapedSessions: ScrapedSession[];
  /** Null when the activity is in the shortlist but not placed on a week/kid yet. */
  placed: PlacedFields | null;
}

interface PlannerModeProps {
  mode?: "planner";
  open: boolean;
  onClose: () => void;
  entry: DrawerEntry | null;
  kids: Kid[];
  plannerId: string;
  onChanged: () => void;
  catalogActivity?: never;
}

interface CatalogModeProps {
  mode: "catalog";
  open: boolean;
  onClose: () => void;
  catalogActivity: UserActivityWithDetails;
  /** Unused in catalog mode — pass [] or omit (required by JS, typed as optional via never trick) */
  entry?: never;
  kids?: never;
  plannerId?: never;
  onChanged?: never;
}

type Props = PlannerModeProps | CatalogModeProps;

export function ActivityDetailDrawer(props: Props) {
  const { mode = "planner", open, onClose } = props;
  // Planner-mode props (undefined in catalog mode)
  const plannerEntry = props.mode !== "catalog" ? props.entry : null;
  const kids = props.mode !== "catalog" ? props.kids : [];
  const plannerId = props.mode !== "catalog" ? props.plannerId : "";
  const onChanged = props.mode !== "catalog" ? props.onChanged : (() => {});
  const catalogActivity = props.mode === "catalog" ? props.catalogActivity : null;
  const plannerPlacements = props.mode === "catalog" ? props.catalogActivity.plannerPlacements : [];

  // Track previous plannerEntry so we can reset local state when it changes
  // without calling setState inside a useEffect (which triggers lint warnings).
  const [local, setLocal] = useState<DrawerEntry | null>(plannerEntry ?? null);
  const [prevPlannerEntry, setPrevPlannerEntry] = useState(plannerEntry);
  if (mode !== "catalog" && plannerEntry !== prevPlannerEntry) {
    setPrevPlannerEntry(plannerEntry);
    setLocal(plannerEntry ?? null);
  }

  const [isPending, startTransition] = useTransition();

  const [editingField, setEditingField] = useState<"name" | "org" | "url" | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftOrg, setDraftOrg] = useState("");
  const [draftUrl, setDraftUrl] = useState("");

  // Build a synthetic DrawerEntry from catalogActivity for catalog mode
  const catalogLocal: DrawerEntry | null = catalogActivity
    ? {
        userCampId: catalogActivity.id,
        activityId: catalogActivity.activity.id,
        orgId: catalogActivity.activity.organization_id,
        source: catalogActivity.activity.source,
        sourceUrl: catalogActivity.activity.source_url,
        addedAt: catalogActivity.created_at,
        activityName: catalogActivity.activity.name,
        activitySlug: catalogActivity.activity.slug,
        activityUrl: catalogActivity.activity.registration_url,
        activityDescription: catalogActivity.activity.description,
        ageMin: catalogActivity.activity.age_min,
        ageMax: catalogActivity.activity.age_max,
        categories: catalogActivity.activity.categories,
        orgName: catalogActivity.activity.organization?.name ?? null,
        verified: catalogActivity.activity.verified,
        locationName: catalogActivity.activity.activity_locations[0]?.location_name ?? null,
        address: catalogActivity.activity.activity_locations[0]?.address ?? null,
        scrapedPrices: catalogActivity.activity.price_options.map((p) => ({
          id: p.id,
          label: p.label,
          price_cents: p.price_cents,
          price_unit: p.price_unit,
        })),
        scrapedSessions: catalogActivity.activity.sessions.map((s) => ({
          id: s.id,
          starts_at: s.starts_at,
          ends_at: s.ends_at,
          time_slot: s.time_slot,
        })),
        placed: null,
      }
    : null;

  // In catalog mode, use catalogLocal; in planner mode use the local state
  const effectiveLocal: DrawerEntry | null = mode === "catalog" ? catalogLocal : local;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !editingField) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, editingField]);

  function startEdit(field: "name" | "org" | "url") {
    if (!effectiveLocal) return;
    if (effectiveLocal.source === "curated") return; // curated rows are read-only
    setDraftName(effectiveLocal.activityName);
    setDraftOrg(effectiveLocal.orgName ?? "");
    setDraftUrl(effectiveLocal.activityUrl ?? "");
    setEditingField(field);
  }

  async function commitEdit() {
    if (!effectiveLocal || !editingField) return;
    const field = editingField;
    setEditingField(null);
    const patch: { name?: string; orgName?: string; url?: string | null } = {};
    if (field === "name" && draftName !== effectiveLocal.activityName) {
      patch.name = draftName;
      if (mode !== "catalog") setLocal({ ...effectiveLocal, activityName: draftName });
    }
    if (field === "org" && draftOrg !== (effectiveLocal.orgName ?? "")) {
      patch.orgName = draftOrg;
      if (mode !== "catalog") setLocal({ ...effectiveLocal, orgName: draftOrg || null });
    }
    if (field === "url" && draftUrl !== (effectiveLocal.activityUrl ?? "")) {
      patch.url = draftUrl || null;
      if (mode !== "catalog") setLocal({ ...effectiveLocal, activityUrl: draftUrl || null });
    }
    if (Object.keys(patch).length === 0) return;
    startTransition(async () => {
      const r = await updateActivityFields({ activityId: effectiveLocal.activityId, ...patch });
      if (r.error) {
        alert(r.error);
      }
      onChanged();
    });
  }

  function cancelEdit() {
    setEditingField(null);
  }

  function removeUrl() {
    if (!effectiveLocal || effectiveLocal.source === "curated") return;
    if (mode !== "catalog") setLocal({ ...effectiveLocal, activityUrl: null });
    startTransition(async () => {
      const r = await updateActivityFields({ activityId: effectiveLocal.activityId, url: null });
      if (r.error) alert(r.error);
      onChanged();
    });
  }

  if (!open || !effectiveLocal) return null;

  // Use effectiveLocal as the single source of truth for render
  const local2 = effectiveLocal;
  const isCurated = local2.source === "curated";
  const kidName = local2.placed ? (kids ?? []).find((k) => k.id === local2.placed!.childId)?.name ?? "" : "";

  function persistSchedule(part: SessionPart, days: DayOfWeek[]) {
    if (!local || !local.placed) return;
    const placed = local.placed;
    setLocal({ ...local, placed: { ...placed, sessionPart: part, daysOfWeek: days } });
    startTransition(async () => {
      await updateEntrySchedule(placed.id, part, days);
      onChanged();
    });
  }

  function persistPrice(cents: number | null, unit: PriceUnit | null) {
    if (!local || !local.placed) return;
    const placed = local.placed;
    setLocal({ ...local, placed: { ...placed, priceCents: cents, priceUnit: unit } });
    startTransition(async () => {
      await updateEntryPrice(placed.id, cents, unit);
      onChanged();
    });
  }

  function persistExtras(extras: ExtraItem[]) {
    if (!local || !local.placed) return;
    const placed = local.placed;
    setLocal({ ...local, placed: { ...placed, extras } });
    startTransition(async () => {
      await updateEntryExtras(placed.id, extras);
      onChanged();
    });
  }

  function persistNotes(notes: string) {
    if (!local || !local.placed) return;
    const placed = local.placed;
    setLocal({ ...local, placed: { ...placed, notes } });
    startTransition(async () => {
      await updateEntryNotes(placed.id, notes);
      onChanged();
    });
  }

  function persistStatus(status: PlannerEntryStatus) {
    if (!local || !local.placed) return;
    const placed = local.placed;
    setLocal({ ...local, placed: { ...placed, status } });
    startTransition(async () => {
      await updatePlannerEntryStatus(placed.id, status);
      onChanged();
    });
  }

  function addForKid(otherKidId: string) {
    if (!local || !local.placed) return;
    const placed = local.placed;
    startTransition(async () => {
      await assignActivityToWeek(
        plannerId,
        local.userCampId,
        otherKidId,
        placed.weekStart.toISOString().split("T")[0],
        placed.status,
      );
      onChanged();
    });
  }

  async function handleRemove() {
    if (!local2) return;
    if (local2.placed) {
      if (!confirm("Remove this activity from this week?")) return;
      const placed = local2.placed;
      startTransition(async () => {
        await removePlannerEntry(placed.id);
        onChanged();
        onClose();
      });
    } else {
      if (!confirm("Delete this activity from your shortlist? This can't be undone.")) return;
      const userCampId = local2.userCampId;
      startTransition(async () => {
        const r = await removeActivityFromShortlist(userCampId);
        if (r.error) {
          alert(r.error);
          return;
        }
        onChanged();
        onClose();
      });
    }
  }

  const daysPerWeek = local2.placed?.daysOfWeek.length ?? 0;
  const basePerWeekCents =
    !local2.placed || local2.placed.priceCents == null
      ? 0
      : local2.placed.priceUnit === "per_day"
        ? local2.placed.priceCents * daysPerWeek
        : local2.placed.priceCents;
  const extrasCents = local2.placed ? extrasTotalCents(local2.placed.extras, daysPerWeek) : 0;
  const weekTotalDisplay =
    !local2.placed || local2.placed.priceCents == null
      ? "—"
      : `$${(basePerWeekCents / 100).toFixed(0)}${extrasCents > 0 ? ` + $${(extrasCents / 100).toFixed(0)} extras` : ""}`;

  return (
    <>
      <div className="fixed inset-0 bg-ink/25 z-40 cursor-pointer" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-base shadow-2xl z-50 flex flex-col">
        <header className="bg-surface px-5 py-4 border-b border-ink-3 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-sans text-[13px] sm:text-[11px] font-bold uppercase tracking-widest text-ink-2 mb-0.5">
                {mode === "catalog"
                  ? "In your catalog"
                  : local2.placed
                    ? `${kidName} · ${formatWeekRange(local2.placed.weekStart)}`
                    : "In your shortlist"}
              </div>

              {editingField === "name" ? (
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="font-display font-extrabold text-[28px] sm:text-2xl text-ink leading-tight w-full bg-transparent border-b border-ink focus:outline-none py-1"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit("name")}
                  disabled={isCurated}
                  className={`group/edit -mx-1 -my-0.5 px-1 py-0.5 rounded-md text-left w-full flex items-start gap-1.5 ${
                    isCurated ? "cursor-default" : "cursor-pointer hover:bg-ink/5 active:bg-ink/10"
                  }`}
                >
                  <span
                    className={`font-display font-extrabold text-[28px] sm:text-2xl leading-tight ${
                      local2.activityName === "New activity" ? "italic text-ink-2" : "text-ink"
                    }`}
                  >
                    {local2.activityName}
                  </span>
                  {!isCurated && <PencilIcon size={16} className="mt-2 sm:mt-1.5 text-ink-3 group-hover/edit:text-ink flex-shrink-0" />}
                </button>
              )}

              {local2.activityName === "New activity" && (
                <div className="font-sans text-xs sm:text-[10px] uppercase tracking-widest text-ink-2 mt-0.5">
                  We&apos;re fetching details…
                </div>
              )}

              {editingField === "org" ? (
                <input
                  autoFocus
                  value={draftOrg}
                  onChange={(e) => setDraftOrg(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  placeholder="Organization"
                  className="font-sans text-base sm:text-[13px] text-ink mt-1 w-full bg-transparent border-b border-ink focus:outline-none py-1"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit("org")}
                  disabled={isCurated}
                  className={`group/edit -mx-1 mt-0.5 px-1 min-h-[36px] rounded-md text-left w-full flex items-center gap-1.5 ${
                    isCurated ? "cursor-default" : "cursor-pointer hover:bg-ink/5 active:bg-ink/10"
                  }`}
                >
                  <span className="font-sans text-base sm:text-[13px] uppercase tracking-wide text-ink-2">
                    {local2.orgName ?? "Add organization"}
                    {local2.verified && <span className="text-[#5fc39c]"> · verified ✓</span>}
                  </span>
                  {!isCurated && <PencilIcon size={16} className="text-ink-3 group-hover/edit:text-ink flex-shrink-0" />}
                </button>
              )}

              {editingField === "url" ? (
                <input
                  autoFocus
                  value={draftUrl}
                  onChange={(e) => setDraftUrl(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  placeholder="https://…"
                  className="font-sans text-sm text-ink mt-0.5 w-full bg-transparent border-b border-ink focus:outline-none py-1"
                />
              ) : local2.activityUrl ? (
                <div className="flex items-center gap-1 mt-0.5 -mx-1">
                  <a
                    href={local2.activityUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 min-w-0 font-sans text-sm text-ink underline truncate px-1 py-1.5"
                  >
                    {local2.activityUrl}
                  </a>
                  {!isCurated && (
                    <button
                      type="button"
                      onClick={removeUrl}
                      aria-label="Remove URL"
                      className="flex-shrink-0 inline-flex items-center justify-center sm:w-auto sm:px-3 w-9 h-9 rounded-md text-ink-3 hover:text-[#c1474a] hover:bg-[#fdebec]"
                    >
                      <span className="sm:hidden text-lg leading-none" aria-hidden>✕</span>
                      <span className="hidden sm:inline font-sans text-[11px] uppercase tracking-widest font-bold">Remove URL</span>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit("url")}
                  className="group/edit -mx-1 mt-0.5 px-1 min-h-[36px] rounded-md text-left flex items-center gap-1.5 hover:bg-ink/5 active:bg-ink/10 disabled:opacity-50"
                  disabled={isCurated}
                >
                  <span className="font-sans text-[13px] uppercase tracking-widest text-ink-2">Add a URL</span>
                  {!isCurated && <PencilIcon size={16} className="text-ink-3 group-hover/edit:text-ink flex-shrink-0" />}
                </button>
              )}

              <div className="font-sans text-xs sm:text-[10px] uppercase tracking-widest text-ink-2 mt-2">
                {isCurated
                  ? "Curated by Kidtinerary"
                  : local2.addedAt
                    ? `You added this on ${new Date(local2.addedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                    : "You added this"}
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="text-ink-2 hover:text-ink text-lg">✕</button>
          </div>
          {/* Status dropdown — planner mode only, when the entry is placed */}
          {mode !== "catalog" && local2.placed && (
            <div className="mt-3">
              <StatusDropdown status={local2.placed.status} onChange={persistStatus} />
            </div>
          )}
        </header>

        <div className="p-5 space-y-5 flex-1 overflow-y-auto">
          {/* Catalog mode: aggregate planners section */}
          {mode === "catalog" && plannerPlacements.length > 0 && (
            <section className="mb-6">
              <p className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">
                On {plannerPlacements.length} planner{plannerPlacements.length === 1 ? "" : "s"}
              </p>
              <ul className="space-y-2">
                {plannerPlacements.map((p) => (
                  <li key={p.plannerId} className="flex items-center justify-between gap-3 rounded-lg border border-ink-3 bg-surface px-3 py-2">
                    <Link
                      href={`/planner?id=${p.plannerId}`}
                      className="font-display font-extrabold text-sm text-ink hover:underline truncate flex-1 min-w-0"
                    >
                      {p.plannerName}
                    </Link>
                    <StateBadge status={p.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {mode === "catalog" && plannerPlacements.length === 0 && (
            <p className="font-sans text-xs text-ink-2 italic mb-6">
              Not on any planner yet.
            </p>
          )}

          {/* 6. Schedule — placed only (planner mode) */}
          {mode !== "catalog" && local2.placed && (
          <section>
            <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">Schedule</h3>
            <ScheduleEditor
              sessionPart={local2.placed.sessionPart}
              daysOfWeek={local2.placed.daysOfWeek}
              onSessionPartChange={(p) => persistSchedule(p, local2.placed!.daysOfWeek)}
              onDaysChange={(d) => persistSchedule(local2.placed!.sessionPart, d)}
            />
          </section>
          )}

          {/* 7. This-week price + extras — placed only (planner mode) */}
          {mode !== "catalog" && local2.placed && (
          <section>
            <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">Price paid (this week)</h3>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-ink text-sm">$</span>
              <input
                type="number"
                value={local2.placed.priceCents == null ? "" : (local2.placed.priceCents / 100).toFixed(0)}
                onChange={(e) => {
                  const raw = e.target.value;
                  const cents = raw === "" ? null : Math.max(0, Math.round(parseFloat(raw) * 100));
                  persistPrice(cents, cents == null ? null : local2.placed!.priceUnit ?? "per_week");
                }}
                className="flex-1 rounded-md border border-ink-3 bg-surface px-2 py-1.5 text-sm"
                placeholder="0"
                min="0"
              />
              <select
                value={local2.placed.priceUnit ?? "per_week"}
                onChange={(e) => persistPrice(local2.placed!.priceCents, e.target.value as PriceUnit)}
                className="rounded-md border border-ink-3 bg-surface px-2 py-1.5 text-xs"
              >
                <option value="per_week">per week</option>
                <option value="per_day">per day</option>
              </select>
            </div>
            <ExtrasEditor extras={local2.placed.extras} onChange={persistExtras} />
            <div className="mt-2 flex justify-between items-center px-3 py-2 bg-ink-3/10 rounded-md">
              <span className="font-sans text-[10px] uppercase tracking-widest text-ink-2">This week</span>
              <span className="text-sm text-ink font-medium">{weekTotalDisplay}</span>
            </div>
          </section>
          )}

          {/* 8. Location — always shown */}
          <section>
            <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">Location</h3>
            <input
              value={local2.address ?? ""}
              onChange={(e) => {
                if (mode !== "catalog") setLocal({ ...local2, address: e.target.value });
              }}
              onBlur={() => {
                startTransition(async () => {
                  const r = await updateActivityFields({ activityId: local2.activityId, address: local2.address ?? "" });
                  if (r.error) alert(r.error);
                  onChanged();
                });
              }}
              disabled={isCurated}
              placeholder="Address"
              className="w-full bg-surface border border-ink-3 rounded-md px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink disabled:opacity-70"
            />
          </section>

          {/* 9. Notes — placed only (planner mode) */}
          {mode !== "catalog" && local2.placed && (
          <section>
            <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">Notes (this week)</h3>
            <textarea
              value={local2.placed.notes ?? ""}
              onChange={(e) => persistNotes(e.target.value)}
              className="w-full rounded-md border border-ink-3 bg-surface px-3 py-2 text-sm min-h-[64px]"
              placeholder="Pack swimsuit Monday, needs bug spray…"
            />
          </section>
          )}

          {/* Helper: activity-level edits propagate */}
          {mode !== "catalog" && local2.placed && !isCurated && (
            <p className="text-[11px] text-ink-2 italic -mt-3">
              Edits to categories, description, and info below affect every week this activity is placed.
            </p>
          )}

          {/* 10. Categories */}
          <section>
            <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2 flex items-center">
              Categories
              <span className="ml-1.5 font-sans text-[9px] uppercase tracking-wide text-[#8a6b00] bg-hero/20 px-1.5 py-0.5 rounded">Beta</span>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => {
                const selected = local2.categories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    disabled={isCurated}
                    onClick={() => {
                      if (isCurated) return;
                      const next = selected
                        ? local2.categories.filter((c) => c !== cat)
                        : [...local2.categories, cat];
                      if (mode !== "catalog") setLocal({ ...local2, categories: next });
                      startTransition(async () => {
                        const r = await updateActivityFields({ activityId: local2.activityId, categories: next });
                        if (r.error) alert(r.error);
                        onChanged();
                      });
                    }}
                    className={`font-sans text-[10px] uppercase tracking-wide px-2.5 py-1 rounded-full border transition-colors ${
                      selected
                        ? "bg-ink text-ink-inverse border-ink"
                        : "bg-transparent text-ink-2 border-ink-3 hover:border-ink hover:text-ink"
                    } disabled:hover:border-ink-3 disabled:hover:text-ink-2 disabled:opacity-70`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 11. About — read-only beta */}
          <section>
            <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2 flex items-center">
              About
              <span className="ml-1.5 font-sans text-[9px] uppercase tracking-wide text-[#8a6b00] bg-hero/20 px-1.5 py-0.5 rounded">Beta</span>
            </h3>
            <p className="text-sm text-ink leading-snug whitespace-pre-wrap">
              {local2.activityDescription ?? <span className="text-ink-2 italic">No description yet</span>}
            </p>
          </section>

          {/* 12. Ages — read-only beta */}
          <section>
            <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2 flex items-center">
              Ages
              <span className="ml-1.5 font-sans text-[9px] uppercase tracking-wide text-[#8a6b00] bg-hero/20 px-1.5 py-0.5 rounded">Beta</span>
            </h3>
            <div className="text-sm text-ink">
              {local2.ageMin != null || local2.ageMax != null
                ? `${local2.ageMin ?? "?"}–${local2.ageMax ?? "?"} years`
                : <span className="text-ink-2 italic">No age range yet</span>}
            </div>
          </section>

          {/* 13. Scraped price options — beta, read-only, show only if data */}
          {local2.scrapedPrices.length > 0 && (
            <section>
              <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2 flex items-center">
                Scraped prices
                <span className="ml-1.5 font-sans text-[9px] uppercase tracking-wide text-[#8a6b00] bg-hero/20 px-1.5 py-0.5 rounded">Beta</span>
              </h3>
              <ul className="text-sm text-ink space-y-1">
                {local2.scrapedPrices.slice(0, 5).map((p) => {
                  const unit = p.price_unit === "per_week" ? "/ week" : p.price_unit === "per_day" ? "/ day" : p.price_unit === "per_session" ? "/ session" : "";
                  return (
                    <li key={p.id} className="flex items-baseline justify-between gap-2">
                      <span className="text-ink-2">{p.label || "Standard"}</span>
                      <span>${(p.price_cents / 100).toFixed(0)} {unit}</span>
                    </li>
                  );
                })}
                {local2.scrapedPrices.length > 5 && (
                  <li className="text-[11px] text-ink-2">+{local2.scrapedPrices.length - 5} more</li>
                )}
              </ul>
            </section>
          )}

          {/* 14. Scraped dates/sessions — beta, read-only, show only if data came from scraping */}
          {local2.sourceUrl && local2.scrapedSessions.length > 0 && (
            <section>
              <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2 flex items-center">
                Scraped dates
                <span className="ml-1.5 font-sans text-[9px] uppercase tracking-wide text-[#8a6b00] bg-hero/20 px-1.5 py-0.5 rounded">Beta</span>
              </h3>
              <ul className="text-sm text-ink space-y-1">
                {local2.scrapedSessions.slice(0, 5).map((s) => {
                  const start = new Date(s.starts_at + "T00:00:00");
                  const end = new Date(s.ends_at + "T00:00:00");
                  const sameMonth = start.getMonth() === end.getMonth();
                  const startFmt = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  const endFmt = sameMonth
                    ? end.toLocaleDateString("en-US", { day: "numeric" })
                    : end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  return (
                    <li key={s.id}>{startFmt} – {endFmt}</li>
                  );
                })}
                {local2.scrapedSessions.length > 5 && (
                  <li className="text-[11px] text-ink-2">+{local2.scrapedSessions.length - 5} more</li>
                )}
              </ul>
            </section>
          )}


        </div>

        <footer className="border-t border-ink-3 bg-surface shrink-0">
          {mode !== "catalog" && local2.placed && (kids ?? []).length > 1 && (() => {
            const alreadyPlaced = new Set(local2.placed.kidsAlreadyPlacedIds);
            const eligibleKids = (kids ?? []).filter((k) => !alreadyPlaced.has(k.id));
            if (eligibleKids.length === 0) return null;
            return (
              <div className="px-4 pt-3 pb-3 border-b border-ink-3">
                <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">Also add for</h3>
                <div className="flex gap-1.5 flex-wrap">
                  {eligibleKids.map((k) => {
                    const kidIndex = (kids ?? []).findIndex((kk) => kk.id === k.id);
                    return (
                      <button
                        key={k.id}
                        onClick={() => addForKid(k.id)}
                        className="flex items-center gap-1.5 rounded-full border border-ink-3 bg-base px-3 py-1 text-xs hover:border-ink"
                      >
                        <KidAvatar name={k.name} color={k.color} index={kidIndex} avatarUrl={k.avatar_url} size={18} />
                        {k.name} <span className="text-ink-2">+</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-ink-2 italic mt-1.5">Copies schedule, price, extras.</p>
              </div>
            );
          })()}
          <div className="p-4 flex items-center justify-between gap-2">
            {mode !== "catalog" && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={isPending}
                className="font-sans text-[11px] uppercase tracking-widest px-4 py-2 rounded-full border border-[#ef8c8f] text-[#c1474a] hover:bg-[#ef8c8f]/10 disabled:opacity-50"
              >
                {local2.placed ? "Delete from week" : "Delete from shortlist"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="font-sans text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-ink text-ink-inverse hover:bg-ink/90 ml-auto"
            >
              Done
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}
