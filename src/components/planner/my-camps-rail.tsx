"use client";

import { useDraggable } from "@dnd-kit/core";
import type { UserCampWithActivity } from "@/lib/queries";

interface Props {
  camps: UserCampWithActivity[];
  onChipClick: (camp: UserCampWithActivity) => void;
  onAddClick: () => void;
}

export function MyCampsRail({ camps, onChipClick, onAddClick }: Props) {
  return (
    <aside className="w-full md:w-60 shrink-0">
      <h2 className="font-mono text-[10px] uppercase tracking-widest text-stone mb-3">My camps</h2>

      <button
        onClick={onAddClick}
        className="w-full mb-3 rounded-lg border border-dashed border-driftwood/60 text-stone hover:border-bark hover:text-bark transition-colors font-mono text-[11px] uppercase tracking-wide py-2"
      >
        + Add camp
      </button>

      <div className="flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
        {camps.length === 0 && (
          <p className="text-sm text-driftwood italic">Nothing yet — add one above.</p>
        )}
        {camps.map((c) => (
          <DraggableCampItem key={c.id} camp={c} onClick={() => onChipClick(c)} />
        ))}
      </div>
    </aside>
  );
}

function DraggableCampItem({ camp, onClick }: { camp: UserCampWithActivity; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `camp-${camp.id}`,
    data: {
      type: "camp",
      userCampId: camp.id,
      activityId: camp.activity.id,
      name: camp.activity.name,
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`shrink-0 w-56 md:w-auto rounded-lg border bg-white p-2.5 cursor-grab active:cursor-grabbing select-none transition-opacity ${
        camp.activity.verified ? "border-meadow/30" : "border-driftwood/40"
      } ${isDragging ? "opacity-30" : "hover:border-bark"}`}
    >
      <div className="font-medium text-sm text-bark truncate">{camp.activity.name}</div>
      <div className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-stone">
        {camp.plannerEntryCount > 0 && <span>{camp.plannerEntryCount}x</span>}
        {camp.activity.verified && <span className="text-meadow">verified</span>}
      </div>
    </div>
  );
}
