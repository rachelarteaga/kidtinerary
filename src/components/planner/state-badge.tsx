"use client";

import type { PlannerEntryStatus } from "@/lib/supabase/types";

interface Props {
  status: PlannerEntryStatus;
  onClick?: () => void;
}

const LABELS: Record<PlannerEntryStatus, string> = {
  considering: "Considering",
  waitlisted: "Waitlisted",
  registered: "Registered",
};

const STYLES: Record<PlannerEntryStatus, string> = {
  considering: "bg-campfire/15 text-campfire hover:bg-campfire/25",
  waitlisted: "bg-amber-100 text-amber-800 hover:bg-amber-200",
  registered: "bg-meadow/20 text-meadow hover:bg-meadow/30",
};

export function StateBadge({ status, onClick }: Props) {
  const base = "font-mono text-[10px] uppercase tracking-wide px-2.5 py-1 rounded-full transition-colors";
  const cls = `${base} ${STYLES[status]} ${onClick ? "cursor-pointer" : ""}`;
  if (onClick) return <button onClick={onClick} className={cls}>{LABELS[status]}</button>;
  return <span className={cls}>{LABELS[status]}</span>;
}
