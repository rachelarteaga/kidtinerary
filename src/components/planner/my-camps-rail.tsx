"use client";

import { useState, useTransition, useMemo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { removeCampFromShortlist } from "@/lib/actions";
import type { UserCampWithActivity } from "@/lib/queries";

interface Props {
  camps: UserCampWithActivity[];
  onChipClick: (camp: UserCampWithActivity) => void;
  onAddClick: () => void;
  onChanged?: () => void;
}

export function MyCampsRail({ camps, onChipClick, onAddClick, onChanged }: Props) {
  const [pendingRemove, setPendingRemove] = useState<{
    userCampId: string;
    name: string;
    entryCount: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmRemove() {
    if (!pendingRemove) return;
    startTransition(async () => {
      const result = await removeCampFromShortlist(pendingRemove.userCampId);
      if (result.error) {
        alert(result.error);
        return;
      }
      setPendingRemove(null);
      onChanged?.();
    });
  }

  return (
    <aside className="w-full md:w-80 shrink-0 md:h-full md:overflow-y-auto md:flex md:flex-col bg-[#dfecf5] md:border-r md:border-ink px-6 sm:px-8 lg:px-10 pt-[22px] pb-4">
      <h2 className="font-display font-extrabold text-lg text-ink tracking-tight mb-3 flex-shrink-0">My camps</h2>

      <button
        onClick={onAddClick}
        className="w-full mb-3 rounded-lg border border-dashed border-ink-3 text-ink-2 hover:border-ink hover:text-ink transition-colors font-sans text-[11px] uppercase tracking-wide py-2 flex-shrink-0"
      >
        + Add camp
      </button>

      <div className="space-y-2">
        {camps.length === 0 && (
          <p className="text-sm text-ink-3 italic">Nothing yet — add one above.</p>
        )}
        {camps.map((c) => (
          <DraggableCampItem
            key={c.id}
            camp={c}
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
          <div className="absolute inset-0 bg-ink/40" onClick={() => setPendingRemove(null)} />
          <div className="relative bg-surface rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-display font-extrabold text-xl text-ink mb-2">Remove {pendingRemove.name}?</h3>
            <p className="text-sm text-ink-2 mb-4 leading-relaxed">
              {pendingRemove.entryCount > 0 ? (
                <>
                  This will remove {pendingRemove.name} from your My Camps list AND delete{" "}
                  <strong>{pendingRemove.entryCount}</strong> planner entr
                  {pendingRemove.entryCount === 1 ? "y" : "ies"} across your weeks.
                  This cannot be undone.
                </>
              ) : (
                <>This will remove {pendingRemove.name} from your My Camps list.</>
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
    </aside>
  );
}

function DraggableCampItem({
  camp,
  onClick,
  onRemoveClick,
}: {
  camp: UserCampWithActivity;
  onClick: () => void;
  onRemoveClick: () => void;
}) {
  const data = useMemo(
    () => ({
      type: "camp" as const,
      userCampId: camp.id,
      activityId: camp.activity.id,
      name: camp.activity.name,
      color: camp.color,
    }),
    [camp.id, camp.activity.id, camp.activity.name, camp.color]
  );
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `camp-${camp.id}`,
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
          aria-label={`Drag ${camp.activity.name}`}
          onClick={(e) => e.stopPropagation()}
          className="text-ink-3 hover:text-ink cursor-grab active:cursor-grabbing flex-shrink-0 leading-none self-center text-[13px] -ml-1"
        >
          ⋮⋮
        </button>
        <div className="flex-1 min-w-0 pr-5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: camp.color }} />
            <div className="font-medium text-sm text-ink break-words">{camp.activity.name}</div>
          </div>
          {camp.activity.organization?.name && (
            <div className="mt-0.5 pl-3.5 text-[11px] text-ink-2 truncate">
              {camp.activity.organization.name}
            </div>
          )}
          <div className="mt-1 pl-3.5 flex items-center gap-2 font-sans text-[10px] uppercase tracking-wide text-ink-2">
            {camp.plannerEntryCount > 0 && <span>{camp.plannerEntryCount}x</span>}
            {camp.activity.verified && <span className="text-[#5fc39c]">verified</span>}
          </div>
        </div>
      </div>
      <button
        type="button"
        aria-label={`Remove ${camp.activity.name}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onRemoveClick();
        }}
        className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full text-ink-3 hover:text-[#ef8c8f] hover:bg-[#fdebec] opacity-0 group-hover:opacity-100 transition-opacity text-xs"
      >
        ✕
      </button>
    </div>
  );
}
