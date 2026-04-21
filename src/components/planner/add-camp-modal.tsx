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
  /** `url` is set when the user submitted a URL; the parent opens the scrape-confirm drawer in that case. */
  onSubmitted: (result: {
    jobId?: string;
    userCampId?: string;
    plannerEntryId?: string | null;
    url?: string;
  }) => void;
  /** When true, skip the outer modal backdrop/wrapper — parent is responsible for chrome. */
  embedded?: boolean;
}

function isUrlLike(input: string) {
  return /^https?:\/\//i.test(input.trim());
}

export function AddCampModal({ open, onClose, scope, shareCampsDefault, onSubmitted, embedded = false }: Props) {
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
    const trimmed = input.trim();
    if (!trimmed) return;
    const urlInput = isUrlLike(trimmed) ? trimmed : undefined;
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
      onSubmitted({ ...result, url: urlInput });
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

  const body = (
    <>
      <h2 className="font-display font-extrabold text-2xl mb-1">Add a camp</h2>
      <p className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-4">
        Tell us the camp name or drop a URL
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="YMCA Camp Kanata · sciencecamp.com · Art Studio Summer"
            className="w-full bg-surface border border-ink rounded-lg px-4 py-2.5 text-ink focus:outline-none focus:border-ink transition-colors"
            autoComplete="off"
          />
          <p className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mt-1.5">
            Got a link handy? Paste it for the best match.
          </p>
        </div>

        {hits.length > 0 && (
          <div className="border border-ink-3 rounded-lg bg-surface overflow-hidden">
            {hits.map((h) => (
              <button
                type="button"
                key={h.id}
                onClick={() => handleHitClick(h)}
                className="w-full text-left px-3 py-2 hover:bg-ink-3/10 border-b border-ink-3/20 last:border-b-0"
              >
                <div className="font-medium text-sm text-ink">
                  {h.name} {h.verified && <span className="font-sans text-[9px] text-[#5fc39c] uppercase tracking-wide ml-1">verified</span>}
                </div>
                {h.organization && (
                  <div className="font-sans text-[10px] uppercase tracking-wide text-ink-2">{h.organization.name}</div>
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
          <span className="text-sm text-ink">
            Share this camp with Kidtinerary&apos;s directory so other parents can find it. We&apos;ll verify the details before publishing.
          </span>
        </label>

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="font-sans text-[11px] uppercase tracking-widest px-4 py-2 text-ink-2 hover:text-ink">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || !input.trim()}
            className="font-sans text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-ink text-ink-inverse hover:bg-ink/90 disabled:opacity-50"
          >
            {isPending ? "Adding…" : "Add to planner"}
          </button>
        </div>
      </form>
    </>
  );

  if (embedded) return body;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative bg-base rounded-2xl shadow-xl w-full max-w-md p-6">
        {body}
      </div>
    </div>
  );
}
