"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { addChild, updateChild } from "@/lib/actions";
import { CATEGORIES, type Category } from "@/lib/constants";
import { categoryLabel } from "@/lib/format";

interface ChildFormProps {
  editingChild?: {
    id: string;
    name: string;
    birth_date: string;
    interests: string[];
  } | null;
  onDone: () => void;
  /** Called after a brand-new child is created, before onDone. Not called when editing. */
  onCreated?: (childId: string) => Promise<void> | void;
  /** When true, the form does not render its own heading (useful when embedded in a modal that already has one). */
  hideHeading?: boolean;
}

export function ChildForm({ editingChild, onDone, onCreated, hideHeading = false }: ChildFormProps) {
  const [name, setName] = useState(editingChild?.name ?? "");
  const [birthDate, setBirthDate] = useState(editingChild?.birth_date ?? "");
  const [interests, setInterests] = useState<Category[]>(
    (editingChild?.interests as Category[]) ?? []
  );
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function toggleInterest(cat: Category) {
    setInterests((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function handleSubmit() {
    if (!name.trim()) {
      toast("Please enter a name", "error");
      return;
    }
    if (!birthDate) {
      toast("Please enter a birth date", "error");
      return;
    }

    startTransition(async () => {
      const result = editingChild
        ? await updateChild(editingChild.id, name.trim(), birthDate, interests)
        : await addChild(name.trim(), birthDate, interests);

      if (result.error) {
        toast(result.error, "error");
        return;
      }

      toast(
        editingChild
          ? `${name}'s profile has been updated`
          : `${name} has been added!`,
        "success"
      );

      // Only fires on create, and only if the action returned an id.
      if (!editingChild && onCreated && "childId" in result && result.childId) {
        await onCreated(result.childId);
      }

      onDone();
    });
  }

  return (
    <div className="bg-surface rounded-2xl border border-ink-3 p-5">
      {!hideHeading && (
        <h3 className="font-display font-extrabold text-xl mb-4">
          {editingChild ? `Edit ${editingChild.name}` : "Add a kid"}
        </h3>
      )}

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block font-sans text-[10px] uppercase tracking-wide text-ink-2 mb-1.5">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First name"
            className="w-full px-3 py-2 rounded-lg border border-ink-3 bg-surface/50 text-ink placeholder:text-ink-3 text-sm focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/30"
          />
        </div>

        {/* Birth date */}
        <div>
          <label className="block font-sans text-[10px] uppercase tracking-wide text-ink-2 mb-1.5">
            Birth Date
          </label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-ink-3 bg-surface/50 text-ink text-sm focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/30"
          />
        </div>

        {/* Interests */}
        <div>
          <label className="block font-sans text-[10px] uppercase tracking-wide text-ink-2 mb-1.5">
            Interests
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const isSelected = interests.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleInterest(cat)}
                  className={`px-3 py-1.5 rounded-full font-sans text-[10px] uppercase tracking-wide transition-colors ${
                    isSelected
                      ? "bg-ink/15 text-ink border border-ink/30"
                      : "bg-ink/5 text-ink-2 border border-transparent hover:border-ink-3"
                  }`}
                >
                  {categoryLabel(cat)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <Button variant="ghost" onClick={onDone} className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isPending} className="flex-1">
          {isPending ? "Saving..." : editingChild ? "Save Changes" : "Add Kid"}
        </Button>
      </div>
    </div>
  );
}
