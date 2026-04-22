"use client";

import Link from "next/link";

interface Props {
  count: number;
}

export function SharedIndicatorPill({ count }: Props) {
  if (count === 0) return null;
  return (
    <Link
      href="/account/sharing"
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-[#eef9f0] text-[#147a30] hover:bg-[#dcf2e0]"
      aria-label={`Planner is shared with ${count} active link${count === 1 ? "" : "s"}. Tap to manage.`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#2cb14a]" aria-hidden="true" />
      Shared
    </Link>
  );
}
