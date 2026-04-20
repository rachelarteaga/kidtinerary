"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { submitCamp } from "@/lib/actions";

interface AutocompleteHit {
  id: string;
  name: string;
  verified: boolean;
  organization: { name: string } | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  scope: { childId: string | null; weekStart: string | null };
  shareCampsDefault: boolean;
  onSubmitted: (result: { jobId?: string; userCampId?: string; plannerEntryId?: string | null }) => void;
}

export function AddCampModal({ open, onClose, scope, shareCampsDefault, onSubmitted }: Props) {
  const [input, setInput] = useState("");
  const [consent, setConsent] = useState(shareCampsDefault);
  const [hits, setHits] = useState<AutocompleteHit[]>([]);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInput("");
      setConsent(shareCampsDefault);
      setHits([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, shareCampsDefault]);

  useEffect(() => {
    if (input.trim().length < 2) { setHits([]); return; }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/activities/search?q=${encodeURIComponent(input.trim())}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setHits(data.results ?? []);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [input]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    startTransition(async () => {
      const result = await submitCamp(
        input,
        { childId: scope.childId ?? undefined, weekStart: scope.weekStart ?? undefined },
        consent
      );
      if (result.error) {
        alert(result.error);
        return;
      }
      if (result.jobId) {
        fetch("/api/scrape-jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: result.jobId }),
        }).catch(() => {});
      }
      onSubmitted(result);
      onClose();
    });
  }

  async function handleHitClick(hit: AutocompleteHit) {
    startTransition(async () => {
      const result = await submitCamp(
        hit.name,
        { childId: scope.childId ?? undefined, weekStart: scope.weekStart ?? undefined },
        consent
      );
      if (!result.error) { onSubmitted(result); onClose(); }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-bark/40" onClick={onClose} />
      <div className="relative bg-cream rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="font-serif text-2xl mb-1">Add a camp</h2>
        <p className="font-mono text-[10px] uppercase tracking-widest text-stone mb-4">
          Tell us the camp name or drop a URL
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="YMCA Camp Kanata · sciencecamp.com · Art Studio Summer"
              className="w-full bg-white border border-driftwood rounded-lg px-4 py-2.5 text-bark focus:outline-none focus:border-sunset transition-colors"
              autoComplete="off"
            />
            <p className="font-mono text-[10px] uppercase tracking-widest text-stone mt-1.5">
              Got a link handy? Paste it for the best match.
            </p>
          </div>

          {hits.length > 0 && (
            <div className="border border-driftwood/30 rounded-lg bg-white overflow-hidden">
              {hits.map((h) => (
                <button
                  type="button"
                  key={h.id}
                  onClick={() => handleHitClick(h)}
                  className="w-full text-left px-3 py-2 hover:bg-driftwood/10 border-b border-driftwood/20 last:border-b-0"
                >
                  <div className="font-medium text-sm text-bark">
                    {h.name} {h.verified && <span className="font-mono text-[9px] text-meadow uppercase tracking-wide ml-1">verified</span>}
                  </div>
                  {h.organization && (
                    <div className="font-mono text-[10px] uppercase tracking-wide text-stone">{h.organization.name}</div>
                  )}
                </button>
              ))}
            </div>
          )}

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-sm text-bark">
              Share this camp with Kidtinerary&apos;s directory so other parents can find it. We&apos;ll verify the details before publishing.
            </span>
          </label>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="font-mono text-[11px] uppercase tracking-widest px-4 py-2 text-stone hover:text-bark">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !input.trim()}
              className="font-mono text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-bark text-cream hover:bg-bark/90 disabled:opacity-50"
            >
              {isPending ? "Adding…" : "Add to planner"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
