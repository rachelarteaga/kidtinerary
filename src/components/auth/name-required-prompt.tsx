"use client";

import { useEffect, useState, useTransition } from "react";
import { updateProfileName } from "@/lib/actions";
import { validateProfileName } from "@/lib/actions-profile-name-validation";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface Props {
  /** Optional pre-fill, e.g. when OAuth gave us first but not last. */
  defaultFirst?: string;
  defaultLast?: string;
  /** Short context line shown above the form. Keep it action-oriented. */
  reason: string;
  /** Called after the name is successfully saved. The caller should resume the action that triggered this prompt. */
  onComplete: () => void;
  /** Called when the user dismisses without saving. */
  onCancel: () => void;
}

export function NameRequiredPrompt({ defaultFirst = "", defaultLast = "", reason, onComplete, onCancel }: Props) {
  const [firstName, setFirstName] = useState(defaultFirst);
  const [lastName, setLastName] = useState(defaultLast);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  // Match the codebase's modal convention (see activity-preview-modal,
  // anchored-popover, status-picker-popover): Escape closes without saving.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validateProfileName({ firstName, lastName });
    if (v.error) {
      toast(v.error, "error");
      return;
    }
    startTransition(async () => {
      const r = await updateProfileName({ firstName, lastName });
      if (r.error) {
        toast(r.error, "error");
        return;
      }
      await createClient().auth.refreshSession();
      onComplete();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add your name"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onCancel}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-2xl max-w-md w-full border border-ink-3 overflow-hidden"
      >
        <header className="px-6 py-4 border-b border-ink-3">
          <h2 className="font-display font-extrabold text-lg">Add your name</h2>
          <p className="font-sans text-sm text-ink-2 mt-1">{reason}</p>
        </header>

        <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="font-sans text-[10px] uppercase tracking-wide text-ink-2">First name</span>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoFocus
              autoComplete="given-name"
              className="mt-1 w-full rounded-lg border border-ink-3 px-3 py-2 bg-surface"
            />
          </label>
          <label className="block">
            <span className="font-sans text-[10px] uppercase tracking-wide text-ink-2">Last name</span>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              autoComplete="family-name"
              className="mt-1 w-full rounded-lg border border-ink-3 px-3 py-2 bg-surface"
            />
          </label>
        </div>

        <footer className="px-6 py-4 border-t border-ink-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full border border-ink-3 text-ink-2 hover:bg-base"
          >
            Not now
          </button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Continue"}
          </Button>
        </footer>
      </form>
    </div>
  );
}
