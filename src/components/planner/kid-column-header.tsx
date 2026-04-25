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
  index: number;
  ageYears: number;
  onRemove?: () => void;
  readOnly?: boolean;
}

export function KidColumnHeader({ child, index, ageYears, onRemove, readOnly = false }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: child.id,
    data: { type: "kid-column" },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
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

  // Read-only fast path: render a stripped-down, non-interactive header.
  if (readOnly) {
    return (
      <div className="bg-surface border border-ink rounded-lg px-2.5 py-2 flex items-center gap-2">
        <div className="flex-shrink-0">
          <KidAvatar name={child.name} index={index} avatarUrl={child.avatar_url} size={32} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-extrabold text-base text-ink truncate leading-tight">{child.name}</div>
          <div className="text-[11px] font-medium text-ink-2">{ageYears} yrs</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className="bg-surface border border-ink rounded-lg px-2.5 py-2 flex items-center gap-2 relative"
      >
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="text-ink-3 hover:text-ink cursor-grab active:cursor-grabbing flex-shrink-0 px-1"
        >
          ⋮⋮
        </button>

        <button
          type="button"
          onClick={handleAvatarClick}
          className="relative group flex-shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          aria-label={`Change photo for ${child.name}`}
        >
          <KidAvatar name={child.name} index={index} avatarUrl={child.avatar_url} size={32} />
          <span className="absolute inset-0 rounded-full bg-ink/55 opacity-0 sm:group-hover:opacity-100 flex items-center justify-center text-white text-[9px] uppercase tracking-wide font-sans transition-opacity">
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
          <div className="font-display font-extrabold text-base text-ink truncate leading-tight">{child.name}</div>
          <div className="text-[11px] font-medium text-ink-2">{ageYears} yrs</div>
        </div>

        {onRemove && (
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More options"
              className="text-ink-3 hover:text-ink px-1 leading-none"
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-ink rounded-lg shadow-[3px_3px_0_0_rgba(0,0,0,0.15)] p-1 min-w-[180px] z-20">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    if (
                      confirm(
                        `Remove ${child.name} from this planner? All their activities and blocks in this planner will also be deleted. ${child.name} stays in your profile.`
                      )
                    ) {
                      onRemove();
                    }
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[#fdebec] text-sm text-[#ef8c8f]"
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
