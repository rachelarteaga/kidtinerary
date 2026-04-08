"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import {
  updatePlannerEntryStatus,
  updatePlannerEntryNotes,
  removePlannerEntry,
} from "@/lib/actions";
import {
  formatDateRange,
  formatTimeSlot,
  formatPrice,
  formatPriceUnit,
} from "@/lib/format";
import type { PlannerEntryRow } from "@/lib/queries";
import type { TimeSlot, PriceUnit } from "@/lib/constants";

interface PlannerEntryCardProps {
  entry: PlannerEntryRow;
  isGreyedOut: boolean;
  onEntryUpdated: (entry: PlannerEntryRow) => void;
  onEntryRemoved: (entryId: string) => void;
}

export function PlannerEntryCard({
  entry,
  isGreyedOut,
  onEntryUpdated,
  onEntryRemoved,
}: PlannerEntryCardProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [notesOpen, setNotesOpen] = useState(!!entry.notes);
  const [notesValue, setNotesValue] = useState(entry.notes ?? "");

  const isLockedIn = entry.status === "locked_in";
  const activity = entry.session.activity;

  const lowestPrice = activity.price_options?.length
    ? activity.price_options.reduce((min, p) =>
        p.price_cents < min.price_cents ? p : min
      )
    : null;

  function handleStatusToggle() {
    const nextStatus = isLockedIn ? "penciled_in" : "locked_in";
    startTransition(async () => {
      const result = await updatePlannerEntryStatus(entry.id, nextStatus);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      const label = nextStatus === "locked_in" ? "Locked in! 🎉" : "Back to penciled in.";
      toast(label, "success");
      onEntryUpdated({ ...entry, status: nextStatus });
    });
  }

  function handleNotesBlur() {
    const trimmed = notesValue.trim();
    if (trimmed === (entry.notes ?? "").trim()) return;
    startTransition(async () => {
      const result = await updatePlannerEntryNotes(entry.id, trimmed);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      onEntryUpdated({ ...entry, notes: trimmed || null });
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await removePlannerEntry(entry.id);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast("Removed from your plan.", "info");
      onEntryRemoved(entry.id);
    });
  }

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        isLockedIn
          ? "border-meadow/40 bg-meadow/5 shadow-sm"
          : isGreyedOut
            ? "border-driftwood/20 bg-bark/3 opacity-50"
            : "border-driftwood/20 bg-cream"
      } ${isPending ? "opacity-70 pointer-events-none" : ""}`}
    >
      {/* Top row: name + remove */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <a
          href={`/activity/${activity.slug}`}
          className="font-serif text-base text-bark hover:text-sunset transition-colors leading-tight"
        >
          {activity.name}
        </a>
        <button
          onClick={handleRemove}
          aria-label="Remove from plan"
          className="text-driftwood hover:text-red-500 transition-colors shrink-0 mt-0.5 cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Tags row */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Tag type="schedule" label={formatTimeSlot(entry.session.time_slot as TimeSlot)} />
        <Tag
          type="schedule"
          label={formatDateRange(entry.session.starts_at, entry.session.ends_at)}
        />
        {lowestPrice && (
          <Tag
            type="age"
            label={`${formatPrice(lowestPrice.price_cents)}${formatPriceUnit(lowestPrice.price_unit as PriceUnit)}`}
          />
        )}
      </div>

      {/* Action row: status toggle + notes toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={isLockedIn ? "nature" : "ghost"}
          className="text-[10px] px-3 py-1.5"
          onClick={handleStatusToggle}
          disabled={isPending}
        >
          {isLockedIn ? "Locked In ✓" : "Penciled In"}
        </Button>

        <button
          onClick={() => setNotesOpen((v) => !v)}
          className="font-mono text-[10px] uppercase tracking-wide text-driftwood hover:text-bark transition-colors cursor-pointer"
        >
          {notesOpen ? "Hide notes" : "Add note"}
        </button>
      </div>

      {/* Expandable notes */}
      {notesOpen && (
        <textarea
          value={notesValue}
          onChange={(e) => setNotesValue(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="Jot down anything — registration link, carpool notes, questions..."
          rows={2}
          className="mt-3 w-full rounded-lg border border-driftwood/30 bg-white px-3 py-2 text-sm text-bark placeholder:text-driftwood/60 focus:outline-none focus:border-campfire resize-none"
        />
      )}
    </div>
  );
}
