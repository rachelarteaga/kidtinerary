"use client";

import { useState } from "react";
import { AddCampModal } from "./add-camp-modal";
import { AddBlockModal } from "./add-block-modal";
import { ActivityPickerSection } from "./activity-picker-section";
import type { UserCampWithActivity } from "@/lib/queries";

interface ChildLite {
  id: string;
  name: string;
  color: string;
  avatar_url: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  plannerId: string;
  scope: { childId: string | null; weekStart: string | null };
  shareCampsDefault: boolean;
  kids: ChildLite[];
  userCamps: UserCampWithActivity[];
  initialTab?: "camp" | "block";
  onCampSubmitted: (result: {
    jobId?: string;
    userCampId?: string;
    plannerEntryId?: string | null;
    url?: string;
  }) => void;
  onBlockSubmitted: () => void;
  onActivityPick: (userCampId: string) => void;
}

export function AddEntryModal(props: Props) {
  if (!props.open) return null;
  return <AddEntryModalInner key={`${props.initialTab ?? "camp"}`} {...props} />;
}

function AddEntryModalInner({
  onClose,
  plannerId,
  scope,
  shareCampsDefault,
  kids,
  userCamps,
  initialTab = "camp",
  onCampSubmitted,
  onBlockSubmitted,
  onActivityPick,
}: Props) {
  const [tab, setTab] = useState<"camp" | "block">(initialTab);

  const cellScoped = scope.childId !== null && scope.weekStart !== null;
  const picker = cellScoped && tab === "camp" ? (
    <ActivityPickerSection activities={userCamps} onPick={onActivityPick} />
  ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink/40 cursor-pointer" onClick={onClose} />
      <div className="relative bg-base rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex rounded-full border border-ink-3 bg-surface overflow-hidden">
            <button
              onClick={() => setTab("camp")}
              className={`font-sans text-[11px] uppercase tracking-widest px-3 py-1.5 transition-colors ${
                tab === "camp" ? "bg-ink text-ink-inverse" : "text-ink-2 hover:text-ink"
              }`}
            >
              Camp
            </button>
            <button
              onClick={() => setTab("block")}
              className={`font-sans text-[11px] uppercase tracking-widest px-3 py-1.5 transition-colors ${
                tab === "block" ? "bg-ink text-ink-inverse" : "text-ink-2 hover:text-ink"
              }`}
            >
              Block
            </button>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-2 hover:text-ink text-lg">✕</button>
        </div>

        {tab === "camp" ? (
          <AddCampModal
            open={true}
            embedded={true}
            onClose={onClose}
            plannerId={plannerId}
            scope={scope}
            shareCampsDefault={shareCampsDefault}
            onSubmitted={onCampSubmitted}
            embeddedPicker={picker}
          />
        ) : (
          <AddBlockModal
            open={true}
            embedded={true}
            onClose={onClose}
            plannerId={plannerId}
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
