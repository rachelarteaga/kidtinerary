"use client";

import { useTransition } from "react";
import { removePlannerBlock } from "@/lib/actions";
import type { PlannerBlockType } from "@/lib/supabase/types";

const TYPE_STYLES: Record<PlannerBlockType, { bg: string; border: string; emoji: string }> = {
  school:  { bg: "bg-amber-50",  border: "border-amber-200",  emoji: "🏫" },
  travel:  { bg: "bg-purple-50", border: "border-purple-200", emoji: "✈" },
  at_home: { bg: "bg-orange-50", border: "border-orange-200", emoji: "🏡" },
  other:   { bg: "bg-stone-50",  border: "border-stone-200",  emoji: "⭐" },
};

interface Props {
  blockId: string;
  type: PlannerBlockType;
  title: string;
  emoji?: string | null;
  subtitle?: string;
  onChanged: () => void;
}

export function BlockCard({ blockId, type, title, emoji, subtitle, onChanged }: Props) {
  const [isPending, startTransition] = useTransition();
  const t = TYPE_STYLES[type];
  const icon = emoji || t.emoji;

  function handleRemove() {
    startTransition(async () => {
      await removePlannerBlock(blockId);
      onChanged();
    });
  }

  return (
    <div className={`rounded-lg border p-3 flex items-start gap-3 ${t.bg} ${t.border} ${isPending ? "opacity-60" : ""}`}>
      <span className="text-lg shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-bark truncate">{title}</div>
        {subtitle && (
          <div className="font-mono text-[10px] uppercase tracking-wide text-stone mt-0.5">{subtitle}</div>
        )}
      </div>
      <button
        onClick={handleRemove}
        aria-label="Remove block"
        className="text-driftwood hover:text-red-500 text-xs"
      >
        ✕
      </button>
    </div>
  );
}
