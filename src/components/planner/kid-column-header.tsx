"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { KidAvatar } from "./kid-avatar";

interface Child {
  id: string;
  name: string;
  birth_date: string;
  color: string;
  avatar_url: string | null;
}

interface Props {
  child: Child;
  ageYears: number;
}

export function KidColumnHeader({ child, ageYears }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: child.id,
    data: { type: "kid-column" },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-driftwood/30 rounded-xl p-3 text-center relative"
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="absolute top-2 right-2 text-stone/60 hover:text-stone cursor-grab active:cursor-grabbing"
      >
        ⋮⋮
      </button>
      <div className="flex justify-center mb-2">
        <KidAvatar name={child.name} color={child.color} avatarUrl={child.avatar_url} size={48} />
      </div>
      <div className="font-medium text-sm text-bark">{child.name}</div>
      <div className="font-mono text-[10px] uppercase tracking-wide text-stone">{ageYears} yrs</div>
      <div className="h-0.5 rounded-full mt-2" style={{ background: child.color }} />
    </div>
  );
}
