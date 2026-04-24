"use client";

import { useEffect, useState, useTransition, useMemo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { removeCampFromShortlist } from "@/lib/actions";
import type { UserCampWithActivity } from "@/lib/queries";

interface Props {
  camps: UserCampWithActivity[];
  /** Desktop-only behavior: open the quickview drawer for a camp. Ignored on
   * mobile where `onCampPlacementTap` drives the tap-to-place flow instead. */
  onChipClick: (camp: UserCampWithActivity) => void;
  onAddClick: () => void;
  onChanged?: () => void;
  /** Mobile tap-to-place: invoked when a camp in the bottom sheet is tapped.
   * Parent handles entering placement mode and closing the sheet. */
  onCampPlacementTap?: (camp: UserCampWithActivity) => void;
  /** Whether the mobile sheet is open (controlled by parent so it can close on
   * successful placement / from the banner). */
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export function MyCampsRail({
  camps,
  onChipClick,
  onAddClick,
  onChanged,
  onCampPlacementTap,
  mobileOpen = false,
  onMobileOpenChange,
}: Props) {
  const [pendingRemove, setPendingRemove] = useState<{
    userCampId: string;
    name: string;
    entryCount: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmRemove() {
    if (!pendingRemove) return;
    startTransition(async () => {
      const result = await removeCampFromShortlist(pendingRemove.userCampId);
      if (result.error) {
        alert(result.error);
        return;
      }
      setPendingRemove(null);
      onChanged?.();
    });
  }

  // Close mobile sheet on Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onMobileOpenChange?.(false);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mobileOpen, onMobileOpenChange]);

  const railContent = (
    <>
      <h2 className="font-display font-extrabold text-lg text-ink tracking-tight mb-3 flex-shrink-0">My camps</h2>

      <button
        onClick={onAddClick}
        className="w-full mb-3 rounded-lg border border-dashed border-ink-3 text-ink-2 hover:border-ink hover:text-ink transition-colors font-sans text-[11px] uppercase tracking-wide py-2 flex-shrink-0"
      >
        + Add camp
      </button>

      <div className="space-y-2">
        {camps.length === 0 && (
          <p className="text-sm text-ink-3 italic">Nothing yet — add one above.</p>
        )}
        {camps.map((c) => (
          <DraggableCampItem
            key={c.id}
            camp={c}
            onClick={() => onChipClick(c)}
            onRemoveClick={() =>
              setPendingRemove({
                userCampId: c.id,
                name: c.activity.name,
                entryCount: c.plannerEntryCount,
              })
            }
          />
        ))}
      </div>
    </>
  );

  const mobileContent = (
    <div className="space-y-2 pb-2">
      <button
        onClick={onAddClick}
        className="w-full min-h-[48px] rounded-lg border border-dashed border-ink-3 text-ink-2 font-sans text-[11px] uppercase tracking-wide flex items-center justify-center"
      >
        + Add camp
      </button>
      {camps.length === 0 && (
        <p className="text-sm text-ink-3 italic py-3">Nothing yet — add one above.</p>
      )}
      {camps.map((c) => (
        <TapToPlaceCampItem
          key={c.id}
          camp={c}
          onTap={() => onCampPlacementTap?.(c)}
          onRemoveClick={() =>
            setPendingRemove({
              userCampId: c.id,
              name: c.activity.name,
              entryCount: c.plannerEntryCount,
            })
          }
        />
      ))}
    </div>
  );

  return (
    <>
      {/* Desktop: inline side rail */}
      <aside className="hidden md:flex md:flex-col w-80 shrink-0 md:h-full md:overflow-y-auto bg-[#dfecf5] md:border-r md:border-ink px-6 sm:px-8 lg:px-10 pt-[22px] pb-4">
        {railContent}
      </aside>

      {/* Mobile: bottom sheet */}
      <div className="md:hidden">
        {/* Backdrop when open */}
        <div
          className={`fixed inset-0 z-30 bg-ink/40 transition-opacity ${
            mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => onMobileOpenChange?.(false)}
          aria-hidden={!mobileOpen}
        />

        {/* Collapsed pill — tap to open */}
        {!mobileOpen && (
          <button
            type="button"
            onClick={() => onMobileOpenChange?.(true)}
            aria-label="Open My Camps"
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-2 min-h-[48px] px-5 rounded-full bg-ink text-ink-inverse font-sans font-bold text-[12px] uppercase tracking-widest shadow-[0_4px_14px_rgba(0,0,0,0.18)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="14" y2="18" />
            </svg>
            My Camps
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-white/20 text-white text-[11px] font-bold">
              {camps.length}
            </span>
          </button>
        )}

        {/* Sheet */}
        <div
          role="dialog"
          aria-label="My Camps"
          aria-hidden={!mobileOpen}
          className={`fixed bottom-0 left-0 right-0 z-40 bg-[#dfecf5] rounded-t-2xl border-t border-ink transition-transform duration-250 ease-out ${
            mobileOpen ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ maxHeight: "75dvh" }}
        >
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div className="flex-1 flex justify-center">
              <span className="block w-10 h-1.5 rounded-full bg-ink/25" aria-hidden />
            </div>
          </div>
          <div className="flex items-center justify-between px-5 pb-2">
            <h2 className="font-display font-extrabold text-lg text-ink tracking-tight">
              My camps
              <span className="font-sans text-sm font-medium text-ink-2 ml-2">({camps.length})</span>
            </h2>
            <button
              type="button"
              onClick={() => onMobileOpenChange?.(false)}
              aria-label="Close"
              className="inline-flex items-center justify-center w-10 h-10 rounded-full text-ink-2 hover:text-ink"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                <line x1="5" y1="5" x2="19" y2="19" />
                <line x1="19" y1="5" x2="5" y2="19" />
              </svg>
            </button>
          </div>
          <p className="px-5 pb-3 font-sans text-[11px] uppercase tracking-wide text-ink-2">
            Tap a camp to place it on a week.
          </p>
          <div
            className="px-5 overflow-y-auto overscroll-contain"
            style={{ maxHeight: "calc(75dvh - 120px)" }}
          >
            {mobileContent}
          </div>
        </div>
      </div>

      {pendingRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-ink/40 cursor-pointer" onClick={() => setPendingRemove(null)} />
          <div className="relative bg-surface rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-display font-extrabold text-xl text-ink mb-2">Remove {pendingRemove.name}?</h3>
            <p className="text-sm text-ink-2 mb-4 leading-relaxed">
              {pendingRemove.entryCount > 0 ? (
                <>
                  This will remove {pendingRemove.name} from your My Camps list AND delete{" "}
                  <strong>{pendingRemove.entryCount}</strong> planner entr
                  {pendingRemove.entryCount === 1 ? "y" : "ies"} across your weeks.
                  This cannot be undone.
                </>
              ) : (
                <>This will remove {pendingRemove.name} from your My Camps list.</>
              )}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPendingRemove(null)}
                className="font-sans text-[11px] uppercase tracking-widest px-3 py-1.5 text-ink-2 hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemove}
                disabled={isPending}
                className="font-sans text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full bg-ink text-ink-inverse hover:bg-ink disabled:opacity-50"
              >
                {isPending ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DraggableCampItem({
  camp,
  onClick,
  onRemoveClick,
}: {
  camp: UserCampWithActivity;
  onClick: () => void;
  onRemoveClick: () => void;
}) {
  const data = useMemo(
    () => ({
      type: "camp" as const,
      userCampId: camp.id,
      activityId: camp.activity.id,
      name: camp.activity.name,
      color: camp.color,
    }),
    [camp.id, camp.activity.id, camp.activity.name, camp.color]
  );
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `camp-${camp.id}`,
    data,
  });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`group relative rounded-lg border bg-white p-2.5 cursor-pointer select-none transition-all border-ink-3 ${isDragging ? "opacity-60 ring-2 ring-hero-light/40" : "hover:border-ink"}`}
    >
      <div className="flex items-start gap-1.5">
        <button
          {...listeners}
          {...attributes}
          type="button"
          aria-label={`Drag ${camp.activity.name}`}
          onClick={(e) => e.stopPropagation()}
          className="text-ink-3 hover:text-ink cursor-grab active:cursor-grabbing flex-shrink-0 leading-none self-center text-[13px] -ml-1"
        >
          ⋮⋮
        </button>
        <div className="flex-1 min-w-0 pr-5">
          <div className="flex items-start gap-1.5">
            <span className="w-2 h-2 mt-1.5 rounded-full flex-shrink-0" style={{ background: camp.color }} />
            <div className="font-medium text-sm text-ink break-words">{camp.activity.name}</div>
          </div>
          {camp.activity.organization?.name &&
            camp.activity.organization.name !== camp.activity.name &&
            camp.activity.organization.name !== "User-submitted" && (
              <div className="mt-0.5 pl-3.5 font-sans text-[11px] text-ink-2 break-words">
                {camp.activity.organization.name}
              </div>
            )}
          <div className="mt-1 pl-3.5 flex items-center gap-2 font-sans text-[10px] uppercase tracking-wide text-ink-2">
            {camp.plannerEntryCount > 0 && <span>{camp.plannerEntryCount}x</span>}
            {camp.activity.verified && <span className="text-[#5fc39c]">verified</span>}
          </div>
        </div>
      </div>
      <button
        type="button"
        aria-label={`Remove ${camp.activity.name}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onRemoveClick();
        }}
        className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full text-ink-3 hover:text-[#ef8c8f] hover:bg-[#fdebec] opacity-0 group-hover:opacity-100 transition-opacity text-xs"
      >
        ✕
      </button>
    </div>
  );
}

function TapToPlaceCampItem({
  camp,
  onTap,
  onRemoveClick,
}: {
  camp: UserCampWithActivity;
  onTap: () => void;
  onRemoveClick: () => void;
}) {
  return (
    <div className="relative rounded-lg border border-ink-3 bg-white">
      <button
        type="button"
        onClick={onTap}
        className="w-full text-left p-3 pr-10 min-h-[56px] rounded-lg"
      >
        <div className="flex items-start gap-2">
          <span className="w-2.5 h-2.5 mt-1.5 rounded-full flex-shrink-0" style={{ background: camp.color }} />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-ink break-words">{camp.activity.name}</div>
            {camp.activity.organization?.name &&
              camp.activity.organization.name !== camp.activity.name &&
              camp.activity.organization.name !== "User-submitted" && (
                <div className="mt-0.5 font-sans text-[11px] text-ink-2 break-words">
                  {camp.activity.organization.name}
                </div>
              )}
            <div className="mt-1 flex items-center gap-2 font-sans text-[10px] uppercase tracking-wide text-ink-2">
              {camp.plannerEntryCount > 0 && <span>{camp.plannerEntryCount}x</span>}
              {camp.activity.verified && <span className="text-[#5fc39c]">verified</span>}
            </div>
          </div>
        </div>
      </button>
      <button
        type="button"
        aria-label={`Remove ${camp.activity.name}`}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onRemoveClick();
        }}
        className="absolute top-2 right-2 w-9 h-9 flex items-center justify-center rounded-full text-ink-3 hover:text-[#ef8c8f] hover:bg-[#fdebec]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <line x1="5" y1="5" x2="19" y2="19" />
          <line x1="19" y1="5" x2="5" y2="19" />
        </svg>
      </button>
    </div>
  );
}
