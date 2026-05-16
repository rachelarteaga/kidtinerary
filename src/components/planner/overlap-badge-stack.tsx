"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { FriendOverlap } from "@/lib/overlap";

interface Props {
  overlaps: FriendOverlap[];
}

/** Stack of small avatar dots rendered in the corner of a planner cell to
 *  signal friend-kids enrolled in the same camp the same week. Click the
 *  stack → popover lists each friend with a link to their full shared planner.
 *  Rendered nothing when overlaps is empty (caller is responsible for not
 *  mounting it in that case, but we no-op defensively). */
export function OverlapBadgeStack({ overlaps }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleDoc(e: MouseEvent | TouchEvent) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleDoc);
    document.addEventListener("touchstart", handleDoc);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleDoc);
      document.removeEventListener("touchstart", handleDoc);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  if (overlaps.length === 0) return null;

  return (
    <div ref={rootRef} className="absolute top-1 right-1 z-10">
      <button
        type="button"
        onClick={(e) => {
          // Prevent the click from also firing the cell's onAdd/onEntry handlers.
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={`${overlaps.length} friend ${overlaps.length === 1 ? "kid is" : "kids are"} also here this week`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex -space-x-1.5 cursor-pointer p-0.5"
      >
        {overlaps.slice(0, 3).map((o, idx) => (
          <span
            key={`${o.shareId}-${o.kidName}-${idx}`}
            className="w-4 h-4 rounded-full border border-white ring-1 ring-ink/30 inline-block"
            style={{ background: o.kidColor }}
            aria-hidden
          />
        ))}
        {overlaps.length > 3 && (
          <span
            className="w-4 h-4 rounded-full border border-white ring-1 ring-ink/30 bg-ink text-ink-inverse font-sans text-[8px] font-bold inline-flex items-center justify-center"
            aria-hidden
          >
            +{overlaps.length - 3}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Friends also here this week"
          className="absolute top-full right-0 mt-1 w-56 bg-surface border border-ink rounded-lg shadow-lg p-2 z-20"
        >
          <p className="font-sans text-[10px] uppercase tracking-widest text-ink-2 px-1 pb-1">
            Also here this week
          </p>
          <ul className="space-y-1">
            {overlaps.map((o, idx) => (
              <li
                key={`row-${o.shareId}-${o.kidName}-${idx}`}
                className="flex items-center gap-2 px-1 py-1"
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: o.kidColor }}
                  aria-hidden
                />
                <span className="flex-1 min-w-0">
                  <span className="block font-sans text-sm text-ink font-medium truncate">
                    {o.kidName}
                  </span>
                  <span className="block font-sans text-[11px] text-ink-2 truncate">
                    {o.ownerName ?? "a friend"}&apos;s family
                  </span>
                </span>
                {o.shareToken && (
                  <Link
                    href={`/schedule/${o.shareToken}`}
                    onClick={() => setOpen(false)}
                    className="font-sans text-[10px] uppercase tracking-widest text-ink-2 hover:text-ink underline-offset-2 hover:underline flex-shrink-0"
                  >
                    View
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
