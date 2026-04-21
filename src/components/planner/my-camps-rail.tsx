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
    <aside className="w-full md:w-60 shrink-0 md:h-full md:overflow-y-auto md:flex md:flex-col">
      <h2 className="font-mono text-[10px] uppercase tracking-widest text-stone mb-3 flex-shrink-0">My camps</h2>

      <button
        onClick={onAddClick}
        className="w-full mb-3 rounded-lg border border-dashed border-driftwood/60 text-stone hover:border-bark hover:text-bark transition-colors font-mono text-[11px] uppercase tracking-wide py-2 flex-shrink-0"
      >
        + Add camp
      </button>

      <div className="space-y-2">
        {camps.length === 0 && (
          <p className="text-sm text-driftwood italic">Nothing yet — add one above.</p>
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
          <div className="absolute inset-0 bg-bark/40" onClick={() => setPendingRemove(null)} />
          <div className="relative bg-cream rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-serif text-xl text-bark mb-2">Remove {pendingRemove.name}?</h3>
            <p className="text-sm text-stone mb-4 leading-relaxed">
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
                className="font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 text-stone hover:text-bark"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemove}
                disabled={isPending}
                className="font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
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
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`group relative rounded-lg border bg-white p-2.5 cursor-grab active:cursor-grabbing select-none transition-all border-driftwood/40 ${isDragging ? "opacity-60 ring-2 ring-sunset/40" : "hover:border-bark"}`}
    >
      <div className="flex items-center gap-1.5 pr-5">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: camp.color }} />
        <div className="font-medium text-sm text-bark truncate">{camp.activity.name}</div>
      </div>
      <div className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-stone">
        {camp.plannerEntryCount > 0 && <span>{camp.plannerEntryCount}x</span>}
        {camp.activity.verified && <span className="text-meadow">verified</span>}
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
        className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full text-driftwood hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
      >
        ✕
      </button>
    </div>
  );
}
