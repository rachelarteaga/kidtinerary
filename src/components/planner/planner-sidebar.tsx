"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { formatDateRange, formatTimeSlot } from "@/lib/format";
import type { TimeSlot } from "@/lib/constants";

interface PlannerSidebarProps {
  favoriteActivities: any[];
  selectedChildId: string;
}

export function PlannerSidebar({
  favoriteActivities,
  selectedChildId: _selectedChildId,
}: PlannerSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = favoriteActivities.filter((a: any) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl border border-driftwood/30 p-4">
      <h2 className="font-mono text-xs uppercase tracking-widest text-stone mb-3">
        Your Favorites
      </h2>

      {/* Search within favorites */}
      <input
        type="text"
        placeholder="Filter favorites..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full rounded-lg border border-driftwood/30 bg-cream px-3 py-2 text-sm text-bark placeholder:text-driftwood focus:outline-none focus:border-campfire mb-3"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-driftwood italic">
          {favoriteActivities.length === 0
            ? "Save some favorites from Explore to drag them here."
            : "No favorites match your search."}
        </p>
      ) : (
        <div className="space-y-2 max-h-[calc(100vh-20rem)] overflow-y-auto">
          {filtered.map((activity: any) =>
            (activity.sessions ?? []).map((session: any) => (
              <DraggableSession
                key={session.id}
                activityId={activity.id}
                activityName={activity.name}
                session={session}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function DraggableSession({
  activityId: _activityId,
  activityName,
  session,
}: {
  activityId: string;
  activityName: string;
  session: any;
}) {
  const sessionLabel = `${formatDateRange(session.starts_at, session.ends_at)} · ${formatTimeSlot(session.time_slot as TimeSlot)}`;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `sidebar-${session.id}`,
    data: {
      activityId: _activityId,
      activityName,
      sessionId: session.id,
      sessionLabel,
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`rounded-lg border border-driftwood/20 bg-cream p-3 text-sm cursor-grab active:cursor-grabbing select-none transition-opacity ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <p className="font-medium text-bark truncate">{activityName}</p>
      <p className="font-mono text-[10px] text-stone uppercase tracking-wide mt-0.5">
        {sessionLabel}
      </p>
    </div>
  );
}
