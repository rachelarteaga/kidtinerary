"use client";

import { useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { KidAvatar } from "./kid-avatar";
import { AvatarEditorModal } from "./avatar-editor-modal";

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
  onRemove?: () => void;
}

export function KidColumnHeader({ child, ageYears, onRemove }: Props) {
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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Clean up the object URL when editor closes / component unmounts
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  function handleAvatarClick(e: React.MouseEvent) {
    e.stopPropagation();
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    // Reset so selecting the same file again still triggers change
    e.target.value = "";
  }

  function handleCloseEditor() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className="bg-white border border-driftwood/30 border-l-4 rounded-lg px-2.5 py-2 flex items-center gap-2 relative"
      >
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="text-stone/60 hover:text-stone cursor-grab active:cursor-grabbing flex-shrink-0 px-1"
        >
          ⋮⋮
        </button>

        <button
          type="button"
          onClick={handleAvatarClick}
          className="relative group flex-shrink-0"
          aria-label={`Change avatar for ${child.name}`}
        >
          <KidAvatar name={child.name} color={child.color} avatarUrl={child.avatar_url} size={32} />
          <span className="absolute inset-0 rounded-full bg-bark/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] uppercase tracking-wide transition-opacity">
            Edit
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

        {onRemove && (
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More options"
              className="text-stone/60 hover:text-stone px-1 leading-none"
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-driftwood/30 rounded-lg shadow-lg p-1 min-w-[180px] z-20">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    if (
                      confirm(
                        `Remove ${child.name} from this planner? All their camps and blocks in this planner will also be deleted. ${child.name} stays in your profile.`
                      )
                    ) {
                      onRemove();
                    }
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-red-50 text-sm text-red-600"
                >
                  Remove from planner
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {imageUrl && (
        <AvatarEditorModal
          open={true}
          onClose={handleCloseEditor}
          childId={child.id}
          childName={child.name}
          imageUrl={imageUrl}
        />
      )}
    </>
  );
}
