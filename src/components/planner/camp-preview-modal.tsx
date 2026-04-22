"use client";

import { useEffect } from "react";
import type { UserCampWithActivity } from "@/lib/queries";

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

export interface PreviewSummary {
  counts: { considering: number; waitlisted: number; registered: number };
  avgPricePaidPerWeekCents: number | null;
}

interface Props {
  camp: UserCampWithActivity | null;
  summary: PreviewSummary | null;
  onClose: () => void;
  onEdit: () => void;
}

function formatPlacements(counts: PreviewSummary["counts"]): string | null {
  const parts: string[] = [];
  if (counts.registered) parts.push(`${counts.registered} registered`);
  if (counts.waitlisted) parts.push(`${counts.waitlisted} waitlisted`);
  if (counts.considering) parts.push(`${counts.considering} considering`);
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

export function CampPreviewModal({ camp, summary, onClose, onEdit }: Props) {
  useEffect(() => {
    if (!camp) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [camp, onClose]);

  if (!camp) return null;

  const a = camp.activity;
  const primaryLocation = a.activity_locations?.[0];
  const locationText = primaryLocation
    ? primaryLocation.location_name
      ? `${primaryLocation.location_name} · ${primaryLocation.address}`
      : primaryLocation.address
    : null;

  const placementsLine = summary ? formatPlacements(summary.counts) : null;
  const avgCents = summary?.avgPricePaidPerWeekCents ?? null;
  const avgLine =
    avgCents == null ? null : `$${(avgCents / 100).toFixed(0)}/week avg across registered`;

  const isCurated = a.source === "curated";
  const sourceLine = isCurated ? "Curated by Kidtinerary" : "You added this";
  const ctaLabel = isCurated ? "See more info" : "Edit camp details";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-16 pb-8 overflow-y-auto">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />

      <div className="relative bg-surface border border-ink rounded-2xl shadow-[3px_3px_0_0_rgba(0,0,0,0.15)] w-full max-w-xl">
        <header className="px-6 pt-6 pb-4 border-b border-ink-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="w-3 h-3 rounded-full border border-ink flex-shrink-0"
                  style={{ background: camp.color }}
                  aria-hidden
                />
                <h2 className="font-display font-extrabold text-2xl text-ink leading-tight tracking-tight">
                  {a.name}
                </h2>
              </div>
              {a.organization?.name && (
                <div className="font-sans text-sm text-ink-2">{a.organization.name}</div>
              )}
              {a.registration_url && (
                <a
                  href={a.registration_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-sans text-xs text-ink underline break-all inline-block mt-1"
                >
                  {a.registration_url}
                </a>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-ink-2 hover:text-ink text-xl leading-none -mt-1"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="px-6 py-5 space-y-4">
          <div className="font-sans text-[11px] font-bold uppercase tracking-widest text-ink-2">
            {sourceLine}
            {a.verified && <span className="text-[#5fc39c] ml-2">· Verified ✓</span>}
          </div>

          {placementsLine && (
            <section>
              <h3 className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-2 mb-1">
                Placements
              </h3>
              <div className="font-sans text-sm text-ink">{placementsLine}</div>
            </section>
          )}

          {avgLine && (
            <section>
              <h3 className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-2 mb-1">
                Avg price paid
              </h3>
              <div className="font-sans text-sm text-ink">{avgLine}</div>
            </section>
          )}

          {locationText && (
            <section>
              <h3 className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-2 mb-1">
                Location
              </h3>
              <div className="font-sans text-sm text-ink">{locationText}</div>
            </section>
          )}

          {a.categories && a.categories.length > 0 && (
            <section>
              <h3 className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-2 mb-2 flex items-center">
                Categories
                <span className="ml-1.5 font-sans text-[9px] uppercase tracking-wide text-[#8a6b00] bg-hero/20 px-1.5 py-0.5 rounded">Beta</span>
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {a.categories.map((cat) => (
                  <span
                    key={cat}
                    className="font-sans text-xs font-semibold text-ink border border-ink rounded-full px-3 py-1 bg-surface"
                  >
                    {CATEGORY_LABELS[cat] ?? cat}
                  </span>
                ))}
              </div>
            </section>
          )}

          {a.description && (
            <section>
              <h3 className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-2 mb-1 flex items-center">
                About
                <span className="ml-1.5 font-sans text-[9px] uppercase tracking-wide text-[#8a6b00] bg-hero/20 px-1.5 py-0.5 rounded">Beta</span>
              </h3>
              <p className="font-sans text-sm text-ink leading-snug whitespace-pre-wrap">{a.description}</p>
            </section>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-ink-3 flex justify-end">
          <button
            type="button"
            onClick={onEdit}
            className="font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-ink text-ink-inverse hover:bg-[#333] border border-ink shadow-[3px_3px_0_0_rgba(0,0,0,0.15)] inline-flex items-center gap-1.5"
          >
            {ctaLabel}
            <span aria-hidden>→</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
