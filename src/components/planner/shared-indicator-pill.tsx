"use client";

interface Props {
  shared: boolean;
  onClick: () => void;
}

/**
 * Unified sharing control: shown next to the planner title in both states.
 * Shared = green pulse + "Shared". Not shared = muted outline + "Share".
 * Clicking either opens the share modal, where "Stop sharing" also lives —
 * so sharing on/off/settings all live in one place instead of scattered
 * pill + button + text link combinations.
 */
export function SharePill({ shared, onClick }: Props) {
  if (shared) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Manage sharing — planner is currently shared"
        className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-sans font-bold text-[11px] uppercase tracking-widest cursor-pointer bg-[#eef9f0] text-[#147a30] hover:bg-[#dcf2e0]"
      >
        <span className="relative inline-flex w-2 h-2 items-center justify-center" aria-hidden="true">
          <span className="absolute inset-0 rounded-full bg-[#2cb14a] animate-ping opacity-75" />
          <span className="relative inline-block w-2 h-2 rounded-full bg-[#2cb14a]" />
        </span>
        Shared
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Share planner"
      className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-sans font-bold text-[11px] uppercase tracking-widest cursor-pointer bg-surface border border-ink-3 text-ink-2 hover:bg-base hover:text-ink"
    >
      <span className="w-2 h-2 rounded-full bg-ink-3" aria-hidden="true" />
      Share
    </button>
  );
}
