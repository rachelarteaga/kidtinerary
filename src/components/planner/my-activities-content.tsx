"use client";

import { useMemo, useState, useTransition } from "react";
import { useDraggable } from "@dnd-kit/core";
import { removeActivityFromShortlist } from "@/lib/actions";
import type { UserActivityWithDetails } from "@/lib/queries";

interface Props {
  activities: UserActivityWithDetails[];
  onChipClick: (activity: UserActivityWithDetails) => void;
  onAddClick: () => void;
  onChanged?: () => void;
}

/** Inner content of the My Activities rail — the heading, "+ Add activity"
 *  button, and the list of draggable activity chips. Owns the
 *  remove-confirmation modal locally because the modal only ever appears
 *  in response to a chip-level Remove tap. Wrapped by:
 *  - `<MyActivitiesRail>` for the standalone desktop <aside> + mobile sheet
 *  - `<PlannerRail>` for the tabbed-in-a-panel use */
export function MyActivitiesContent({
  activities,
  onChipClick,
  onAddClick,
  onChanged,
}: Props) {
  const [pendingRemove, setPendingRemove] = useState<{
    userCampId: string;
    name: string;
    entryCount: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmRemove() {
    if (!pendingRemove) return;
    startTransition(async () => {
      const result = await removeActivityFromShortlist(pendingRemove.userCampId);
      if (result.error) {
        alert(result.error);
        return;
      }
      setPendingRemove(null);
      onChanged?.();
    });
  }

  return (
    <>
      <h2 className="font-display font-extrabold text-lg text-ink tracking-tight mb-3 flex-shrink-0">My activities</h2>

      <button
        onClick={onAddClick}
        className="w-full mb-3 rounded-lg border border-dashed border-ink-3 text-ink-2 hover:border-ink hover:text-ink transition-colors font-sans text-[11px] uppercase tracking-wide py-2 flex-shrink-0"
      >
        + Add activity
      </button>

      <div className="space-y-2">
        {activities.length === 0 && (
          <p className="text-sm text-ink-3 italic">Nothing yet — add one above.</p>
        )}
        {activities.map((c) => (
          <DraggableActivityItem
            key={c.id}
            activity={c}
            onClick={() => onChipClick(c)}
            onRemoveClick={() =>
              setPendingRemove({
                userCampId: c.id,
                name: c.activity.name,
                entryCount: c.plannerEntryCount,
              })
            }
          />
        ))}
      </div>

      {pendingRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-ink/40 cursor-pointer" onClick={() => setPendingRemove(null)} />
          <div className="relative bg-surface rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-display font-extrabold text-xl text-ink mb-2">Remove {pendingRemove.name}?</h3>
            <p className="text-sm text-ink-2 mb-4 leading-relaxed">
              {pendingRemove.entryCount > 0 ? (
                <>
                  This will remove {pendingRemove.name} from your My Activities list AND delete{" "}
                  <strong>{pendingRemove.entryCount}</strong> planner entr
                  {pendingRemove.entryCount === 1 ? "y" : "ies"} across your weeks.
                  This cannot be undone.
                </>
              ) : (
                <>This will remove {pendingRemove.name} from your My Activities list.</>
              )}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPendingRemove(null)}
                className="font-sans text-[11px] uppercase tracking-widest px-3 py-1.5 text-ink-2 hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemove}
                disabled={isPending}
                className="font-sans text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full bg-ink text-ink-inverse hover:bg-ink disabled:opacity-50"
              >
                {isPending ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DraggableActivityItem({
  activity,
  onClick,
  onRemoveClick,
}: {
  activity: UserActivityWithDetails;
  onClick: () => void;
  onRemoveClick: () => void;
}) {
  const data = useMemo(
    () => ({
      type: "activity" as const,
      userCampId: activity.id,
      activityId: activity.activity.id,
      name: activity.activity.name,
      color: activity.color,
    }),
    [activity.id, activity.activity.id, activity.activity.name, activity.color]
  );
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `activity-${activity.id}`,
    data,
  });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`group relative rounded-lg border bg-white p-2.5 cursor-pointer select-none transition-all border-ink-3 ${isDragging ? "opacity-60 ring-2 ring-hero-light/40" : "hover:border-ink"}`}
    >
      <div className="flex items-start gap-1.5">
        <button
          {...listeners}
          {...attributes}
          type="button"
          aria-label={`Drag ${activity.activity.name}`}
          onClick={(e) => e.stopPropagation()}
          className="text-ink-3 hover:text-ink cursor-grab active:cursor-grabbing flex-shrink-0 leading-none self-center text-[13px] -ml-1"
        >
          ⋮⋮
        </button>
        <div className="flex-1 min-w-0 pr-5">
          <div className="flex items-start gap-1.5">
            <span className="w-2 h-2 mt-1.5 rounded-full flex-shrink-0" style={{ background: activity.color }} />
            <div className="font-medium text-sm text-ink break-words">{activity.activity.name}</div>
          </div>
          {activity.activity.organization?.name &&
            activity.activity.organization.name !== activity.activity.name &&
            activity.activity.organization.name !== "User-submitted" && (
              <div className="mt-0.5 pl-3.5 font-sans text-[11px] text-ink-2 break-words">
                {activity.activity.organization.name}
              </div>
            )}
          <div className="mt-1 pl-3.5 flex items-center gap-2 font-sans text-[10px] uppercase tracking-wide text-ink-2">
            {activity.plannerEntryCount > 0 && <span>{activity.plannerEntryCount}x</span>}
            {activity.activity.verified && <span className="text-[#5fc39c]">verified</span>}
          </div>
        </div>
      </div>
      <button
        type="button"
        aria-label={`Remove ${activity.activity.name}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onRemoveClick();
        }}
        className="absolute top-0.5 right-0.5 w-8 h-8 flex items-center justify-center rounded-full text-ink-3 hover:text-[#ef8c8f] hover:bg-[#fdebec] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-sm"
      >
        ✕
      </button>
    </div>
  );
}
