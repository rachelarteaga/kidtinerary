"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
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

interface DrawerEntry {
  id: string;
  childId: string;
  weekStart: Date;
  userCampId: string;
  activityId: string;
  orgId: string | null;
  activityName: string;
  activitySlug: string;
  activityUrl: string | null;
  activityDescription: string | null;
  ageMin: number | null;
  ageMax: number | null;
  categories: string[];
  orgName: string | null;
  verified: boolean;
  status: PlannerEntryStatus;
  sessionPart: SessionPart;
  daysOfWeek: DayOfWeek[];
  priceCents: number | null;
  priceUnit: PriceUnit | null;
  extras: ExtraItem[];
  notes: string | null;
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

  const kidName = kids.find((k) => k.id === local.childId)?.name ?? "";

  function persistSchedule(part: SessionPart, days: DayOfWeek[]) {
    if (!local) return;
    setLocal({ ...local, sessionPart: part, daysOfWeek: days });
    startTransition(async () => {
      await updateEntrySchedule(local.id, part, days);
      onChanged();
    });
  }

  function persistPrice(cents: number | null, unit: PriceUnit | null) {
    if (!local) return;
    setLocal({ ...local, priceCents: cents, priceUnit: unit });
    startTransition(async () => {
      await updateEntryPrice(local.id, cents, unit);
      onChanged();
    });
  }

  function persistExtras(extras: ExtraItem[]) {
    if (!local) return;
    setLocal({ ...local, extras });
    startTransition(async () => {
      await updateEntryExtras(local.id, extras);
      onChanged();
    });
  }

  function persistNotes(notes: string) {
    if (!local) return;
    setLocal({ ...local, notes });
    startTransition(async () => {
      await updateEntryNotes(local.id, notes);
      onChanged();
    });
  }

  function persistStatus(status: PlannerEntryStatus) {
    if (!local) return;
    setLocal({ ...local, status });
    startTransition(async () => {
      await updatePlannerEntryStatus(local.id, status);
      onChanged();
    });
  }

  function addForKid(otherKidId: string) {
    if (!local) return;
    startTransition(async () => {
      await assignCampToWeek(
        local.userCampId,
        otherKidId,
        local.weekStart.toISOString().split("T")[0],
        local.status,
      );
      onChanged();
    });
  }

  async function handleRemove() {
    if (!local) return;
    if (!confirm("Remove this camp from this week?")) return;
    startTransition(async () => {
      await removePlannerEntry(local.id);
      onChanged();
      onClose();
    });
  }

  const daysPerWeek = local.daysOfWeek.length;
  const basePerWeekCents =
    local.priceCents == null
      ? 0
      : local.priceUnit === "per_day"
        ? local.priceCents * daysPerWeek
        : local.priceCents;
  const extrasCents = extrasTotalCents(local.extras, daysPerWeek);
  const weekTotalDisplay =
    local.priceCents == null
      ? "—"
      : `$${(basePerWeekCents / 100).toFixed(0)}${extrasCents > 0 ? ` + $${(extrasCents / 100).toFixed(0)} extras` : ""}`;

