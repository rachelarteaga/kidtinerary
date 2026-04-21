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
}

export function ChildForm({ editingChild, onDone, onCreated }: ChildFormProps) {
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
    <div className="bg-white rounded-2xl border border-driftwood/30 p-5">
      <h3 className="font-serif text-xl mb-4">
        {editingChild ? `Edit ${editingChild.name}` : "Add a child"}
      </h3>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wide text-stone mb-1.5">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First name"
            className="w-full px-3 py-2 rounded-lg border border-driftwood/50 bg-cream/50 text-bark placeholder:text-driftwood text-sm focus:outline-none focus:border-sunset focus:ring-1 focus:ring-sunset/30"
          />
        </div>

        {/* Birth date */}
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wide text-stone mb-1.5">
            Birth Date
          </label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-driftwood/50 bg-cream/50 text-bark text-sm focus:outline-none focus:border-sunset focus:ring-1 focus:ring-sunset/30"
          />
        </div>

        {/* Interests */}
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wide text-stone mb-1.5">
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
                  className={`px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wide transition-colors ${
                    isSelected
                      ? "bg-sunset/15 text-sunset border border-sunset/30"
                      : "bg-bark/5 text-stone border border-transparent hover:border-driftwood"
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
          {isPending ? "Saving..." : editingChild ? "Save Changes" : "Add Child"}
        </Button>
      </div>
    </div>
  );
}
