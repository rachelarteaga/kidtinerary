"use client";

import { useState, useTransition } from "react";
import { updateProfileName } from "@/lib/actions";
import { validateProfileName } from "@/lib/actions-profile-name-validation";
import { Button } from "@/components/ui/button";

interface Props {
  defaultFirst: string;
  defaultLast: string;
  onComplete: (name: { firstName: string; lastName: string }) => void;
}

export function NameStep({ defaultFirst, defaultLast, onComplete }: Props) {
  const [firstName, setFirstName] = useState(defaultFirst);
  const [lastName, setLastName] = useState(defaultLast);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleNext() {
    const v = validateProfileName({ firstName, lastName });
    if (v.error) {
      setError(v.error);
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await updateProfileName({ firstName, lastName });
      if (r.error) {
        setError(r.error);
        return;
      }
      onComplete({ firstName: firstName.trim(), lastName: lastName.trim() });
    });
  }

  const disabled = !firstName.trim() || !lastName.trim() || isPending;

  return (
    <div>
      <h2 className="font-display font-extrabold text-2xl mb-2">What&apos;s your name?</h2>
      <p className="text-ink-2 mb-6">
        We&apos;ll use this so the people you share planners with know who you are.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <label className="block">
          <span className="block font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-1">First name</span>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            className="w-full bg-surface border border-ink rounded-lg px-4 py-2.5 text-ink focus:outline-none focus:border-ink transition-colors"
          />
        </label>
        <label className="block">
          <span className="block font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-1">Last name</span>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            className="w-full bg-surface border border-ink rounded-lg px-4 py-2.5 text-ink focus:outline-none focus:border-ink transition-colors"
          />
        </label>
      </div>
      {error && <p className="text-sm text-[#ef8c8f] mb-3">{error}</p>}
      <Button onClick={handleNext} disabled={disabled} className="w-full">
        {isPending ? "Saving…" : "Next"}
      </Button>
    </div>
  );
}
