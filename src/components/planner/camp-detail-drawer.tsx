"use client";

import { useEffect, useState, useTransition } from "react";
import { StatusDropdown } from "./status-dropdown";
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
  assignCampToWeek,
  updateActivityFields,
  removeCampFromShortlist,
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
  /** Null when the camp is in the shortlist but not placed on a week/kid yet. */
  placed: PlacedFields | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  entry: DrawerEntry | null;
  kids: Kid[];
  onChanged: () => void;
}

export function CampDetailDrawer({ open, onClose, entry, kids, onChanged }: Props) {
  const [local, setLocal] = useState<DrawerEntry | null>(entry);
  const [isPending, startTransition] = useTransition();

  const [editingField, setEditingField] = useState<"name" | "org" | "url" | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftOrg, setDraftOrg] = useState("");
  const [draftUrl, setDraftUrl] = useState("");

  useEffect(() => {
    setLocal(entry);
  }, [entry]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !editingField) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, editingField]);

  function startEdit(field: "name" | "org" | "url") {
    if (!local) return;
    if (local.source === "curated") return; // curated rows are read-only
    setDraftName(local.activityName);
    setDraftOrg(local.orgName ?? "");
    setDraftUrl(local.activityUrl ?? "");
    setEditingField(field);
  }

  async function commitEdit() {
    if (!local || !editingField) return;
    const field = editingField;
    setEditingField(null);
    const patch: { name?: string; orgName?: string; url?: string | null } = {};
    if (field === "name" && draftName !== local.activityName) {
      patch.name = draftName;
      setLocal({ ...local, activityName: draftName });
    }
    if (field === "org" && draftOrg !== (local.orgName ?? "")) {
      patch.orgName = draftOrg;
      setLocal({ ...local, orgName: draftOrg || null });
    }
    if (field === "url" && draftUrl !== (local.activityUrl ?? "")) {
      patch.url = draftUrl || null;
      setLocal({ ...local, activityUrl: draftUrl || null });
    }
    if (Object.keys(patch).length === 0) return;
    startTransition(async () => {
      const r = await updateActivityFields({ activityId: local.activityId, ...patch });
      if (r.error) {
        alert(r.error);
      }
      onChanged();
    });
  }

  function cancelEdit() {
    setEditingField(null);
  }

  if (!open || !local) return null;

  const isCurated = local.source === "curated";
  const kidName = local.placed ? kids.find((k) => k.id === local.placed!.childId)?.name ?? "" : "";

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
      await assignCampToWeek(
        local.userCampId,
        otherKidId,
        placed.weekStart.toISOString().split("T")[0],
        placed.status,
      );
      onChanged();
    });
  }

  async function handleRemove() {
    if (!local) return;
    if (local.placed) {
      if (!confirm("Remove this camp from this week?")) return;
      const placed = local.placed;
      startTransition(async () => {
        await removePlannerEntry(placed.id);
        onChanged();
        onClose();
      });
    } else {
      if (!confirm("Delete this camp from your shortlist? This can't be undone.")) return;
      const userCampId = local.userCampId;
      startTransition(async () => {
        const r = await removeCampFromShortlist(userCampId);
        if (r.error) {
          alert(r.error);
          return;
        }
        onChanged();
        onClose();
      });
    }
  }

  const daysPerWeek = local.placed?.daysOfWeek.length ?? 0;
  const basePerWeekCents =
    !local.placed || local.placed.priceCents == null
      ? 0
      : local.placed.priceUnit === "per_day"
        ? local.placed.priceCents * daysPerWeek
        : local.placed.priceCents;
  const extrasCents = local.placed ? extrasTotalCents(local.placed.extras, daysPerWeek) : 0;
  const weekTotalDisplay =
    !local.placed || local.placed.priceCents == null
      ? "—"
      : `$${(basePerWeekCents / 100).toFixed(0)}${extrasCents > 0 ? ` + $${(extrasCents / 100).toFixed(0)} extras` : ""}`;

  return (
    <>
      <div className="fixed inset-0 bg-ink/25 z-40 cursor-pointer" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-base shadow-2xl z-50 flex flex-col">
        <header className="bg-surface px-5 py-4 border-b border-ink-3 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-sans text-[11px] font-bold uppercase tracking-widest text-ink-2 mb-0.5">
                {local.placed
                  ? `${kidName} · ${formatWeekRange(local.placed.weekStart)}`
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
                  className="font-display font-extrabold text-2xl text-ink leading-tight w-full bg-transparent border-b border-ink focus:outline-none"
                />
              ) : (
                <h2
                  onClick={() => startEdit("name")}
                  className={`font-display font-extrabold text-2xl leading-tight ${
                    isCurated ? "cursor-default" : "cursor-pointer"
                  } ${local.activityName === "New camp" ? "italic text-ink-2" : "text-ink"}`}
                >
                  {local.activityName}
                </h2>
              )}

              {local.activityName === "New camp" && (
                <div className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mt-0.5">
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
                  className="font-sans text-[10px] uppercase tracking-wide text-ink mt-1 w-full bg-transparent border-b border-ink focus:outline-none"
                />
              ) : (
                <div
                  onClick={() => startEdit("org")}
                  className={`font-sans text-[10px] uppercase tracking-wide text-ink-2 mt-1 ${
                    isCurated ? "cursor-default" : "cursor-pointer"
                  }`}
                >
                  {local.orgName ?? "Add organization"}
                  {local.verified && <span className="text-[#5fc39c]"> · verified ✓</span>}
                </div>
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
                  className="font-sans text-xs text-ink mt-1 w-full bg-transparent border-b border-ink focus:outline-none"
                />
              ) : local.activityUrl ? (
                <div className="flex items-center gap-2 mt-1">
                  <a
                    href={local.activityUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-sans text-xs text-ink underline truncate"
                  >
                    {local.activityUrl}
                  </a>
                  <button
                    type="button"
                    onClick={() => startEdit("url")}
                    className="font-sans text-[10px] uppercase tracking-widest text-ink-2 hover:text-ink"
                  >
                    Edit
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit("url")}
                  className="font-sans text-[10px] uppercase tracking-widest text-ink-2 hover:text-ink mt-1"
                  disabled={isCurated}
                >
                  Add a URL
                </button>
              )}

              <div className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mt-2">
                {isCurated ? "Curated by Kidtinerary" : "You added this"}
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="text-ink-2 hover:text-ink text-lg">✕</button>
          </div>
          {local.placed && (
            <div className="mt-3">
              <StatusDropdown status={local.placed.status} onChange={persistStatus} />
            </div>
          )}
        </header>

        <div className="p-5 space-y-5 flex-1 overflow-y-auto">
          {/* 6. Schedule — placed only */}
          {local.placed && (
          <section>
            <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">Schedule</h3>
            <ScheduleEditor
              sessionPart={local.placed.sessionPart}
              daysOfWeek={local.placed.daysOfWeek}
              onSessionPartChange={(p) => persistSchedule(p, local.placed!.daysOfWeek)}
              onDaysChange={(d) => persistSchedule(local.placed!.sessionPart, d)}
            />
          </section>
          )}

          {/* 7. This-week price + extras — placed only */}
          {local.placed && (
          <section>
            <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">Price paid (this week)</h3>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-ink text-sm">$</span>
              <input
                type="number"
                value={local.placed.priceCents == null ? "" : (local.placed.priceCents / 100).toFixed(0)}
                onChange={(e) => {
                  const raw = e.target.value;
                  const cents = raw === "" ? null : Math.max(0, Math.round(parseFloat(raw) * 100));
                  persistPrice(cents, cents == null ? null : local.placed!.priceUnit ?? "per_week");
                }}
                className="flex-1 rounded-md border border-ink-3 bg-surface px-2 py-1.5 text-sm"
                placeholder="0"
                min="0"
              />
              <select
                value={local.placed.priceUnit ?? "per_week"}
                onChange={(e) => persistPrice(local.placed!.priceCents, e.target.value as PriceUnit)}
                className="rounded-md border border-ink-3 bg-surface px-2 py-1.5 text-xs"
              >
                <option value="per_week">per week</option>
                <option value="per_day">per day</option>
              </select>
            </div>
            <ExtrasEditor extras={local.placed.extras} onChange={persistExtras} />
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
              value={local.address ?? ""}
              onChange={(e) => setLocal({ ...local, address: e.target.value })}
              onBlur={() => {
                startTransition(async () => {
                  const r = await updateActivityFields({ activityId: local.activityId, address: local.address ?? "" });
                  if (r.error) alert(r.error);
                  onChanged();
                });
              }}
              disabled={isCurated}
              placeholder="Address"
              className="w-full bg-surface border border-ink-3 rounded-md px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink disabled:opacity-70"
            />
          </section>

          {/* 9. Notes — placed only */}
          {local.placed && (
          <section>
            <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">Notes (this week)</h3>
            <textarea
              value={local.placed.notes ?? ""}
              onChange={(e) => persistNotes(e.target.value)}
              className="w-full rounded-md border border-ink-3 bg-surface px-3 py-2 text-sm min-h-[64px]"
              placeholder="Pack swimsuit Monday, needs bug spray…"
            />
          </section>
          )}

          {/* Helper: activity-level edits propagate */}
          {local.placed && !isCurated && (
            <p className="text-[11px] text-ink-2 italic -mt-3">
              Edits to categories, description, and info below affect every week this camp is placed.
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
                const selected = local.categories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    disabled={isCurated}
                    onClick={() => {
                      if (isCurated) return;
                      const next = selected
                        ? local.categories.filter((c) => c !== cat)
                        : [...local.categories, cat];
                      setLocal({ ...local, categories: next });
                      startTransition(async () => {
                        const r = await updateActivityFields({ activityId: local.activityId, categories: next });
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
              {local.activityDescription ?? <span className="text-ink-2 italic">No description yet</span>}
            </p>
          </section>

          {/* 12. Ages — read-only beta */}
          <section>
            <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2 flex items-center">
              Ages
              <span className="ml-1.5 font-sans text-[9px] uppercase tracking-wide text-[#8a6b00] bg-hero/20 px-1.5 py-0.5 rounded">Beta</span>
            </h3>
            <div className="text-sm text-ink">
              {local.ageMin != null || local.ageMax != null
                ? `${local.ageMin ?? "?"}–${local.ageMax ?? "?"} years`
                : <span className="text-ink-2 italic">No age range yet</span>}
            </div>
          </section>

          {/* 13. Scraped price options — beta, read-only, show only if data */}
          {local.scrapedPrices.length > 0 && (
            <section>
              <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2 flex items-center">
                Scraped prices
                <span className="ml-1.5 font-sans text-[9px] uppercase tracking-wide text-[#8a6b00] bg-hero/20 px-1.5 py-0.5 rounded">Beta</span>
              </h3>
              <ul className="text-sm text-ink space-y-1">
                {local.scrapedPrices.slice(0, 5).map((p) => {
                  const unit = p.price_unit === "per_week" ? "/ week" : p.price_unit === "per_day" ? "/ day" : p.price_unit === "per_session" ? "/ session" : "";
                  return (
                    <li key={p.id} className="flex items-baseline justify-between gap-2">
                      <span className="text-ink-2">{p.label || "Standard"}</span>
                      <span>${(p.price_cents / 100).toFixed(0)} {unit}</span>
                    </li>
                  );
                })}
                {local.scrapedPrices.length > 5 && (
                  <li className="text-[11px] text-ink-2">+{local.scrapedPrices.length - 5} more</li>
                )}
              </ul>
            </section>
          )}

          {/* 14. Scraped dates/sessions — beta, read-only, show only if data came from scraping */}
          {local.sourceUrl && local.scrapedSessions.length > 0 && (
            <section>
              <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2 flex items-center">
                Scraped dates
                <span className="ml-1.5 font-sans text-[9px] uppercase tracking-wide text-[#8a6b00] bg-hero/20 px-1.5 py-0.5 rounded">Beta</span>
              </h3>
              <ul className="text-sm text-ink space-y-1">
                {local.scrapedSessions.slice(0, 5).map((s) => {
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
                {local.scrapedSessions.length > 5 && (
                  <li className="text-[11px] text-ink-2">+{local.scrapedSessions.length - 5} more</li>
                )}
              </ul>
            </section>
          )}


        </div>

        <footer className="border-t border-ink-3 bg-surface shrink-0">
          {local.placed && kids.length > 1 && (() => {
            const alreadyPlaced = new Set(local.placed.kidsAlreadyPlacedIds);
            const eligibleKids = kids.filter((k) => !alreadyPlaced.has(k.id));
            if (eligibleKids.length === 0) return null;
            return (
              <div className="px-4 pt-3 pb-3 border-b border-ink-3">
                <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">Also add for</h3>
                <div className="flex gap-1.5 flex-wrap">
                  {eligibleKids.map((k) => {
                    const kidIndex = kids.findIndex((kk) => kk.id === k.id);
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
            <button
              type="button"
              onClick={handleRemove}
              disabled={isPending}
              className="font-sans text-[11px] uppercase tracking-widest px-4 py-2 rounded-full border border-[#ef8c8f] text-[#c1474a] hover:bg-[#ef8c8f]/10 disabled:opacity-50"
            >
              {local.placed ? "Delete from week" : "Delete from shortlist"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="font-sans text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-ink text-ink-inverse hover:bg-ink/90"
            >
              Done
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}
