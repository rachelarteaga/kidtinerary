"use client";

import { useEffect } from "react";
import Link from "next/link";
import { addPendingSaveToken } from "@/lib/saved-shares-pending";

interface Props {
  token: string;
}

/**
 * Sticky banner for anonymous viewers of /schedule/[token]. Stashes the token
 * in localStorage when the viewer clicks the CTA, then routes them to signup.
 * After authentication, the drain component (Task 9) auto-saves the share.
 */
export function AnonSaveBanner({ token }: Props) {
  // Stash the token *before* the user clicks anything, so even returning users
  // who go log in via a different tab still get the auto-save on next visit.
  useEffect(() => {
    if (typeof window === "undefined") return;
    addPendingSaveToken(window.localStorage, token);
  }, [token]);

  const next = `/schedule/${encodeURIComponent(token)}`;
  return (
    <div className="sticky top-0 z-30 bg-ink text-ink-inverse">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3">
        <p className="font-sans text-sm">
          Sign up to save this planner — it stays read-only and updates as the owner changes it.
        </p>
        <Link
          href={`/auth/signup?next=${encodeURIComponent(next)}`}
          className="font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full bg-ink-inverse text-ink hover:bg-base flex-shrink-0"
        >
          Sign up
        </Link>
      </div>
    </div>
  );
}
