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
  considering: "bg-status-considering text-ink hover:brightness-95",
  waitlisted: "bg-status-waitlisted text-ink hover:brightness-95",
  registered: "bg-status-registered text-ink hover:brightness-95",
};

export function StateBadge({ status, onClick }: Props) {
  const base = "font-sans text-[10px] uppercase tracking-wide px-2.5 py-1 rounded-full border border-ink font-semibold transition-colors";
  const cls = `${base} ${STYLES[status]} ${onClick ? "cursor-pointer" : ""}`;
  if (onClick) return <button onClick={onClick} className={cls}>{LABELS[status]}</button>;
  return <span className={cls}>{LABELS[status]}</span>;
}
