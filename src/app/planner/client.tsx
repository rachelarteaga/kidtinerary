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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
  const lockedInCount = entries.filter((e) => e.status === "locked_in").length;

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

  function handleExportCalendar() {
    const url = `/api/planner-export?childId=${selectedChildId}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = "kidtinerary-plan.ics";
    a.click();
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="font-serif text-4xl mb-2">My Planner</h1>
          <p className="text-stone text-lg">
            Drag activities onto weeks to build your schedule.
          </p>
        </div>

        {/* Export button — shown when there are locked-in entries */}
        {lockedInCount > 0 && (
          <button
            onClick={handleExportCalendar}
            className="shrink-0 mt-1 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-meadow hover:text-meadow/80 border border-meadow/40 hover:border-meadow/70 rounded-full px-4 py-2 transition-colors cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Export {lockedInCount} locked in
          </button>
        )}
      </div>

      {/* Child selector tabs */}
      <div className="flex gap-1 mt-6 mb-8 border-b border-driftwood/30">
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
        {/* Mobile: favorites toggle button */}
        <div className="lg:hidden mb-4">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-bark border border-driftwood/30 rounded-full px-4 py-2 bg-white hover:bg-cream transition-colors cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {sidebarOpen ? "Hide favorites" : "Show favorites"}
          </button>
        </div>

        {/* Mobile slide-out panel */}
        {sidebarOpen && (
          <div className="lg:hidden mb-4">
            <PlannerSidebar
              favoriteActivities={favoriteActivities}
              selectedChildId={selectedChildId}
            />
          </div>
        )}

        <div className="flex gap-6 items-start">
          {/* Sidebar - favorites to drag from (desktop only) */}
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
