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
} from "@/lib/actions";
import { extrasTotalCents } from "@/lib/extras-calc";
import { formatWeekRange } from "@/lib/format";
import type {
  PlannerEntryStatus,
  SessionPart,
  DayOfWeek,
  ExtraItem,
  PriceUnit,
} from "@/lib/supabase/types";

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
  activityName: string;
  activitySlug: string;
  activityUrl: string | null;
  activityDescription: string | null;
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

  useEffect(() => {
    setLocal(entry);
  }, [entry]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
      <aside className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-base shadow-2xl z-50 overflow-y-auto">
        <header className="bg-surface px-5 py-4 border-b border-ink-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-0.5">
                {kidName} · {formatWeekRange(local.weekStart)}
              </div>
              <h2 className="font-display font-extrabold text-2xl text-ink leading-tight">{local.activityName}</h2>
              <div className="font-sans text-[10px] uppercase tracking-wide text-ink-2 mt-1">
                {local.orgName ?? ""} {local.verified && <span className="text-[#5fc39c]">· verified ✓</span>}
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="text-ink-2 hover:text-ink text-lg">✕</button>
          </div>
          <div className="mt-3">
            <StatusDropdown status={local.status} onChange={persistStatus} />
          </div>
        </header>

        <div className="p-5 space-y-5">
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
            <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-2">Camp info</h3>
            {local.activityDescription && (
              <p className="text-sm text-ink mb-2">{local.activityDescription}</p>
            )}
            {local.activityUrl && (
              <Link href={local.activityUrl} target="_blank" className="text-sm text-ink underline">
                {new URL(local.activityUrl).hostname} ↗
              </Link>
            )}
          </section>

          <section className="pt-2 border-t border-ink-3">
            <button
              onClick={handleRemove}
              disabled={isPending}
              className="text-xs text-[#ef8c8f] hover:text-[#ef8c8f]/80"
            >
              Remove this camp from {kidName}&apos;s week
            </button>
          </section>
        </div>
      </aside>
    </>
  );
}
