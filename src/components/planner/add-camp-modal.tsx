"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { submitCamp } from "@/lib/actions";

interface ActivityHit {
  id: string;
  name: string;
  verified: boolean;
  organization: { name: string } | null;
}

interface OrgHit {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  plannerId: string;
  scope: { childId: string | null; weekStart: string | null };
  shareCampsDefault: boolean;
  onSubmitted: (result: {
    jobId?: string;
    userCampId?: string;
    plannerEntryId?: string | null;
    url?: string;
  }) => void;
  embedded?: boolean;
}

export function AddCampModal({ open, onClose, plannerId, scope, shareCampsDefault, onSubmitted, embedded = false }: Props) {
  const [orgName, setOrgName] = useState("");
  const [campName, setCampName] = useState("");
  const [url, setUrl] = useState("");
  const [consent, setConsent] = useState(shareCampsDefault);
  const [orgHits, setOrgHits] = useState<OrgHit[]>([]);
  const [campHits, setCampHits] = useState<ActivityHit[]>([]);
  const [pickedActivityId, setPickedActivityId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setOrgName("");
      setCampName("");
      setUrl("");
      setConsent(shareCampsDefault);
      setOrgHits([]);
      setCampHits([]);
      setPickedActivityId(undefined);
      setError(null);
      setTimeout(() => urlRef.current?.focus(), 50);
    }
  }, [open, shareCampsDefault]);

  useEffect(() => {
    if (orgName.trim().length < 2) { setOrgHits([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/organizations/search?q=${encodeURIComponent(orgName.trim())}`, { cache: "no-store" });
      if (res.ok) setOrgHits((await res.json()).results ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [orgName]);

  useEffect(() => {
    if (campName.trim().length < 2) { setCampHits([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/activities/search?q=${encodeURIComponent(campName.trim())}`, { cache: "no-store" });
      if (res.ok) setCampHits((await res.json()).results ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [campName]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      activityId: pickedActivityId,
      orgName: orgName.trim() || undefined,
      campName: campName.trim() || undefined,
      url: url.trim() || undefined,
      shared: consent,
    };
    startTransition(async () => {
      const result = await submitCamp(payload, {
        plannerId,
        childId: scope.childId ?? undefined,
        weekStart: scope.weekStart ?? undefined,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.jobId) {
        fetch("/api/scrape-jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: result.jobId }),
        }).catch(() => {});
      }
      onSubmitted({ ...result, url: payload.url });
      onClose();
    });
  }

  function handlePickCamp(hit: ActivityHit) {
    setCampName(hit.name);
    if (hit.organization) setOrgName(hit.organization.name);
    setPickedActivityId(hit.id);
    setCampHits([]);
  }

  function handlePickOrg(hit: OrgHit) {
    setOrgName(hit.name);
    setOrgHits([]);
  }

  const canSubmit =
    !!pickedActivityId ||
    !!url.trim() ||
    (!!orgName.trim() && !!campName.trim());

  const body = (
    <>
      <h2 className="font-display font-extrabold text-2xl mb-1">Add a camp</h2>
      <p className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-4">
        Drop a URL and we&apos;ll fill in the rest — or type it in manually
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="font-sans text-[10px] uppercase tracking-widest text-ink-2 block mb-1">URL</label>
          <input
            ref={urlRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://sciencecamp.com/summer"
            className="w-full bg-surface border border-ink rounded-lg px-4 py-2.5 text-ink focus:outline-none focus:border-ink"
            autoComplete="off"
          />
          <p className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mt-1.5">
            We&apos;ll populate the rest of the details for you.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-ink-3" />
          <span className="font-sans text-[10px] uppercase tracking-widest text-ink-2">OR</span>
          <div className="flex-1 border-t border-ink-3" />
        </div>

        <div>
          <label className="font-sans text-[10px] uppercase tracking-widest text-ink-2 block mb-1">Organization</label>
          <input
            value={orgName}
            onChange={(e) => { setOrgName(e.target.value); setPickedActivityId(undefined); }}
            placeholder="YMCA of the Triangle"
            className="w-full bg-surface border border-ink rounded-lg px-4 py-2.5 text-ink focus:outline-none focus:border-ink"
            autoComplete="off"
          />
          {orgHits.length > 0 && (
            <div className="mt-1 border border-ink-3 rounded-lg bg-surface overflow-hidden">
              {orgHits.map((h) => (
                <button
                  type="button"
                  key={h.id}
                  onClick={() => handlePickOrg(h)}
                  className="w-full text-left px-3 py-2 hover:bg-ink-3/10 border-b border-ink-3/20 last:border-b-0 text-sm"
                >
                  {h.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="font-sans text-[10px] uppercase tracking-widest text-ink-2 block mb-1">Camp name</label>
          <input
            value={campName}
            onChange={(e) => { setCampName(e.target.value); setPickedActivityId(undefined); }}
            placeholder="Camp Kanata"
            className="w-full bg-surface border border-ink rounded-lg px-4 py-2.5 text-ink focus:outline-none focus:border-ink"
            autoComplete="off"
          />
          {campHits.length > 0 && (
            <div className="mt-1 border border-ink-3 rounded-lg bg-surface overflow-hidden">
              {campHits.map((h) => (
                <button
                  type="button"
                  key={h.id}
                  onClick={() => handlePickCamp(h)}
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
        </div>

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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="font-sans text-[11px] uppercase tracking-widest px-4 py-2 text-ink-2 hover:text-ink">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || !canSubmit}
            className="font-sans text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-ink text-ink-inverse hover:bg-ink/90 disabled:opacity-50"
          >
            {isPending ? "Adding…" : "Add camp"}
          </button>
        </div>
      </form>
    </>
  );

  if (embedded) return body;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink/40 cursor-pointer" onClick={onClose} />
      <div className="relative bg-base rounded-2xl shadow-xl w-full max-w-md p-6">
        {body}
      </div>
    </div>
  );
}
