"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export type KidDraft = { name: string; birthDate: string };

interface ChildStepProps {
  onComplete: (kids: KidDraft[]) => void;
}

const MAX_KIDS = 10;

export function ChildStep({ onComplete }: ChildStepProps) {
  const [kids, setKids] = useState<KidDraft[]>([]);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const atMax = kids.length >= MAX_KIDS;
  const canAdd = !atMax && name.trim().length > 0 && birthDate.length > 0;

  function addKid() {
    if (!canAdd) return;
    const trimmed = name.trim();
    const duplicate = kids.some(
      (k) => k.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      setAddError(`You already added a kid named ${trimmed}.`);
      return;
    }
    setAddError(null);
    setKids((prev) => [...prev, { name: trimmed, birthDate }]);
    setName("");
    setBirthDate("");
  }

  function removeKid(index: number) {
    setKids((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div>
      <h2 className="font-display font-extrabold text-2xl mb-2">Tell us about your kids</h2>
      <p className="text-ink-2 mb-6">
        Add up to {MAX_KIDS} kids. We&apos;ll find age-appropriate activities for each of them.
      </p>

      {kids.length > 0 && (
        <ul className="space-y-2 mb-6">
          {kids.map((kid, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border border-ink-3 bg-surface"
            >
              <div className="min-w-0">
                <div className="font-medium text-ink truncate">{kid.name}</div>
                <div className="text-xs text-ink-2">{kid.birthDate}</div>
              </div>
              <button
                type="button"
                onClick={() => removeKid(i)}
                className="font-sans text-[10px] uppercase tracking-widest text-ink-2 hover:text-ink"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {atMax ? (
        <p className="text-ink-2 mb-6 text-center">
          You&apos;ve added the max number of kids!
        </p>
      ) : (
        <div className="space-y-4 mb-4">
          <div>
            <label
              htmlFor="childName"
              className="block font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-1"
            >
              First Name
            </label>
            <input
              id="childName"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (addError) setAddError(null);
              }}
              placeholder="Emma"
              className="w-full bg-surface border border-ink rounded-lg px-4 py-2.5 text-ink focus:outline-none focus:border-ink transition-colors"
            />
          </div>
          <div>
            <label
              htmlFor="birthDate"
              className="block font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-1"
            >
              Birthday
            </label>
            <input
              id="birthDate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full bg-surface border border-ink rounded-lg px-4 py-2.5 text-ink focus:outline-none focus:border-ink transition-colors"
            />
          </div>
          <Button
            variant="ghost"
            onClick={addKid}
            disabled={!canAdd}
            className="w-full"
          >
            {kids.length === 0 ? "Add kid" : "Add another kid"}
          </Button>
          {addError && (
            <p className="text-sm text-[#ef8c8f]">{addError}</p>
          )}
        </div>
      )}

      <Button
        onClick={() => onComplete(kids)}
        disabled={kids.length === 0}
        className="w-full mt-2"
      >
        Next
      </Button>
    </div>
  );
}
