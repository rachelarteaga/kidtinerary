"use client";

import { useState, useTransition } from "react";
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
  };
  onEdit: (child: { id: string; name: string; birth_date: string; interests: string[] }) => void;
}

export function ChildCard({ child, onEdit }: ChildCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const { toast } = useToast();

  const age = Math.floor(
    (new Date().getTime() - new Date(child.birth_date + "T00:00:00").getTime()) /
      (365.25 * 24 * 60 * 60 * 1000)
  );

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
    <div className="bg-surface rounded-2xl border border-ink-3 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-display font-extrabold text-xl">{child.name}</h3>
          <p className="font-sans text-[10px] uppercase tracking-wide text-ink-2">
            Age {age}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(child)}
            className="font-sans text-[10px] uppercase tracking-wide text-ink-2 hover:text-ink underline underline-offset-2"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Interests */}
      {child.interests?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {child.interests.map((interest) => (
            <Tag key={interest} type="category" label={categoryLabel(interest)} />
          ))}
        </div>
      )}

      {/* Planner summary stub */}
      <div className="bg-surface/50 rounded-lg p-3">
        <p className="font-sans text-[10px] uppercase tracking-wide text-ink-2">
          Planner coming soon
        </p>
      </div>

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
        <button
          onClick={() => setShowConfirm(true)}
          className="mt-4 font-sans text-[10px] uppercase tracking-wide text-ink-3 hover:text-[#ef8c8f]"
        >
          Remove profile
        </button>
      )}
    </div>
  );
}
