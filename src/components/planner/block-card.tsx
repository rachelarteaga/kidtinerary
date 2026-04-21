"use client";

import { useTransition } from "react";
import { removePlannerBlock } from "@/lib/actions";
import type { PlannerBlockType } from "@/lib/supabase/types";

const BLOCK_FILL_STYLE: React.CSSProperties = {
  backgroundImage: "radial-gradient(rgba(21,21,21,0.09) 0.7px, transparent 0.7px)",
  backgroundSize: "5px 5px",
  backgroundColor: "rgba(21,21,21,0.04)",
};

function BlockIcon({ type, size = 20 }: { type: PlannerBlockType; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "#151515" };
  switch (type) {
    case "school":
      return (
        <svg {...common} aria-hidden>
          <path d="M12 2 L1 7 L12 12 L21 8.1 L21 14 L23 14 L23 7 Z" />
          <path d="M5 10.5 L5 15.5 C5 17.5 8.5 19 12 19 C15.5 19 19 17.5 19 15.5 L19 10.5 L12 14 Z" />
        </svg>
      );
    case "travel":
      return (
        <svg {...common} aria-hidden>
          <path d="M22 2 L2 10 L10 13 L13 22 Z" />
        </svg>
      );
    case "at_home":
      return (
        <svg {...common} aria-hidden>
          <path d="M12 3 L2 11 L4.5 11 L4.5 20 L9 20 L9 14 L15 14 L15 20 L19.5 20 L19.5 11 L22 11 Z" />
          <rect x={16} y={5} width={2} height={3.5} />
        </svg>
      );
    case "other":
    default:
      return (
        <svg {...common} aria-hidden>
          <polygon points="12,2 14.5,9 22,9 16,13.5 18.5,21 12,16.5 5.5,21 8,13.5 2,9 9.5,9" />
        </svg>
      );
  }
}

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
        className={`rounded-lg border border-ink px-2 py-1.5 flex items-center gap-2 cursor-pointer ${isPending ? "opacity-60" : ""}`}
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
      className={`rounded-xl border border-ink p-3 flex items-start gap-3 cursor-pointer ${isPending ? "opacity-60" : ""}`}
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
