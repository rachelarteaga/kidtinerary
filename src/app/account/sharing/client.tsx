"use client";

import Link from "next/link";
import { ActiveSharesList, type PlannerShareRow } from "@/components/account/active-shares-list";

interface Props {
  shares: PlannerShareRow[];
}

export function ActiveSharesClient({ shares }: Props) {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-display font-extrabold text-4xl text-ink tracking-tight mb-2">
        Share preferences
      </h1>
      <p className="text-ink-2 mb-8">
        Manage the live links you&apos;ve created for your planner.
      </p>

      <ActiveSharesList shares={shares} />

      <div className="mt-10">
        <Link
          href="/planner"
          className="font-sans font-bold text-[11px] uppercase tracking-widest text-ink hover:underline"
        >
          ← Back to planner
        </Link>
      </div>
    </main>
  );
}
