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
      <aside className="hidden md:flex md:flex-col w-96 shrink-0 md:h-full md:overflow-y-auto md:border-r md:border-ink bg-surface">
        {/* White tab header — fixed at top, doesn't scroll.
            border-b lives here (no horizontal padding) so the divider line
            extends to the rail's left + right edges. Inner tablist holds
            the horizontal padding for the tab buttons themselves. */}
        <div className="bg-surface pt-[14px] flex-shrink-0 border-b-[1.5px] border-ink">
          <div
            role="tablist"
            aria-label="Planner sidebar"
            className="flex gap-1.5 px-6 sm:px-8 lg:px-10"
          >
            <button
              role="tab"
              type="button"
              aria-selected={tab === "activities"}
              aria-controls="panel-activities"
              onClick={() => setTab("activities")}
              className={`flex-1 px-2.5 py-2 font-sans font-bold text-[10px] uppercase tracking-widest whitespace-nowrap rounded-t-lg border-l-[1.5px] border-r-[1.5px] border-t-[1.5px] transition-colors ${
                tab === "activities"
                  ? "bg-[#ebecee] border-ink text-ink -mb-[1.5px] relative z-10"
                  : "bg-[#f5f5f6] border-ink-3 text-[#999] hover:text-ink"
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
              className={`flex-1 px-2.5 py-2 font-sans font-bold text-[10px] uppercase tracking-widest whitespace-nowrap rounded-t-lg border-l-[1.5px] border-r-[1.5px] border-t-[1.5px] transition-colors ${
                tab === "friends"
                  ? "bg-[#dfecf5] border-ink text-ink -mb-[1.5px] relative z-10"
                  : "bg-[#f1f6fa] border-ink-3 text-[#999] hover:text-ink"
              }`}
            >
              Friends&apos; plans
              {props.friends.length > 0 ? ` (${props.friends.length})` : null}
            </button>
          </div>
        </div>

        {/* Content area — color shifts with active tab; scrolls independently */}
        <div
          className={`flex-1 overflow-y-auto px-6 sm:px-8 lg:px-10 pt-4 pb-4 transition-colors ${
            tab === "activities" ? "bg-[#ebecee]" : "bg-[#dfecf5]"
          }`}
        >
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
        </div>
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
