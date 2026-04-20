"use client";

import { useRef, useState, useTransition } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { KidAvatar } from "./kid-avatar";
import { updateChildAvatar } from "@/lib/actions";
import { useRouter } from "next/navigation";

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
    borderLeftColor: child.color,
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const router = useRouter();

  function handleAvatarClick(e: React.MouseEvent) {
    e.stopPropagation();
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setUploadError(null);
    startTransition(async () => {
      const result = await updateChildAvatar(child.id, formData);
      if (result.error) {
        setUploadError(result.error);
        return;
      }
      router.refresh();
    });
    // Reset so selecting the same file again still triggers change
    e.target.value = "";
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-driftwood/30 border-l-4 rounded-lg px-2.5 py-2 flex items-center gap-2 relative"
    >
      <button
        type="button"
        onClick={handleAvatarClick}
        disabled={isPending}
        className="relative group flex-shrink-0"
        aria-label={`Change avatar for ${child.name}`}
      >
        <KidAvatar name={child.name} color={child.color} avatarUrl={child.avatar_url} size={32} />
        <span className="absolute inset-0 rounded-full bg-bark/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] uppercase tracking-wide transition-opacity">
          {isPending ? "…" : "Edit"}
        </span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-base text-bark truncate leading-tight">{child.name}</div>
        <div className="font-mono text-[10px] uppercase tracking-wide text-stone">{ageYears} yrs</div>
      </div>

      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="text-stone/60 hover:text-stone cursor-grab active:cursor-grabbing flex-shrink-0 px-1"
      >
        ⋮⋮
      </button>

      {uploadError && (
        <div className="absolute -bottom-6 left-0 right-0 text-[10px] text-red-600 text-center">
          {uploadError}
        </div>
      )}
    </div>
  );
}
