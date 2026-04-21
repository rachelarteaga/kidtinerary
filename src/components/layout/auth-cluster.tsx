"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Props {
  /** When null, user is unauthenticated. When set, user is authenticated. */
  user: { name: string; email: string } | null;
  /** Called when the user clicks Log out. Parent wires this to whatever sign-out action exists. */
  onLogOut?: () => void;
}

export function AuthCluster({ user, onLogOut }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!user) {
    return (
      <span className="inline-flex items-stretch border border-ink rounded-full overflow-hidden font-sans text-[11px] font-bold uppercase tracking-widest">
        <Link href="/auth/login" className="px-4 py-2 bg-surface text-ink hover:bg-base">
          Sign In
        </Link>
        <Link href="/auth/signup" className="px-4 py-2 bg-ink text-white hover:bg-[#333]">
          Sign up
        </Link>
      </span>
    );
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-[14px] py-2 rounded-full border border-ink bg-surface text-ink font-sans text-[11px] font-bold uppercase tracking-widest hover:bg-base"
      >
        Account
        <span className="text-[10px] leading-none">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 top-full right-0 mt-2 bg-surface border border-ink rounded-xl shadow-[3px_3px_0_0_rgba(0,0,0,0.15)] p-1 min-w-[240px]">
          <div className="px-3 pt-2.5 pb-2 border-b border-dashed border-ink-3">
            <p className="font-display font-extrabold text-sm text-ink leading-tight truncate">{user.name}</p>
            <p className="font-sans text-[11px] font-medium text-ink-2 truncate">{user.email}</p>
          </div>
          <Link href="/kids" className="block px-3 py-2 rounded-md font-sans text-[13px] font-medium text-ink hover:bg-base">My kids</Link>
          <Link href="/account/sharing" className="block px-3 py-2 rounded-md font-sans text-[13px] font-medium text-ink hover:bg-base">Share preferences</Link>
          <hr className="border-t border-disabled mx-2 my-1" />
          <button
            type="button"
            onClick={() => { setOpen(false); onLogOut?.(); }}
            className="block w-full text-left px-3 py-2 rounded-md font-sans text-[13px] font-medium text-[#ef8c8f] hover:bg-[#fdebec]"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
