"use client";

import { useState, useMemo } from "react";
import type { PlannerEntryRow } from "@/lib/queries";
import { generateWeeks, getWeekKey } from "@/lib/format";
import { WeekRow } from "@/components/planner/week-row";
import { PlannerSidebar } from "@/components/planner/planner-sidebar";
import { PlannerDndProvider } from "@/components/planner/dnd-provider";

interface Child {
  id: string;
  name: string;
  birth_date: string;
  interests: string[];
}

interface PlannerClientProps {
  children: Child[];
  initialEntries: PlannerEntryRow[];
  favoriteActivities: any[];
  userId: string;
}

export function PlannerClient({
  children,
  initialEntries,
  favoriteActivities,
  userId: _userId,
}: PlannerClientProps) {
  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id ?? "");
  const [entries, setEntries] = useState<PlannerEntryRow[]>(initialEntries);

  // Default: upcoming 3 months
  const dateRange = useMemo(() => {
    const from = new Date();
    const to = new Date();
    to.setMonth(to.getMonth() + 3);
    return { from, to };
  }, []);

  const weeks = useMemo(
    () => generateWeeks(dateRange.from, dateRange.to),
    [dateRange]
  );

  // Group entries by week key
  const entriesByWeek = useMemo(() => {
    const map: Record<string, PlannerEntryRow[]> = {};
    for (const entry of entries) {
      const startDate = new Date(entry.session.starts_at + "T00:00:00");
      const key = getWeekKey(startDate);
      if (!map[key]) map[key] = [];
      map[key].push(entry);
    }
    // Sort each week's entries by sort_order
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [entries]);

  // Determine which weeks have a locked_in entry (for coverage gap detection)
  const coveredWeeks = useMemo(() => {
    const covered = new Set<string>();
    for (const entry of entries) {
      if (entry.status === "locked_in") {
        const startDate = new Date(entry.session.starts_at + "T00:00:00");
        const key = getWeekKey(startDate);
        covered.add(key);
      }
    }
    return covered;
  }, [entries]);

  const hasAnyEntries = entries.length > 0;

  async function handleChildSwitch(childId: string) {
    setSelectedChildId(childId);
    const res = await fetch(
      `/api/planner-entries?childId=${childId}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries);
    }
  }

  function handleEntryUpdated(updated: PlannerEntryRow) {
    setEntries((prev) =>
      prev.map((e) => (e.id === updated.id ? updated : e))
    );
  }

  function handleEntryRemoved(entryId: string) {
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
  }

  function handleEntriesRefreshed() {
    fetch(`/api/planner-entries?childId=${selectedChildId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setEntries(data.entries));
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <h1 className="font-serif text-4xl mb-2">My Planner</h1>
      <p className="text-stone text-lg mb-6">
        Drag activities onto weeks to build your schedule.
      </p>

      {/* Child selector tabs */}
      <div className="flex gap-1 mb-8 border-b border-driftwood/30">
        {children.map((child) => (
          <button
            key={child.id}
            onClick={() => handleChildSwitch(child.id)}
            className={`px-4 py-2.5 font-mono text-xs uppercase tracking-widest transition-colors rounded-t-lg cursor-pointer ${
              selectedChildId === child.id
                ? "bg-white text-bark border border-driftwood/30 border-b-white -mb-px"
                : "text-stone hover:text-bark hover:bg-bark/5"
            }`}
          >
            {child.name}
          </button>
        ))}
      </div>

      {/* Two-panel layout wrapped in DndContext */}
      <PlannerDndProvider
        selectedChildId={selectedChildId}
        onEntryAdded={handleEntriesRefreshed}
        existingEntryCount={entries.length}
      >
        <div className="flex gap-6 items-start">
          {/* Sidebar - favorites to drag from */}
          <div className="hidden lg:block w-72 shrink-0 sticky top-24">
            <PlannerSidebar
              favoriteActivities={favoriteActivities}
              selectedChildId={selectedChildId}
            />
          </div>

          {/* Week grid */}
          <div className="flex-1 space-y-3">
            {weeks.map((weekStart) => {
              const key = getWeekKey(weekStart);
              const weekEntries = entriesByWeek[key] ?? [];
              const hasLockedIn = weekEntries.some(
                (e) => e.status === "locked_in"
              );
              const isCovered = coveredWeeks.has(key);

              return (
                <WeekRow
                  key={key}
                  weekKey={key}
                  weekStart={weekStart}
                  entries={weekEntries}
                  hasLockedIn={hasLockedIn}
                  isCoverageGap={hasAnyEntries && !isCovered}
                  selectedChildId={selectedChildId}
                  onEntryUpdated={handleEntryUpdated}
                  onEntryRemoved={handleEntryRemoved}
                />
              );
            })}
          </div>
        </div>
      </PlannerDndProvider>
    </main>
  );
}
