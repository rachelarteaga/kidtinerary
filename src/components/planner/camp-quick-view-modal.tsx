"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { UserCampWithActivity } from "@/lib/queries";

interface Props {
  camp: UserCampWithActivity | null;
  onClose: () => void;
}

function formatPrice(cents: number, unit: string): string {
  const dollars = (cents / 100).toFixed(0);
  const unitLabel = unit === "per_week" ? "/week" : unit === "per_day" ? "/day" : "";
  return `$${dollars}${unitLabel}`;
}

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function CampQuickViewModal({ camp, onClose }: Props) {
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
  const priceOptions = a.price_options?.slice(0, 3) ?? [];
  const sessions = a.sessions ?? [];
  const sessionSummary = (() => {
    if (sessions.length === 0) return null;
    const sorted = [...sessions].sort((x, y) => x.starts_at.localeCompare(y.starts_at));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (sessions.length === 1) return formatDate(first.starts_at);
    return `${formatDate(first.starts_at)} – ${formatDate(last.ends_at)} · ${sessions.length} sessions`;
  })();

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
              <div className="font-sans text-sm text-ink-2 flex items-center gap-2 flex-wrap">
                {a.organization?.name && <span>{a.organization.name}</span>}
                {a.verified && (
                  <span className="inline-flex items-center gap-1 font-sans text-[10px] font-bold uppercase tracking-widest text-[#5fc39c]">
                    <span aria-hidden>✓</span> Verified
                  </span>
                )}
              </div>
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

        <div className="px-6 py-5 space-y-5">
          {a.categories && a.categories.length > 0 && (
            <section>
              <h3 className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-2 mb-2">
                Categories
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {a.categories.map((cat) => (
                  <span
                    key={cat}
                    className="font-sans text-xs font-semibold text-ink border border-ink rounded-full px-3 py-1 bg-surface"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </section>
          )}

          {primaryLocation && (
            <section>
              <h3 className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-2 mb-2">
                Location
              </h3>
              <div className="font-sans text-sm text-ink">
                {primaryLocation.location_name && (
                  <div className="font-semibold">{primaryLocation.location_name}</div>
                )}
                <div className="text-ink-2">{primaryLocation.address}</div>
                {a.activity_locations.length > 1 && (
                  <div className="font-sans text-[11px] text-ink-2 mt-1 italic">
                    + {a.activity_locations.length - 1} more location
                    {a.activity_locations.length - 1 === 1 ? "" : "s"}
                  </div>
                )}
              </div>
            </section>
          )}

          {sessionSummary && (
            <section>
              <h3 className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-2 mb-2">
                Sessions
              </h3>
              <div className="font-sans text-sm text-ink">{sessionSummary}</div>
            </section>
          )}

          {priceOptions.length > 0 && (
            <section>
              <h3 className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-2 mb-2">
                Price
              </h3>
              <div className="flex flex-col gap-1">
                {priceOptions.map((p) => (
                  <div key={p.id} className="flex items-baseline justify-between gap-3 font-sans text-sm">
                    <span className="text-ink-2">{p.label}</span>
                    <span className="text-ink font-semibold">
                      {formatPrice(p.price_cents, p.price_unit)}
                    </span>
                  </div>
                ))}
                {a.price_options.length > priceOptions.length && (
                  <div className="font-sans text-[11px] text-ink-2 italic mt-1">
                    + {a.price_options.length - priceOptions.length} more price option
                    {a.price_options.length - priceOptions.length === 1 ? "" : "s"}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-ink-3 flex justify-end">
          <Link
            href={`/activity/${a.slug}`}
            className="font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-ink text-ink-inverse hover:bg-[#333] border border-ink shadow-[3px_3px_0_0_rgba(0,0,0,0.15)] inline-flex items-center gap-1.5"
          >
            View full details
            <span aria-hidden>→</span>
          </Link>
        </footer>
      </div>
    </div>
  );
}
