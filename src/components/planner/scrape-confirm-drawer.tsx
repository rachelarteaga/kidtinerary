"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ScrapeJobStatus, ScrapeConfidence } from "@/lib/supabase/types";
import { updateActivityFields, removeActivityFromShortlist } from "@/lib/actions";
import { CATEGORIES } from "@/lib/constants";

const CATEGORY_LABELS: Record<string, string> = {
  sports: "Sports",
  arts: "Arts",
  stem: "STEM",
  nature: "Nature",
  music: "Music",
  theater: "Theater",
  academic: "Academic",
  special_needs: "Special needs",
  religious: "Religious",
  swimming: "Swimming",
  cooking: "Cooking",
  language: "Language",
};

interface ScrapedSession {
  id: string;
  starts_at: string;
  ends_at: string;
  time_slot: string;
  hours_start: string | null;
  hours_end: string | null;
  is_sold_out: boolean;
}

interface ScrapedPrice {
  id: string;
  label: string;
  price_cents: number;
  price_unit: string;
  confidence: string;
}

interface ScrapedLocation {
  id: string;
  location_name: string | null;
  address: string;
}

interface ScrapedActivity {
  id: string;
  name: string;
  description: string | null;
  registration_url: string | null;
  source_url: string | null;
  age_min: number | null;
  age_max: number | null;
  indoor_outdoor: string;
  categories: string[];
  data_confidence: string;
  verified: boolean;
  organization: { id: string; name: string; website: string | null } | null;
  sessions: ScrapedSession[];
  prices: ScrapedPrice[];
  locations: ScrapedLocation[];
}

interface JobPayload {
  id: string;
  input: string;
  status: ScrapeJobStatus;
  activity_id: string | null;
  confidence: ScrapeConfidence | null;
  resolved_at: string | null;
}

interface Props {
  open: boolean;
  jobId: string | null;
  userCampId: string | null;
  inputUrl: string;
  scopeLabel: string | null;
  onClose: () => void;
}

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 40; // ~60s safety cap

