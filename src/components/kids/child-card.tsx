"use client";

import { useRef, useEffect, useState, useTransition } from "react";
import { KidAvatar } from "@/components/planner/kid-avatar";
import { AvatarEditorModal } from "@/components/planner/avatar-editor-modal";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { deleteChild } from "@/lib/actions";
import { categoryLabel } from "@/lib/format";

interface ChildCardProps {
  child: {
    id: string;
    name: string;
    birth_date: string;
    interests: string[];
    avatar_url: string | null;
  };
  index: number;
  onEdit: (child: { id: string; name: string; birth_date: string; interests: string[]; avatar_url: string | null }) => void;
}

export function ChildCard({ child, index, onEdit }: ChildCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const { toast } = useToast();

  const age = Math.floor(
    (new Date().getTime() - new Date(child.birth_date + "T00:00:00").getTime()) /
      (365.25 * 24 * 60 * 60 * 1000)
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickedImageUrl, setPickedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (pickedImageUrl) URL.revokeObjectURL(pickedImageUrl);
    };
  }, [pickedImageUrl]);

  function handleAvatarClick(e: React.MouseEvent) {
    e.stopPropagation();
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPickedImageUrl(url);
    e.target.value = "";
  }

  function handleCloseEditor() {
    if (pickedImageUrl) URL.revokeObjectURL(pickedImageUrl);
    setPickedImageUrl(null);
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteChild(child.id);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(`${child.name}'s profile has been removed`, "success");
      setShowConfirm(false);
    });
  }

  return (
    <>
      <div className="bg-surface rounded-2xl border border-ink-3 p-5">
        <div className="flex items-center gap-3 mb-3">
          <button
            type="button"
            onClick={() => onEdit(child)}
            className="relative group flex-shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            aria-label={`Edit ${child.name}'s profile`}
          >
            <KidAvatar name={child.name} index={index} avatarUrl={child.avatar_url} size={56} />
            <span className="absolute inset-0 rounded-full bg-ink/45 opacity-0 sm:group-hover:opacity-100 flex items-center justify-center text-white text-[9px] uppercase tracking-wide font-sans transition-opacity">
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
            <h3 className="font-display font-extrabold text-xl">{child.name}</h3>
            <p className="font-sans text-[10px] uppercase tracking-wide text-ink-2">
              Age {age}
            </p>
          </div>
          <button
            type="button"
            onClick={handleAvatarClick}
            aria-label={`Change photo for ${child.name}`}
            className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full text-ink-2 hover:text-ink hover:bg-ink/5"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          </button>
        </div>

        {/* Interests */}
        {child.interests?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {child.interests.map((interest) => (
              <Tag key={interest} type="category" label={categoryLabel(interest)} />
            ))}
          </div>
        )}

        {/* Delete */}
        {showConfirm ? (
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-ink-3">
            <p className="text-sm text-ink-2 flex-1">Remove {child.name}&apos;s profile?</p>
            <Button variant="ghost" onClick={() => setShowConfirm(false)} disabled={isPending}>
              Cancel
            </Button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-full font-sans text-xs uppercase tracking-widest px-4 py-2 bg-[#ef8c8f] text-white hover:bg-[#e87073] transition-colors disabled:opacity-50"
            >
              {isPending ? "Removing..." : "Remove"}
            </button>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={() => onEdit(child)}
              className="font-sans text-[11px] uppercase tracking-wide text-ink-2 hover:text-ink underline underline-offset-2"
            >
              Edit profile
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              className="font-sans text-[11px] uppercase tracking-wide text-ink-3 hover:text-[#ef8c8f]"
            >
              Remove profile
            </button>
          </div>
        )}
      </div>
      {pickedImageUrl && (
        <AvatarEditorModal
          open={true}
          onClose={handleCloseEditor}
          childId={child.id}
          childName={child.name}
          imageUrl={pickedImageUrl}
        />
      )}
    </>
  );
}
