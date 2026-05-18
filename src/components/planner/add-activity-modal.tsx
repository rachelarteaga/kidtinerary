"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { submitActivity } from "@/lib/actions";
import { US_STATES } from "@/lib/canonical/us-states";

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
  /** Optional — omit when adding from /catalog (no planner context). */
  plannerId?: string;
  /** Optional — omit when adding from /catalog. Without it, no planner_entry is created. */
  scope?: { childId: string | null; weekStart: string | null };
  /** @deprecated Carried for prop-signature compatibility while the
   *  "share with directory" concept is being removed. No longer used. */
  shareCampsDefault: boolean;
  /** Pre-fill the city field from the user's profile when available. */
  defaultCity?: string | null;
  /** Pre-fill the state field from the user's profile when available. */
  defaultState?: string | null;
  onSubmitted: (result: {
    jobId?: string;
    userCampId?: string;
    plannerEntryId?: string | null;
    url?: string;
  }) => void;
  embedded?: boolean;
}

export function AddActivityModal({
  open,
  onClose,
  plannerId,
  scope,
  defaultCity,
  defaultState,
  onSubmitted,
  embedded = false,
}: Props) {
  const [orgName, setOrgName] = useState("");
  const [activityName, setActivityName] = useState("");
  const [url, setUrl] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [online, setOnline] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [orgHits, setOrgHits] = useState<OrgHit[]>([]);
  const [activityHits, setActivityHits] = useState<ActivityHit[]>([]);
  const [recentCities, setRecentCities] = useState<string[]>([]);
  const [pickedActivityId, setPickedActivityId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setOrgName("");
      setActivityName("");
      setUrl("");
      setCity(defaultCity ?? "");
      setStateCode(defaultState ?? "");
      setOnline(false);
      setIsPrivate(false);
      setOrgHits([]);
      setActivityHits([]);
      setPickedActivityId(undefined);
      setError(null);
      // Pull recent cities so the datalist has typeahead options on open.
      fetch("/api/cities/recent", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { cities: [] }))
        .then((d) => setRecentCities(Array.isArray(d.cities) ? d.cities : []))
        .catch(() => {});
      setTimeout(() => urlRef.current?.focus(), 50);
    }
  }, [open, defaultCity, defaultState]);

  useEffect(() => {
    if (orgName.trim().length < 2) { setOrgHits([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/organizations/search?q=${encodeURIComponent(orgName.trim())}`, { cache: "no-store" });
      if (res.ok) setOrgHits((await res.json()).results ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [orgName]);

  useEffect(() => {
    if (activityName.trim().length < 2) { setActivityHits([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/activities/search?q=${encodeURIComponent(activityName.trim())}`, { cache: "no-store" });
      if (res.ok) setActivityHits((await res.json()).results ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [activityName]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const region = online
      ? ({ online: true } as const)
      : ({ city: city.trim(), state: stateCode.trim() } as const);
    const payload = {
      activityId: pickedActivityId,
      orgName: orgName.trim() || undefined,
      campName: activityName.trim() || undefined,
      url: url.trim() || undefined,
      region,
      private: isPrivate,
    };
    startTransition(async () => {
      const result = await submitActivity(payload, {
        plannerId,
        childId: scope?.childId ?? undefined,
        weekStart: scope?.weekStart ?? undefined,
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

  function handlePickActivity(hit: ActivityHit) {
    setActivityName(hit.name);
    if (hit.organization) setOrgName(hit.organization.name);
    setPickedActivityId(hit.id);
    setActivityHits([]);
  }

  function handlePickOrg(hit: OrgHit) {
    setOrgName(hit.name);
    setOrgHits([]);
  }

  // Picking an existing activity from autocomplete short-circuits the region
  // requirement — the existing row already has its own fingerprint/region.
  const regionOk = !!pickedActivityId || online || (!!city.trim() && !!stateCode.trim());
  const inputOk =
    !!pickedActivityId ||
    !!url.trim() ||
    (!!orgName.trim() && !!activityName.trim());
  const canSubmit = regionOk && inputOk;

  const body = (
    <>
      <h2 className="font-display font-extrabold text-2xl mb-1">Add an activity</h2>
      <p className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-4">
        Tell us where it&apos;s held, then drop a URL or fill in the details
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Region: city + state OR online toggle. Required for new submissions. */}
        <div>
          <label className="font-sans text-[10px] uppercase tracking-widest text-ink-2 block mb-1">
            Where is it held?
          </label>
          <div className="flex gap-2">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Westport"
              disabled={online || !!pickedActivityId}
              list="recent-cities"
              className="flex-1 bg-surface border border-ink rounded-lg px-4 py-2.5 text-ink focus:outline-none focus:border-ink disabled:opacity-50"
              autoComplete="off"
            />
            <select
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value)}
              disabled={online || !!pickedActivityId}
              className="bg-surface border border-ink rounded-lg px-3 py-2.5 text-ink focus:outline-none focus:border-ink disabled:opacity-50"
            >
              <option value="">State</option>
              {US_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code}
                </option>
              ))}
            </select>
          </div>
          <datalist id="recent-cities">
            {recentCities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <label className="flex items-center gap-2 cursor-pointer mt-2">
            <input
              type="checkbox"
              checked={online}
              onChange={(e) => setOnline(e.target.checked)}
              disabled={!!pickedActivityId}
            />
            <span className="text-sm text-ink">This activity is online</span>
          </label>
        </div>

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
          <label className="font-sans text-[10px] uppercase tracking-widest text-ink-2 block mb-1">Activity name</label>
          <input
            value={activityName}
            onChange={(e) => { setActivityName(e.target.value); setPickedActivityId(undefined); }}
            placeholder="Camp Kanata"
            className="w-full bg-surface border border-ink rounded-lg px-4 py-2.5 text-ink focus:outline-none focus:border-ink"
            autoComplete="off"
          />
          {activityHits.length > 0 && (
            <div className="mt-1 border border-ink-3 rounded-lg bg-surface overflow-hidden">
              {activityHits.map((h) => (
                <button
                  type="button"
                  key={h.id}
                  onClick={() => handlePickActivity(h)}
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
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm text-ink">
            Keep this one private. Won&apos;t appear in any catalog or be matched against other parents&apos; activities.
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
            {isPending ? "Adding…" : "Add activity"}
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