function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatDateRange(starts_at: string, ends_at: string) {
  const start = new Date(starts_at + "T00:00:00");
  const end = new Date(ends_at + "T00:00:00");
  const sameMonth = start.getMonth() === end.getMonth();
  const startFmt = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endFmt = sameMonth
    ? end.toLocaleDateString("en-US", { day: "numeric" })
    : end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${startFmt} – ${endFmt}`;
}

function formatPrice(cents: number, unit: string) {
  const dollars = (cents / 100).toFixed(0);
  const unitLabel = unit === "per_week" ? "/ week" : unit === "per_day" ? "/ day" : unit === "per_session" ? "/ session" : unit === "per_block" ? "/ block" : "";
  return `$${dollars} ${unitLabel}`.trim();
}

function confidenceBadge(confidence: string) {
  switch (confidence) {
    case "verified":
      return { label: "Verified", className: "bg-[#5fc39c]/15 text-[#2f8f6b]" };
    case "scraped":
    case "high":
      return { label: "Scraped", className: "bg-[#eef1f4] text-ink-2" };
    case "llm_extracted":
    case "partial":
      return { label: "AI-extracted", className: "bg-hero/20 text-[#8a6b00]" };
    default:
      return { label: confidence, className: "bg-[#f4f4f4] text-ink-2" };
  }
}

export function ScrapeConfirmDrawer({ open, jobId, userCampId, inputUrl, scopeLabel, onClose }: Props) {
  const router = useRouter();
  const [job, setJob] = useState<JobPayload | null>(null);
  const [activity, setActivity] = useState<ScrapedActivity | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const attemptRef = useRef(0);

  const [draftCategories, setDraftCategories] = useState<string[] | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !jobId) return;
    setJob(null);
    setActivity(null);
    setPollError(null);
    setDraftCategories(null);
    initializedRef.current = false;
    attemptRef.current = 0;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (cancelled) return;
      attemptRef.current += 1;

      try {
        const res = await fetch(`/api/scrape-jobs/${jobId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        if (cancelled) return;

        setJob(data.job);
        if (data.activity) {
          setActivity(data.activity);
          if (!initializedRef.current) {
            setDraftCategories(data.activity.categories ?? []);
            initializedRef.current = true;
          }
        }

        if (data.job.status === "resolved" || data.job.status === "failed") {
          return;
        }
      } catch (err) {
        if (cancelled) return;
        console.error("scrape job poll error:", err);
        if (attemptRef.current >= 3) {
          setPollError("Couldn't reach the server. Try again in a moment.");
          return;
        }
      }

      if (attemptRef.current >= POLL_MAX_ATTEMPTS) {
        setPollError("This is taking longer than expected. We'll keep the camp in your shortlist and finish in the background.");
        return;
      }

      timer = setTimeout(tick, POLL_INTERVAL_MS);
    }

    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [open, jobId]);

  function handleClose() {
    router.refresh();
    onClose();
  }

  if (!open) return null;

  const isResolving = !job || job.status === "queued" || job.status === "running";
  const hasFailed = !!pollError || job?.status === "failed";
  const host = hostOf(inputUrl);
  const displayName = activity?.name && activity.name !== inputUrl ? activity.name : host;

  return (
    <>
      <div className="fixed inset-0 bg-ink/25 z-40 cursor-pointer" onClick={handleClose} />
      <aside className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-base shadow-2xl z-50 overflow-y-auto flex flex-col">
        <header className="bg-surface px-5 py-4 border-b border-ink-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-sans text-[11px] font-bold uppercase tracking-widest text-ink-2 mb-0.5">
                {hasFailed ? "Couldn't fetch details" : isResolving ? "Fetching details…" : "Review & save"}
              </div>
              <h2 className="font-display font-extrabold text-xl text-ink leading-tight truncate">
                {displayName}
              </h2>
              {scopeLabel && (
                <div className="font-sans text-[10px] uppercase tracking-wide text-ink-2 mt-1">
                  Placing on · {scopeLabel}
                </div>
              )}
            </div>
            <button onClick={handleClose} aria-label="Close" className="text-ink-2 hover:text-ink text-lg">✕</button>
          </div>
        </header>

        <div className="flex-1 p-5 space-y-5">
          {isResolving && !hasFailed && (
            <>
              <div className="flex items-center gap-2 text-ink-2 text-sm">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M22 12a10 10 0 0 1-10 10" />
                </svg>
                Reading {host}…
              </div>
              <SkeletonRow label="Name" widthClass="w-full" />
              <SkeletonRow label="Dates" widthClass="w-2/3" />
              <SkeletonRow label="Price" widthClass="w-1/2" />
              <SkeletonRow label="Location" widthClass="w-3/4" />
              <p className="text-[11px] text-ink-2 italic">
                Extracting details can take 10–30 seconds depending on the site.
              </p>
            </>
          )}

          {hasFailed && (
            <div className="space-y-4">
              <div className="rounded-xl p-4 border border-[#ef8c8f] bg-[#ef8c8f]/10">
                <div className="flex items-start gap-2">
                  <span className="text-base">⚠</span>
                  <div className="text-sm">
                    <div className="font-semibold text-ink">
                      {pollError ?? "We couldn't extract details from that page."}
                    </div>
                    <div className="text-ink-2 mt-1">
                      The camp is saved to your shortlist with just the name and URL. You can fill in details later from the camp card.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isResolving && !hasFailed && activity && (
            <>
              {/* 1. Camp name */}
              <Field label="Camp name" confidence="scraped">
                <span className="text-sm text-ink">{activity.name}</span>
              </Field>

              {/* 2. Organization */}
              {activity.organization?.name &&
                activity.organization.name !== activity.name &&
                activity.organization.name !== "User-submitted" && (
                  <Field label="Hosted by" confidence="scraped">
                    <span className="text-sm text-ink">{activity.organization.name}</span>
                  </Field>
                )}

              {/* 3. URL */}
              {activity.registration_url && (
                <Field label="URL">
                  <a
                    href={activity.registration_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-ink underline break-all"
                  >
                    {activity.registration_url}
                  </a>
                </Field>
              )}

              {/* 4. Location */}
              {activity.locations.length > 0 && (
                <Field label="Location" confidence={activity.data_confidence}>
                  <div className="text-sm text-ink">
                    {activity.locations[0].location_name ?? activity.locations[0].address}
                  </div>
                  {activity.locations[0].location_name && (
                    <div className="text-[11px] text-ink-2 mt-0.5">{activity.locations[0].address}</div>
                  )}
                </Field>
              )}

              {/* 5. Categories — draft */}
              <div>
                <div className="flex items-center mb-1">
                  <label className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-2">Categories</label>
                  <span className="ml-1.5 font-sans text-[9px] uppercase tracking-wide text-[#8a6b00] bg-hero/20 px-1.5 py-0.5 rounded">Beta</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => {
                    const current = draftCategories ?? activity.categories;
                    const selected = current.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          const next = selected
                            ? current.filter((c) => c !== cat)
                            : [...current, cat];
                          setDraftCategories(next);
                        }}
                        className={`font-sans text-[10px] uppercase tracking-wide px-2.5 py-1 rounded-full border transition-colors ${
                          selected
                            ? "bg-ink text-ink-inverse border-ink"
                            : "bg-transparent text-ink-2 border-ink-3 hover:border-ink hover:text-ink"
                        }`}
                      >
                        {CATEGORY_LABELS[cat]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 6. About — read-only beta */}
              <div>
                <div className="flex items-center mb-1">
                  <label className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-2">About</label>
                  <span className="ml-1.5 font-sans text-[9px] uppercase tracking-wide text-[#8a6b00] bg-hero/20 px-1.5 py-0.5 rounded">Beta</span>
                </div>
                <p className="text-sm text-ink leading-snug whitespace-pre-wrap">
                  {activity.description ?? <span className="text-ink-2 italic">No description detected</span>}
                </p>
              </div>

              {/* 7. Ages — read-only, beta */}
              <div>
                <div className="flex items-center mb-1">
                  <label className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-2">Ages</label>
                  <span className="ml-1.5 font-sans text-[9px] uppercase tracking-wide text-[#8a6b00] bg-hero/20 px-1.5 py-0.5 rounded">Beta</span>
                </div>
                <div className="text-sm text-ink">
                  {activity.age_min != null || activity.age_max != null
                    ? `${activity.age_min ?? "?"}–${activity.age_max ?? "?"} years`
                    : <span className="text-ink-2 italic">No age range detected</span>}
                </div>
              </div>

              {/* 8. Scraped price options — beta */}
              {activity.prices.length > 0 && (
                <div>
                  <div className="flex items-center mb-1">
                    <label className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-2">Scraped prices</label>
                    <span className="ml-1.5 font-sans text-[9px] uppercase tracking-wide text-[#8a6b00] bg-hero/20 px-1.5 py-0.5 rounded">Beta</span>
                  </div>
                  <ul className="text-sm text-ink space-y-1">
                    {activity.prices.slice(0, 5).map((p) => (
                      <li key={p.id} className="flex items-baseline justify-between gap-2">
                        <span className="text-ink-2">{p.label || "Standard"}</span>
                        <span>{formatPrice(p.price_cents, p.price_unit)}</span>
                      </li>
                    ))}
                    {activity.prices.length > 5 && (
                      <li className="text-[11px] text-ink-2">+{activity.prices.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}

              {/* 9. Scraped dates/sessions — beta */}
              {activity.sessions.length > 0 && (
                <div>
                  <div className="flex items-center mb-1">
                    <label className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-2">Dates</label>
                    <span className="ml-1.5 font-sans text-[9px] uppercase tracking-wide text-[#8a6b00] bg-hero/20 px-1.5 py-0.5 rounded">Beta</span>
                  </div>
                  <ul className="space-y-1">
                    {activity.sessions.slice(0, 4).map((s) => (
                      <li key={s.id} className="text-sm text-ink">
                        {formatDateRange(s.starts_at, s.ends_at)}
                        {s.is_sold_out && <span className="ml-2 text-[11px] text-[#c1474a] uppercase tracking-wide">sold out</span>}
                      </li>
                    ))}
                    {activity.sessions.length > 4 && (
                      <li className="text-[11px] text-ink-2">+{activity.sessions.length - 4} more</li>
                    )}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <footer className="p-5 border-t border-ink-3 bg-surface flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={async () => {
              if (!userCampId) {
                handleClose();
                return;
              }
              if (!confirm("Delete this camp from your shortlist? This can't be undone.")) return;
              setDeleting(true);
              const r = await removeActivityFromShortlist(userCampId);
              setDeleting(false);
              if (r.error) {
                alert(r.error);
                return;
              }
              router.refresh();
              onClose();
            }}
            disabled={deleting || saving}
            className="font-sans text-[11px] uppercase tracking-widest px-4 py-2 rounded-full border border-[#ef8c8f] text-[#c1474a] hover:bg-[#ef8c8f]/10 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>

          {isResolving && !hasFailed ? (
            <button
              type="button"
              onClick={handleClose}
              className="font-sans text-[11px] uppercase tracking-widest px-4 py-2 text-ink-2 hover:text-ink"
            >
              Continue in background
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={saving || deleting}
                className="font-sans text-[11px] uppercase tracking-widest px-4 py-2 text-ink-2 hover:text-ink disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!activity) {
                    handleClose();
                    return;
                  }
                  setSaving(true);
                  const patch: Parameters<typeof updateActivityFields>[0] = { activityId: activity.id };
                  if (draftCategories !== null) patch.categories = draftCategories;
                  const r = await updateActivityFields(patch);
                  setSaving(false);
                  if (r.error) {
                    alert(r.error);
                    return;
                  }
                  router.refresh();
                  onClose();
                }}
                disabled={saving || deleting}
                className="font-sans text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-ink text-ink-inverse hover:bg-ink/90 disabled:opacity-50"
              >
                {saving ? "Saving…" : hasFailed ? "Keep it" : "Save"}
              </button>
            </div>
          )}
        </footer>
      </aside>
    </>
  );
}

function SkeletonRow({ label, widthClass }: { label: string; widthClass: string }) {
  return (
    <div>
      <div className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-1.5">{label}</div>
      <div className={`h-9 rounded bg-ink-3/30 animate-pulse ${widthClass}`} />
    </div>
  );
}

function Field({
  label,
  confidence,
  children,
}: {
  label: string;
  confidence?: string;
  children: React.ReactNode;
}) {
  const badge = confidence ? confidenceBadge(confidence) : null;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="font-sans text-[10px] uppercase tracking-widest text-ink-2">{label}</div>
        {badge && (
          <span className={`font-sans text-[9px] font-bold uppercase tracking-[0.14em] px-2 py-0.5 rounded-full ${badge.className}`}>
            {badge.label}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
