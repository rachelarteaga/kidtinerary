"use client";

import { useState } from "react";
import { AddCampModal } from "./add-camp-modal";
import { AddBlockModal } from "./add-block-modal";

interface ChildLite {
  id: string;
  name: string;
  color: string;
  avatar_url: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  scope: { childId: string | null; weekStart: string | null };
  shareCampsDefault: boolean;
  kids: ChildLite[];
  initialTab?: "camp" | "block";
  onCampSubmitted: (result: { jobId?: string; userCampId?: string; plannerEntryId?: string | null }) => void;
  onBlockSubmitted: () => void;
}

// Outer component handles open/close. When it opens we use `initialTab` as a key so the
// inner component remounts, resetting tab state to match. This avoids syncing props to
// state with useEffect (which triggers the React compiler's cascading-render warning).
export function AddEntryModal(props: Props) {
  if (!props.open) return null;
  return <AddEntryModalInner key={`${props.initialTab ?? "camp"}`} {...props} />;
}

function AddEntryModalInner({
  onClose,
  scope,
  shareCampsDefault,
  kids,
  initialTab = "camp",
  onCampSubmitted,
  onBlockSubmitted,
}: Props) {
  const [tab, setTab] = useState<"camp" | "block">(initialTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-bark/40" onClick={onClose} />
      <div className="relative bg-cream rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex rounded-full border border-driftwood/40 bg-white overflow-hidden">
            <button
              onClick={() => setTab("camp")}
              className={`font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 transition-colors ${
                tab === "camp" ? "bg-bark text-cream" : "text-stone hover:text-bark"
              }`}
            >
              Camp
            </button>
            <button
              onClick={() => setTab("block")}
              className={`font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 transition-colors ${
                tab === "block" ? "bg-bark text-cream" : "text-stone hover:text-bark"
              }`}
            >
              Block
            </button>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-stone hover:text-bark text-lg">✕</button>
        </div>

        {tab === "camp" ? (
          <AddCampModal
            open={true}
            embedded={true}
            onClose={onClose}
            scope={scope}
            shareCampsDefault={shareCampsDefault}
            onSubmitted={onCampSubmitted}
          />
        ) : (
          <AddBlockModal
            open={true}
            embedded={true}
            onClose={onClose}
            // eslint-disable-next-line react/no-children-prop
            children={kids}
            scope={scope}
            onSubmitted={onBlockSubmitted}
          />
        )}
      </div>
    </div>
  );
}
