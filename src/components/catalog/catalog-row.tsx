"use client";

import { useRef, useState } from "react";
import type { UserActivityWithDetails } from "@/lib/queries";
import { KidShape } from "@/components/ui/kid-shape";
import { categoryLabel, isRegDeadlineSoon, formatShortDate, formatSeasonHint } from "@/lib/format";
import { AnchoredPopover } from "@/components/ui/anchored-popover";

interface Props {
  activity: UserActivityWithDetails;
  kids: { id: string; name: string }[];
  onClick?: () => void;
  /** Asks the parent to confirm + delete this row. Parent owns the modal. */
  onRemove?: () => void;
}

export function CatalogRow({ activity, kids, onClick, onRemove }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const showOrg =
    activity.activity.organization &&
    activity.activity.organization.name &&
    activity.activity.organization.name !== activity.activity.name &&
    activity.activity.organization.name !== "User-submitted";

  // First location with usable text. Manual entry seeds an empty placeholder
  // row, so filter on trimmed content rather than presence.
  const locationRow =
    activity.activity.activity_locations.find(
      (l) =>
        (l.address && l.address.trim().length > 0) ||
        (l.location_name && l.location_name.trim().length > 0),
    ) ?? null;
  const locationLabel = locationRow
    ? (locationRow.address?.trim() || locationRow.location_name?.trim() || null)
    : null;
  const mapsQuery = locationRow
    ? (
        locationRow.address?.trim() ||
        [activity.activity.organization?.name, locationRow.location_name]
          .filter((s): s is string => Boolean(s && s.trim()))
          .join(" ")
      )
    : null;
  const mapsUrl = mapsQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
    : null;

  // --- Meta line parts ---
  // Mixed strings and JSX (links) — joined with " · " separators in render.
  const metaItems: React.ReactNode[] = [];

  if (showOrg && activity.activity.organization) {
    const orgName = activity.activity.organization.name;
    const orgUrl = activity.activity.registration_url;
    metaItems.push(
      orgUrl ? (
        <a
          href={orgUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="underline underline-offset-2 hover:text-ink"
        >
          {orgName}
        </a>
      ) : (
        orgName
      ),
    );
  }

  if (activity.activity.categories.length > 0) {
    metaItems.push(categoryLabel(activity.activity.categories[0]));
  }

  if (locationLabel && mapsUrl) {
    metaItems.push(
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="underline underline-offset-2 hover:text-ink"
      >
        {locationLabel}
      </a>,
    );
  }

  // Season hint: derive from the earliest session start date
  const sessionDates = activity.activity.sessions
    .map((s) => s.starts_at)
    .filter(Boolean)
    .sort();
  const earliestSession = sessionDates[0] ?? null;
  const seasonHint = formatSeasonHint(earliestSession);
  if (seasonHint) {
    metaItems.push(seasonHint);
  }

  // --- Kid pills ---
  const taggedKids = activity.kidTags
    .map((kidId) => {
      const idx = kids.findIndex((k) => k.id === kidId);
      if (idx === -1) return null;
      return { index: idx, name: kids[idx].name };
    })
    .filter((k): k is { index: number; name: string } => k !== null);

  // --- Footer badges ---
  const hasPlanner = activity.plannerPlacements.length > 0;
  const isSharedByFriend =
    activity.source === "friend" && Boolean(activity.sharedByName);
  const regDeadlineSoon = isRegDeadlineSoon(activity.registrationEndDate);
  const hasFooter = hasPlanner || isSharedByFriend || regDeadlineSoon;

  function handleRemoveClick(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen(false);
    onRemove?.();
  }

  function handleMenuButtonClick(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen((v) => !v);
  }

  return (
    <div
      className="group rounded-lg border border-ink-3 bg-surface p-4 hover:border-ink transition-colors cursor-pointer"
      onClick={onClick}
    >
      {/* Top section */}
      <div className="flex items-start gap-3">
        <span
          className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
          style={{ background: activity.color }}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start gap-2">
            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-extrabold text-base text-ink leading-tight break-words">
                {activity.activity.name}
              </h2>
              {metaItems.length > 0 && (
                <p className="font-sans text-xs text-ink-2 mt-1">
                  {metaItems.map((item, i) => (
                    <span key={i}>
                      {i > 0 && " · "}
                      {item}
                    </span>
                  ))}
                </p>
              )}
            </div>

            {/* Overflow menu — always visible (mobile-first; no hover gating). */}
            {onRemove && (
              <button
                ref={menuButtonRef}
                type="button"
                onClick={handleMenuButtonClick}
                aria-label="More actions"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="order-2 sm:order-3 flex-shrink-0 -mr-1 -mt-1 w-10 h-10 inline-flex items-center justify-center rounded-full text-ink-3 hover:text-ink hover:bg-base transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </button>
            )}

            {/* Kid pill(s) — wraps below meta line on mobile, inline on sm+ */}
            <div className="order-3 sm:order-2 w-full sm:w-auto flex items-center gap-2 flex-wrap sm:justify-end mt-1 sm:mt-0.5">
              {taggedKids.length === 0 ? (
                <span className="text-xs italic text-ink-3">Unassigned</span>
              ) : (
                taggedKids.map((kid) => (
                  <span
                    key={kid.index}
                    className="inline-flex items-center gap-1.5 text-sm text-ink font-medium flex-shrink-0"
                  >
                    <KidShape index={kid.index} size={16} dotOnly />
                    {kid.name}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer badges (only when applicable) */}
      {hasFooter && (
        <div className="mt-3 pt-3 border-t border-[#eeeeee] flex items-center gap-2 flex-wrap">
          {/* Planner placement badge */}
          {activity.plannerPlacements.length === 1 && (
            <span className="font-sans font-semibold text-[9px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-dashed border-ink-3 bg-surface text-ink">
              On {activity.plannerPlacements[0].plannerName}
            </span>
          )}
          {activity.plannerPlacements.length > 1 && (
            <span className="font-sans font-semibold text-[9px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-dashed border-ink-3 bg-surface text-ink">
              On {activity.plannerPlacements.length} planners
            </span>
          )}

          {/* Shared-by-friend badge */}
          {isSharedByFriend && (
            <span className="font-sans font-semibold text-[9px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-ink bg-[#fff5d4] text-ink">
              Shared by {activity.sharedByName}
            </span>
          )}

          {/* Registration deadline badge */}
          {regDeadlineSoon && activity.registrationEndDate && (
            <span className="font-sans font-semibold text-[9px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-ink bg-surface text-ink">
              Reg closes {formatShortDate(activity.registrationEndDate)}
            </span>
          )}
        </div>
      )}

      <AnchoredPopover
        anchorRef={menuButtonRef}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        align="end"
        className="bg-surface border border-ink rounded-lg shadow-[3px_3px_0_0_rgba(0,0,0,0.12)] py-1 min-w-[200px]"
      >
        <button
          type="button"
          role="menuitem"
          onClick={handleRemoveClick}
          className="block w-full text-left px-3 py-2 font-sans text-[13px] font-medium text-[#c96164] hover:bg-[#fdebec]"
        >
          Remove from catalog
        </button>
      </AnchoredPopover>
    </div>
  );
}
