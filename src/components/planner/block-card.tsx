"use client";

import { useTransition } from "react";
import { removePlannerBlock } from "@/lib/actions";
import { BlockIcon } from "./block-icon";
import type { PlannerBlockType } from "@/lib/supabase/types";

const BLOCK_FILL_STYLE: React.CSSProperties = {
  backgroundImage: "radial-gradient(rgba(21,21,21,0.09) 0.7px, transparent 0.7px)",
  backgroundSize: "5px 5px",
  backgroundColor: "rgba(21,21,21,0.04)",
};

interface Props {
  blockId: string;
  type: PlannerBlockType;
  title: string;
  emoji?: string | null; // deprecated — ignored
  subtitle?: string;
  /** When true, renders a single-line layout suited for the simple planner view. */
  compact?: boolean;
  onClick?: () => void;
  onChanged: () => void;
}

export function BlockCard({ blockId, type, title, subtitle, compact = false, onClick, onChanged }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Remove this block?")) return;
    startTransition(async () => {
      await removePlannerBlock(blockId);
      onChanged();
    });
  }

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={`rounded-lg border border-ink-3 px-2 py-1.5 flex items-center gap-2 cursor-pointer ${isPending ? "opacity-60" : ""}`}
        style={BLOCK_FILL_STYLE}
      >
        <span className="shrink-0 leading-none"><BlockIcon type={type} size={14} /></span>
        <div className="font-sans font-bold text-xs text-ink truncate flex-1 min-w-0">{title}</div>
        <button
          onClick={handleRemove}
          aria-label="Remove block"
          className="text-ink-3 hover:text-[#ef8c8f] text-xs"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border border-ink-3 p-3 flex items-start gap-3 cursor-pointer ${isPending ? "opacity-60" : ""}`}
      style={BLOCK_FILL_STYLE}
    >
      <span className="shrink-0 leading-none"><BlockIcon type={type} /></span>
      <div className="flex-1 min-w-0">
        <div className="font-sans font-bold text-sm text-ink truncate">{title}</div>
        {subtitle && (
          <div className="font-sans text-[11px] font-medium text-ink-2 mt-0.5">{subtitle}</div>
        )}
      </div>
      <button
        onClick={handleRemove}
        aria-label="Remove block"
        className="text-ink-3 hover:text-[#ef8c8f] text-xs"
      >
        ✕
      </button>
    </div>
  );
}
