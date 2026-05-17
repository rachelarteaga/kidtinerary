"use client";

import { useState } from "react";
import { MyActivitiesContent } from "./my-activities-content";
import { MyActivitiesRail } from "./my-activities-rail";
import { FriendsPlansPanel, type FriendForRail } from "./friends-plans-panel";
import type { UserActivityWithDetails } from "@/lib/queries";

type TabKey = "activities" | "friends";

interface Props {
  // MyActivitiesRail props (desktop tab + mobile sheet)
  activities: UserActivityWithDetails[];
  onChipClick: (activity: UserActivityWithDetails) => void;
  onAddClick: () => void;
  onChanged?: () => void;
  onActivityPlacementTap?: (activity: UserActivityWithDetails) => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  // Friends panel props
  friends: FriendForRail[];
  onFriendRemoved?: (shareId: string) => void;
}

export function PlannerRail(props: Props) {
  const [tab, setTab] = useState<TabKey>("activities");

  return (
    <>
      {/* Desktop: tabbed rail. MyActivitiesRail is rendered below in
          mobileOnly mode so its desktop <aside> doesn't duplicate this one. */}
      <aside className="hidden md:flex md:flex-col w-80 shrink-0 md:h-full md:overflow-y-auto bg-[#dfecf5] md:border-r md:border-ink px-6 sm:px-8 lg:px-10 pt-[22px] pb-4">
        <div
          role="tablist"
          aria-label="Planner sidebar"
          className="flex gap-1 mb-3 flex-shrink-0"
        >
          <button
            role="tab"
            type="button"
            aria-selected={tab === "activities"}
            aria-controls="panel-activities"
            onClick={() => setTab("activities")}
            className={`flex-1 font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-2 rounded-full border ${
              tab === "activities"
                ? "bg-ink text-ink-inverse border-ink"
                : "bg-transparent text-ink border-ink-3"
            }`}
          >
            My activities
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={tab === "friends"}
            aria-controls="panel-friends"
            onClick={() => setTab("friends")}
            className={`flex-1 font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-2 rounded-full border ${
              tab === "friends"
                ? "bg-ink text-ink-inverse border-ink"
                : "bg-transparent text-ink border-ink-3"
            }`}
          >
            Friends&apos; plans
            {props.friends.length > 0 ? ` (${props.friends.length})` : null}
          </button>
        </div>

        {tab === "activities" ? (
          <div role="tabpanel" id="panel-activities">
            <MyActivitiesContent
              activities={props.activities}
              onChipClick={props.onChipClick}
              onAddClick={props.onAddClick}
              onChanged={props.onChanged}
            />
          </div>
        ) : (
          <div role="tabpanel" id="panel-friends">
            <FriendsPlansPanel
              friends={props.friends}
              onRemoved={props.onFriendRemoved}
            />
          </div>
        )}
      </aside>

      {/* Mobile: delegate to MyActivitiesRail's bottom-sheet path. Pass
          mobileOnly so its desktop <aside> is suppressed (we own the desktop
          chrome above). Friends'-plans tab on mobile is out of scope for V1. */}
      <MyActivitiesRail
        mobileOnly
        activities={props.activities}
        onChipClick={props.onChipClick}
        onAddClick={props.onAddClick}
        onChanged={props.onChanged}
        onActivityPlacementTap={props.onActivityPlacementTap}
        mobileOpen={props.mobileOpen}
        onMobileOpenChange={props.onMobileOpenChange}
      />
    </>
  );
}
