import type { PlannerBlockType } from "@/lib/supabase/types";

interface Props {
  type: PlannerBlockType;
  size?: number;
}

/**
 * Filled-black SVG icon for a planner block type. Replaces the emoji
 * treatment used before the visual overhaul. Same icon set across the
 * add-block modal, block-detail drawer, and in-cell block card.
 */
export function BlockIcon({ type, size = 20 }: Props) {
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
