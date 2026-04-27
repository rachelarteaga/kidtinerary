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

  // --- Meta line parts ---
  const metaParts: string[] = [];

  if (showOrg && activity.activity.organization) {
    metaParts.push(activity.activity.organization.name);
  }

  if (activity.activity.categories.length > 0) {
    metaParts.push(categoryLabel(activity.activity.categories[0]));
  }

  // Season hint: derive from the earliest session start date
  const sessionDates = activity.activity.sessions
    .map((s) => s.starts_at)
    .filter(Boolean)
    .sort();
  const earliestSession = sessionDates[0] ?? null;
  const seasonHint = formatSeasonHint(earliestSession);
  if (seasonHint) {
    metaParts.push(seasonHint);
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
          <div className="flex items-start gap-2">
            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-extrabold text-base text-ink leading-tight break-words">
                {activity.activity.name}
              </h2>
              {metaParts.length > 0 && (
                <p className="font-sans text-xs text-ink-2 mt-1">
                  {metaParts.join(" · ")}
                </p>
              )}
            </div>

            {/* Kid pill(s) right-aligned */}
            <div className="flex items-start gap-2 flex-wrap justify-end mt-0.5 flex-shrink-0">
              {taggedKids.length === 0 ? (
                <span className="text-xs italic text-ink-3">Unassigned</span>
              ) : (
                taggedKids.map((kid) => (
                  <span
                    key={kid.index}
                    className="inline-flex items-center gap-1.5 text-sm text-ink font-medium"
                  >
                    <KidShape index={kid.index} size={16} dotOnly />
                    {kid.name}
                  </span>
                ))
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
                className="flex-shrink-0 -mr-1 -mt-1 w-8 h-8 inline-flex items-center justify-center rounded-full text-ink-3 hover:text-ink hover:bg-base transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </button>
            )}
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