  return (
    <>
      <div className="fixed inset-0 bg-ink/25 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-base shadow-2xl z-50 flex flex-col">
        <header className="bg-surface px-5 py-4 border-b border-ink-3 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-sans text-[11px] font-bold uppercase tracking-widest text-ink-2 mb-0.5">
                {kidName} · {formatWeekRange(local.weekStart)}
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
                  className={`font-display font-extrabold text-2xl leading-tight cursor-text ${
                    local.activityName === "New camp" ? "italic text-ink-2" : "text-ink"
                  }`}
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
                  className="font-sans text-[10px] uppercase tracking-wide text-ink-2 mt-1 cursor-text"
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
                >
                  Add a URL
                </button>
              )}
            </div>
            <button onClick={onClose} aria-label="Close" className="text-ink-2 hover:text-ink text-lg">✕</button>
          </div>
          <div className="mt-3">
            <StatusDropdown status={local.status} onChange={persistStatus} />
          </div>
        </header>

        <div className="p-5 space-y-5 flex-1 overflow-y-auto">
          <section>
            <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">Schedule</h3>
            <ScheduleEditor
              sessionPart={local.sessionPart}
              daysOfWeek={local.daysOfWeek}
              onSessionPartChange={(p) => persistSchedule(p, local.daysOfWeek)}
              onDaysChange={(d) => persistSchedule(local.sessionPart, d)}
            />
          </section>

          <section>
            <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">Price</h3>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-ink text-sm">$</span>
              <input
                type="number"
                value={local.priceCents == null ? "" : (local.priceCents / 100).toFixed(0)}
                onChange={(e) => {
                  const raw = e.target.value;
                  const cents = raw === "" ? null : Math.max(0, Math.round(parseFloat(raw) * 100));
                  persistPrice(cents, cents == null ? null : local.priceUnit ?? "per_week");
                }}
                className="flex-1 rounded-md border border-ink-3 bg-surface px-2 py-1.5 text-sm"
                placeholder="0"
                min="0"
              />
              <select
                value={local.priceUnit ?? "per_week"}
                onChange={(e) => persistPrice(local.priceCents, e.target.value as PriceUnit)}
                className="rounded-md border border-ink-3 bg-surface px-2 py-1.5 text-xs"
              >
                <option value="per_week">per week</option>
                <option value="per_day">per day</option>
              </select>
            </div>
            <ExtrasEditor extras={local.extras} onChange={persistExtras} />
            <div className="mt-2 flex justify-between items-center px-3 py-2 bg-ink-3/10 rounded-md">
              <span className="font-sans text-[10px] uppercase tracking-widest text-ink-2">This week</span>
              <span className="text-sm text-ink font-medium">{weekTotalDisplay}</span>
            </div>
          </section>

          <section>
            <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">Notes (optional)</h3>
            <textarea
              value={local.notes ?? ""}
              onChange={(e) => persistNotes(e.target.value)}
              className="w-full rounded-md border border-ink-3 bg-surface px-3 py-2 text-sm min-h-[64px]"
              placeholder="Pack swimsuit Monday, needs bug spray…"
            />
          </section>

          {kids.length > 1 && (
            <section>
              <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">Also add for</h3>
              <div className="flex gap-1.5 flex-wrap">
                {kids.filter((k) => k.id !== local.childId).map((k) => {
                  const kidIndex = kids.findIndex((kk) => kk.id === k.id);
                  return (
                  <button
                    key={k.id}
                    onClick={() => addForKid(k.id)}
                    className="flex items-center gap-1.5 rounded-full border border-ink-3 bg-surface px-3 py-1 text-xs hover:border-ink"
                  >
                    <KidAvatar name={k.name} color={k.color} index={kidIndex} avatarUrl={k.avatar_url} size={18} />
                    {k.name} <span className="text-ink-2">+</span>
                  </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-ink-2 italic mt-1.5">Copies schedule, price, extras.</p>
            </section>
          )}

          <section>
            <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">Categories</h3>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => {
                const selected = local.categories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
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
                    }`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">Ages</h3>
            <div className="flex items-center gap-2 text-sm text-ink">
              <input
                type="number"
                min={0}
                max={25}
                value={local.ageMin ?? ""}
                onChange={(e) => setLocal({ ...local, ageMin: e.target.value === "" ? null : Number(e.target.value) })}
                onBlur={() => {
                  startTransition(async () => {
                    const r = await updateActivityFields({ activityId: local.activityId, ageMin: local.ageMin });
                    if (r.error) alert(r.error);
                    onChanged();
                  });
                }}
                placeholder="min"
                className="w-16 bg-surface border border-ink-3 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-ink"
              />
              <span className="text-ink-2">to</span>
              <input
                type="number"
                min={0}
                max={25}
                value={local.ageMax ?? ""}
                onChange={(e) => setLocal({ ...local, ageMax: e.target.value === "" ? null : Number(e.target.value) })}
                onBlur={() => {
                  startTransition(async () => {
                    const r = await updateActivityFields({ activityId: local.activityId, ageMax: local.ageMax });
                    if (r.error) alert(r.error);
                    onChanged();
                  });
                }}
                placeholder="max"
                className="w-16 bg-surface border border-ink-3 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-ink"
              />
              <span className="text-ink-2 text-xs">years</span>
            </div>
          </section>

          <section>
            <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">About</h3>
            <textarea
              value={local.activityDescription ?? ""}
              onChange={(e) => setLocal({ ...local, activityDescription: e.target.value })}
              onBlur={() => {
                startTransition(async () => {
                  const r = await updateActivityFields({ activityId: local.activityId, description: local.activityDescription });
                  if (r.error) alert(r.error);
                  onChanged();
                });
              }}
              placeholder="What's this camp about?"
              rows={4}
              className="w-full bg-surface border border-ink-3 rounded-md px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink resize-none"
            />
          </section>

        </div>

        <footer className="p-4 border-t border-ink-3 bg-surface shrink-0 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleRemove}
            disabled={isPending}
            className="font-sans text-[11px] uppercase tracking-widest px-4 py-2 rounded-full border border-[#ef8c8f] text-[#c1474a] hover:bg-[#ef8c8f]/10 disabled:opacity-50"
          >
            Delete from week
          </button>
          <button
            type="button"
            onClick={onClose}
            className="font-sans text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-ink text-ink-inverse hover:bg-ink/90"
          >
            Done
          </button>
        </footer>
      </aside>
    </>
  );
}
