"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addActivityToCatalog } from "@/lib/actions";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded?: (userActivityId: string) => void;
}

export function AddActivityToCatalogModal({ open, onClose, onAdded }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await addActivityToCatalog({
        name: name || null,
        url: url || null,
        organizationName: null,
        description: null,
        categories: [],
        ageMin: null,
        ageMax: null,
      });
      if (result.error || !result.userActivityId) {
        setError(result.error ?? "Could not add activity.");
        return;
      }
      onAdded?.(result.userActivityId);
      // Reset + close + refresh so the new row shows.
      setName("");
      setUrl("");
      onClose();
      router.refresh();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add activity to catalog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl max-w-md w-full border border-ink-3 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display font-extrabold text-xl text-ink mb-1">Add to catalog</h3>
        <p className="font-sans text-xs text-ink-2 mb-4">
          Paste a URL, type a name, or both. You can edit details after.
        </p>

        <div className="space-y-3">
          <div>
            <label className="font-sans text-[10px] uppercase tracking-widest text-ink-2 block mb-1">
              Name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Camp Galileo"
              maxLength={100}
              className="w-full bg-surface border border-ink rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-ink"
            />
          </div>
          <div>
            <label className="font-sans text-[10px] uppercase tracking-widest text-ink-2 block mb-1">
              URL (optional)
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://galileo-camps.com/summer-2026"
              className="w-full bg-surface border border-ink rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-ink"
            />
          </div>
        </div>

        {error && (
          <p className="font-sans text-xs text-[#c96164] mt-3">{error}</p>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="font-sans font-semibold text-[11px] uppercase tracking-widest px-3 py-1.5 text-ink-2 hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || (!name.trim() && !url.trim())}
            className="font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-ink text-ink-inverse hover:bg-[#333] border border-ink disabled:opacity-50"
          >
            {isPending ? "Adding…" : "Add to catalog"}
          </button>
        </div>
      </div>
    </div>
  );
}
