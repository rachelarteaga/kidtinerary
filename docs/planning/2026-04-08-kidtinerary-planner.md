# Plan 3: My Planner

## Overview

Build the drag-and-drop planner page at `/planner`. Two-panel layout: left sidebar with draggable favorite activities, right main area with a week-by-week calendar grid. Users select a child via tabs, drag activities onto week drop zones, toggle status between Penciled In and Locked In, add notes, see coverage gaps, and export locked entries as `.ics` files.

**5 tasks total.** Each task builds on the previous.

---

## Task 1: Planner Server Actions and Queries

Add all planner data-access functions to the existing `queries.ts` and `actions.ts` files. These power every subsequent task.

### 1a. Add planner queries to `src/lib/queries.ts`

Append to the end of the file:

```ts
export interface PlannerEntryRow {
  id: string;
  user_id: string;
  child_id: string;
  session_id: string;
  status: "penciled_in" | "locked_in" | "cancelled";
  sort_order: number;
  notes: string | null;
  created_at: string;
  session: {
    id: string;
    starts_at: string;
    ends_at: string;
    time_slot: string;
    hours_start: string | null;
    hours_end: string | null;
    is_sold_out: boolean;
    activity: {
      id: string;
      name: string;
      slug: string;
      categories: string[];
      registration_url: string | null;
      organization: { id: string; name: string } | null;
      price_options: {
        id: string;
        label: string;
        price_cents: number;
        price_unit: string;
      }[];
      activity_locations: { id: string; address: string; location_name: string | null }[];
    };
  };
}

export async function fetchPlannerEntries(
  userId: string,
  childId: string
): Promise<PlannerEntryRow[]> {
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from("planner_entries")
    .select(
      `
      id, user_id, child_id, session_id, status, sort_order, notes, created_at,
      session:sessions!inner(
        id, starts_at, ends_at, time_slot, hours_start, hours_end, is_sold_out,
        activity:activities!inner(
          id, name, slug, categories, registration_url,
          organization:organizations(id, name),
          price_options(id, label, price_cents, price_unit),
          activity_locations(id, address, location_name)
        )
      )
    `
    )
    .eq("user_id", userId)
    .eq("child_id", childId)
    .neq("status", "cancelled")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("fetchPlannerEntries error:", error);
    return [];
  }

  return (data ?? []) as PlannerEntryRow[];
}

export async function fetchFavoriteActivitiesWithSessions(userId: string) {
  const supabase = (await createClient()) as any;

  const { data: favs, error: favError } = await supabase
    .from("favorites")
    .select("activity_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (favError || !favs || favs.length === 0) {
    return [];
  }

  const activityIds = favs.map((f: any) => f.activity_id);

  const { data, error } = await supabase
    .from("activities")
    .select(
      `
      id, name, slug, categories, registration_url,
      organization:organizations!inner(id, name),
      sessions(id, starts_at, ends_at, time_slot, hours_start, hours_end, is_sold_out),
      price_options(id, label, price_cents, price_unit),
      activity_locations(id, address, location_name)
    `
    )
    .in("id", activityIds)
    .eq("is_active", true);

  if (error) {
    console.error("fetchFavoriteActivitiesWithSessions error:", error);
    return [];
  }

  return (data ?? []) as any[];
}
```

### 1b. Add planner actions to `src/lib/actions.ts`

Append to the end of the file:

```ts
export async function addPlannerEntry(
  childId: string,
  sessionId: string,
  sortOrder: number
) {
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from("planner_entries")
    .select("id")
    .eq("user_id", user.id)
    .eq("child_id", childId)
    .eq("session_id", sessionId)
    .neq("status", "cancelled")
    .maybeSingle();

  if (existing) {
    return { error: "This session is already in the planner" };
  }

  const { data, error } = await supabase
    .from("planner_entries")
    .insert({
      user_id: user.id,
      child_id: childId,
      session_id: sessionId,
      status: "penciled_in",
      sort_order: sortOrder,
    })
    .select("id")
    .single();

  if (error) {
    console.error("addPlannerEntry error:", error);
    return { error: "Failed to add to planner" };
  }

  revalidatePath("/planner");
  return { success: true, id: data.id };
}

export async function updatePlannerEntryStatus(
  entryId: string,
  status: "penciled_in" | "locked_in" | "cancelled"
) {
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("planner_entries")
    .update({ status })
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) {
    console.error("updatePlannerEntryStatus error:", error);
    return { error: "Failed to update status" };
  }

  revalidatePath("/planner");
  return { success: true };
}

export async function updatePlannerEntryNotes(
  entryId: string,
  notes: string
) {
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("planner_entries")
    .update({ notes: notes || null })
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) {
    console.error("updatePlannerEntryNotes error:", error);
    return { error: "Failed to update notes" };
  }

  revalidatePath("/planner");
  return { success: true };
}

export async function updatePlannerEntrySortOrder(
  entryId: string,
  sortOrder: number
) {
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("planner_entries")
    .update({ sort_order: sortOrder })
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) {
    console.error("updatePlannerEntrySortOrder error:", error);
    return { error: "Failed to reorder" };
  }

  revalidatePath("/planner");
  return { success: true };
}

export async function removePlannerEntry(entryId: string) {
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("planner_entries")
    .update({ status: "cancelled" })
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) {
    console.error("removePlannerEntry error:", error);
    return { error: "Failed to remove entry" };
  }

  revalidatePath("/planner");
  return { success: true };
}
```

### 1c. Add week formatting helpers to `src/lib/format.ts`

Append to the end of the file:

```ts
/** Returns the Monday of the week containing `date`. */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Sunday=0, shift to Monday-based
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns a unique string key for a week: "2026-W15" ISO format. */
export function getWeekKey(date: Date): string {
  const start = getWeekStart(date);
  const yearStart = new Date(start.getFullYear(), 0, 1);
  const dayOfYear = Math.floor(
    (start.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const weekNum = Math.ceil((dayOfYear + yearStart.getDay() + 1) / 7);
  return `${start.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/** Generates an array of week-start Mondays from `from` to `to`. */
export function generateWeeks(from: Date, to: Date): Date[] {
  const weeks: Date[] = [];
  const current = getWeekStart(new Date(from));
  const end = new Date(to);
  while (current <= end) {
    weeks.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  return weeks;
}

/** Formats a week start date as "Apr 7 – 11" or "Apr 28 – May 2" if cross-month. */
export function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 4); // Friday
  const sMonth = weekStart.toLocaleDateString("en-US", { month: "short" });
  const eMonth = end.toLocaleDateString("en-US", { month: "short" });
  const sDay = weekStart.getDate();
  const eDay = end.getDate();
  if (sMonth === eMonth) {
    return `${sMonth} ${sDay} – ${eDay}`;
  }
  return `${sMonth} ${sDay} – ${eMonth} ${eDay}`;
}
```

### Verification

- Run `npx tsc --noEmit` to confirm no type errors in the new code.

---

## Task 2: Planner Page Shell with Child Tabs and Week Grid

Create the planner page at `/planner` with the server component page, child selector tabs, and the two-panel layout (sidebar placeholder + week grid with empty states).

### 2a. Add "Planner" to navigation

Edit `src/components/layout/nav.tsx` — add the planner link to `NAV_LINKS`:

```ts
const NAV_LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/planner", label: "Planner" },
  { href: "/favorites", label: "Favorites" },
  { href: "/kids", label: "My Kids" },
] as const;
```

### 2b. Create `src/app/planner/page.tsx` (server component)

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchChildren } from "@/lib/queries";
import { fetchPlannerEntries, fetchFavoriteActivitiesWithSessions } from "@/lib/queries";
import { PlannerClient } from "./client";

export const dynamic = "force-dynamic";

export default async function PlannerPage() {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const children = await fetchChildren(user.id);

  if (children.length === 0) {
    redirect("/kids");
  }

  // Load planner entries for the first child (client will refetch on tab switch)
  const firstChildId = children[0].id;
  const entries = await fetchPlannerEntries(user.id, firstChildId);
  const favoriteActivities = await fetchFavoriteActivitiesWithSessions(user.id);

  return (
    <PlannerClient
      children={children}
      initialEntries={entries}
      favoriteActivities={favoriteActivities}
      userId={user.id}
    />
  );
}
```

### 2c. Create `src/app/planner/client.tsx` (client shell)

```tsx
"use client";

import { useState, useMemo } from "react";
import type { PlannerEntryRow } from "@/lib/queries";
import { generateWeeks, getWeekKey, formatWeekRange } from "@/lib/format";
import { WeekRow } from "@/components/planner/week-row";
import { PlannerSidebar } from "@/components/planner/planner-sidebar";

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
  userId,
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

  // Has any entry at all? Used for coverage gap display logic
  const hasAnyEntries = entries.length > 0;

  async function handleChildSwitch(childId: string) {
    setSelectedChildId(childId);
    // Fetch entries for the new child via server action
    const res = await fetch(
      `/api/planner-entries?childId=${childId}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries);
    }
  }

  function handleEntryAdded(entry: PlannerEntryRow) {
    setEntries((prev) => [...prev, entry]);
  }

  function handleEntryUpdated(updated: PlannerEntryRow) {
    setEntries((prev) =>
      prev.map((e) => (e.id === updated.id ? updated : e))
    );
  }

  function handleEntryRemoved(entryId: string) {
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
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

      {/* Two-panel layout */}
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
    </main>
  );
}
```

### 2d. Create `src/app/api/planner-entries/route.ts` (API route for child switching)

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchPlannerEntries } from "@/lib/queries";

export async function GET(request: NextRequest) {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const childId = request.nextUrl.searchParams.get("childId");
  if (!childId) {
    return NextResponse.json({ error: "childId required" }, { status: 400 });
  }

  const entries = await fetchPlannerEntries(user.id, childId);
  return NextResponse.json({ entries });
}
```

### 2e. Create placeholder components

**`src/components/planner/week-row.tsx`** (skeleton for now, fully built in Task 3):

```tsx
"use client";

import type { PlannerEntryRow } from "@/lib/queries";
import { formatWeekRange } from "@/lib/format";

interface WeekRowProps {
  weekKey: string;
  weekStart: Date;
  entries: PlannerEntryRow[];
  hasLockedIn: boolean;
  isCoverageGap: boolean;
  selectedChildId: string;
  onEntryUpdated: (entry: PlannerEntryRow) => void;
  onEntryRemoved: (entryId: string) => void;
}

export function WeekRow({
  weekKey,
  weekStart,
  entries,
  hasLockedIn,
  isCoverageGap,
  selectedChildId,
  onEntryUpdated,
  onEntryRemoved,
}: WeekRowProps) {
  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        isCoverageGap
          ? "border-sunset/30 bg-sunset/5"
          : "border-driftwood/30 bg-white"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-mono text-xs uppercase tracking-widest text-stone">
          {formatWeekRange(weekStart)}
        </h3>
        {isCoverageGap && (
          <a
            href={`/explore?dateFrom=${weekStart.toISOString().split("T")[0]}&dateTo=${new Date(weekStart.getTime() + 4 * 86400000).toISOString().split("T")[0]}`}
            className="font-mono text-[10px] uppercase tracking-wide text-sunset hover:text-sunset/80 transition-colors"
          >
            Need coverage &rarr;
          </a>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-driftwood italic py-3">
          Nothing penciled in for this week yet
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={`rounded-lg border p-3 text-sm ${
                entry.status === "locked_in"
                  ? "border-meadow/40 bg-meadow/5"
                  : hasLockedIn
                    ? "border-driftwood/20 bg-bark/3 opacity-60"
                    : "border-driftwood/20 bg-cream"
              }`}
            >
              <span className="font-medium">{entry.session.activity.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**`src/components/planner/planner-sidebar.tsx`** (skeleton, fully built in Task 3):

```tsx
"use client";

interface PlannerSidebarProps {
  favoriteActivities: any[];
  selectedChildId: string;
}

export function PlannerSidebar({
  favoriteActivities,
  selectedChildId,
}: PlannerSidebarProps) {
  return (
    <div className="bg-white rounded-xl border border-driftwood/30 p-4">
      <h2 className="font-mono text-xs uppercase tracking-widest text-stone mb-4">
        Your Favorites
      </h2>

      {favoriteActivities.length === 0 ? (
        <p className="text-sm text-driftwood italic">
          Save some favorites from Explore to drag them here.
        </p>
      ) : (
        <div className="space-y-2">
          {favoriteActivities.map((activity: any) => (
            <div
              key={activity.id}
              className="rounded-lg border border-driftwood/20 bg-cream p-3 text-sm cursor-grab active:cursor-grabbing"
            >
              <p className="font-medium text-bark truncate">{activity.name}</p>
              <p className="font-mono text-[10px] text-stone uppercase tracking-wide mt-0.5">
                {activity.sessions?.length ?? 0} sessions
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Verification

- Navigate to `/planner` and verify child tabs render and switch.
- Verify week grid shows upcoming 3 months of weeks with empty state text.
- Verify sidebar shows favorite activities.
- Run `npx tsc --noEmit`.

---

## Task 3: Drag and Drop with @dnd-kit

Replace the skeleton sidebar and week row components with full drag-and-drop using `@dnd-kit/core`. The sidebar items are draggable; each week row is a droppable zone. Dropping an activity onto a week calls the `addPlannerEntry` server action.

### 3a. Create `src/components/planner/dnd-provider.tsx`

Wrap the two-panel layout in a DndContext that handles the drag lifecycle:

```tsx
"use client";

import { useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useToast } from "@/components/ui/toast";
import { addPlannerEntry } from "@/lib/actions";
import type { PlannerEntryRow } from "@/lib/queries";
import { fetchPlannerEntries } from "@/lib/queries";

interface DragData {
  activityId: string;
  activityName: string;
  sessionId: string;
  sessionLabel: string;
}

interface PlannerDndProviderProps {
  children: ReactNode;
  selectedChildId: string;
  onEntryAdded: (entry: PlannerEntryRow) => void;
  existingEntryCount: number;
}

export function PlannerDndProvider({
  children,
  selectedChildId,
  onEntryAdded,
  existingEntryCount,
}: PlannerDndProviderProps) {
  const [activeItem, setActiveItem] = useState<DragData | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as DragData | undefined;
    if (data) {
      setActiveItem(data);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);

    const { active, over } = event;
    if (!over) return;

    const dragData = active.data.current as DragData | undefined;
    const dropWeekKey = over.id as string;

    if (!dragData || !dropWeekKey) return;

    const result = await addPlannerEntry(
      selectedChildId,
      dragData.sessionId,
      existingEntryCount
    );

    if (result.error) {
      toast(result.error, "error");
      return;
    }

    toast(`${dragData.activityName} penciled in!`, "success");

    // Refetch entries to get the full row with session data
    // The parent component handles the refresh via router
    // For now, we trigger a client-side refetch
    const res = await fetch(
      `/api/planner-entries?childId=${selectedChildId}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      // Replace all entries — parent will consume via callback
      for (const entry of data.entries) {
        onEntryAdded(entry);
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}

      <DragOverlay>
        {activeItem ? (
          <div className="rounded-lg border border-sunset/40 bg-white shadow-lg p-3 text-sm w-60 opacity-90 rotate-2">
            <p className="font-medium text-bark">{activeItem.activityName}</p>
            <p className="font-mono text-[10px] text-stone uppercase tracking-wide mt-0.5">
              {activeItem.sessionLabel}
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
```

### 3b. Update `src/components/planner/planner-sidebar.tsx` with draggable items

Replace the entire file:

```tsx
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
  selectedChildId,
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
  activityId,
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
      activityId,
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
```

### 3c. Update `src/components/planner/week-row.tsx` with droppable zones

Replace the entire file:

```tsx
"use client";

import { useDroppable } from "@dnd-kit/core";
import type { PlannerEntryRow } from "@/lib/queries";
import { formatWeekRange } from "@/lib/format";
import { PlannerEntryCard } from "@/components/planner/planner-entry-card";

interface WeekRowProps {
  weekKey: string;
  weekStart: Date;
  entries: PlannerEntryRow[];
  hasLockedIn: boolean;
  isCoverageGap: boolean;
  selectedChildId: string;
  onEntryUpdated: (entry: PlannerEntryRow) => void;
  onEntryRemoved: (entryId: string) => void;
}

export function WeekRow({
  weekKey,
  weekStart,
  entries,
  hasLockedIn,
  isCoverageGap,
  selectedChildId,
  onEntryUpdated,
  onEntryRemoved,
}: WeekRowProps) {
  const { isOver, setNodeRef } = useDroppable({ id: weekKey });

  const fridayStr = new Date(
    weekStart.getTime() + 4 * 86400000
  ).toISOString().split("T")[0];
  const mondayStr = weekStart.toISOString().split("T")[0];

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border p-4 transition-colors ${
        isOver
          ? "border-sunset bg-sunset/8 shadow-md"
          : isCoverageGap
            ? "border-sunset/30 bg-sunset/5"
            : "border-driftwood/30 bg-white"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-mono text-xs uppercase tracking-widest text-stone">
          {formatWeekRange(weekStart)}
        </h3>
        {isCoverageGap && (
          <a
            href={`/explore?dateFrom=${mondayStr}&dateTo=${fridayStr}`}
            className="font-mono text-[10px] uppercase tracking-wide text-sunset hover:text-sunset/80 transition-colors"
          >
            Need coverage &rarr;
          </a>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-driftwood italic py-3">
          {isOver
            ? "Drop here to pencil it in"
            : "Nothing penciled in for this week yet"}
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <PlannerEntryCard
              key={entry.id}
              entry={entry}
              isGreyedOut={hasLockedIn && entry.status !== "locked_in"}
              onEntryUpdated={onEntryUpdated}
              onEntryRemoved={onEntryRemoved}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### 3d. Update `src/app/planner/client.tsx` to wrap with DndContext

Replace the two-panel `<div>` section in the return statement, wrapping it with the DndProvider. Also update `handleChildSwitch` to do a full replacement of entries and add a `handleEntriesRefreshed` callback:

In the `PlannerClient` component, replace the `handleEntryAdded` function and the two-panel layout JSX:

```tsx
// Replace the handleEntryAdded function with:
function handleEntriesRefreshed(newEntries: PlannerEntryRow[]) {
  setEntries(newEntries);
}

// In the DndProvider's onEntryAdded, refetch replaces all:
function handleEntryAddedFromDnd(_entry: PlannerEntryRow) {
  // The DndProvider refetches all entries, so we just do a full replace.
  // This is handled by refetch in the DndProvider itself.
}
```

Wrap the two-panel layout JSX like this:

```tsx
import { PlannerDndProvider } from "@/components/planner/dnd-provider";

// ... inside PlannerClient return, replace the two-panel div with:

<PlannerDndProvider
  selectedChildId={selectedChildId}
  onEntryAdded={() => {
    // Refetch all entries for current child
    fetch(`/api/planner-entries?childId=${selectedChildId}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => setEntries(data.entries));
  }}
  existingEntryCount={entries.length}
>
  <div className="flex gap-6 items-start">
    {/* Sidebar */}
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
```

### Verification

- Drag a session from the sidebar onto a week row. Verify the drop zone highlights on hover.
- Verify the overlay shows the activity name while dragging.
- Verify the toast shows "penciled in" on successful drop.
- Verify the entry appears in the week row after drop.
- Run `npx tsc --noEmit`.

---

## Task 4: Entry Cards with Status Toggle, Notes, and Remove

Build the `PlannerEntryCard` component that renders each entry inside a week row. Includes status toggle (Penciled In / Locked In), expandable notes field, remove button, and link to the activity detail page.

### 4a. Create `src/components/planner/planner-entry-card.tsx`

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Tag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import {
  updatePlannerEntryStatus,
  updatePlannerEntryNotes,
  removePlannerEntry,
} from "@/lib/actions";
import { formatDateRange, formatTimeSlot, formatPrice, formatPriceUnit } from "@/lib/format";
import type { PlannerEntryRow } from "@/lib/queries";
import type { TimeSlot, PriceUnit } from "@/lib/constants";

interface PlannerEntryCardProps {
  entry: PlannerEntryRow;
  isGreyedOut: boolean;
  onEntryUpdated: (entry: PlannerEntryRow) => void;
  onEntryRemoved: (entryId: string) => void;
}

export function PlannerEntryCard({
  entry,
  isGreyedOut,
  onEntryUpdated,
  onEntryRemoved,
}: PlannerEntryCardProps) {
  const [showNotes, setShowNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(entry.notes ?? "");
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const activity = entry.session.activity;
  const session = entry.session;
  const lowestPrice = activity.price_options?.length
    ? activity.price_options.reduce(
        (min, p) => (p.price_cents < min.price_cents ? p : min),
        activity.price_options[0]
      )
    : null;

  const isLocked = entry.status === "locked_in";

  function handleToggleStatus() {
    const newStatus = isLocked ? "penciled_in" : "locked_in";
    startTransition(async () => {
      const result = await updatePlannerEntryStatus(entry.id, newStatus);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      onEntryUpdated({ ...entry, status: newStatus });
      toast(
        newStatus === "locked_in"
          ? `${activity.name} locked in!`
          : `${activity.name} back to penciled in`,
        "success"
      );
    });
  }

  function handleSaveNotes() {
    startTransition(async () => {
      const result = await updatePlannerEntryNotes(entry.id, notesValue);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      onEntryUpdated({ ...entry, notes: notesValue || null });
      toast("Notes saved", "success");
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await removePlannerEntry(entry.id);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      onEntryRemoved(entry.id);
      toast(`${activity.name} removed from planner`, "info");
    });
  }

  return (
    <div
      className={`rounded-lg border p-3 transition-opacity ${
        isLocked
          ? "border-meadow/40 bg-meadow/5"
          : isGreyedOut
            ? "border-driftwood/20 bg-bark/3 opacity-50"
            : "border-driftwood/20 bg-cream"
      } ${isPending ? "opacity-60 pointer-events-none" : ""}`}
    >
      {/* Top row: name + actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <Link
            href={`/activity/${activity.slug}`}
            className="font-medium text-sm text-bark hover:text-sunset transition-colors"
          >
            {activity.name}
          </Link>
          {activity.organization && (
            <p className="font-mono text-[10px] text-stone uppercase tracking-wide mt-0.5">
              {(activity.organization as any).name}
            </p>
          )}
        </div>

        {/* Status badge + actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleToggleStatus}
            className={`font-mono text-[10px] uppercase tracking-wide px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
              isLocked
                ? "bg-meadow/15 text-meadow hover:bg-meadow/25"
                : "bg-campfire/15 text-campfire hover:bg-campfire/25"
            }`}
          >
            {isLocked ? "Locked In" : "Penciled In"}
          </button>
          <button
            onClick={handleRemove}
            aria-label="Remove from planner"
            className="w-6 h-6 flex items-center justify-center rounded-full text-driftwood hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Details row: time slot, price, dates */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <Tag
          type="schedule"
          label={formatTimeSlot(session.time_slot as TimeSlot)}
        />
        {lowestPrice && (
          <Tag
            type="category"
            label={`${formatPrice(lowestPrice.price_cents)}${formatPriceUnit(lowestPrice.price_unit as PriceUnit)}`}
          />
        )}
        <span className="font-mono text-[10px] text-stone uppercase tracking-wide">
          {formatDateRange(session.starts_at, session.ends_at)}
        </span>
      </div>

      {/* Notes toggle */}
      <div className="mt-2">
        <button
          onClick={() => setShowNotes(!showNotes)}
          className="font-mono text-[10px] uppercase tracking-wide text-stone hover:text-bark transition-colors cursor-pointer"
        >
          {showNotes ? "Hide notes" : entry.notes ? "View notes" : "Add notes"}
        </button>

        {showNotes && (
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              placeholder="e.g., pack swimsuit"
              className="flex-1 rounded-lg border border-driftwood/30 bg-white px-3 py-1.5 text-sm text-bark placeholder:text-driftwood focus:outline-none focus:border-campfire"
            />
            <button
              onClick={handleSaveNotes}
              className="font-mono text-[10px] uppercase tracking-wide px-3 py-1.5 rounded-lg bg-bark/5 text-bark hover:bg-bark/10 transition-colors cursor-pointer"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Verification

- Click "Penciled In" badge to toggle to "Locked In". Verify badge changes to green.
- Verify other entries in the same week grey out when one is locked in.
- Click "Add notes", type text, click Save. Verify toast confirmation.
- Click X to remove an entry. Verify it disappears and toast shows.
- Click activity name to navigate to its detail page.
- Run `npx tsc --noEmit`.

---

## Task 5: Calendar Export (.ics) and Mobile Sidebar

Build the .ics file export for Locked In entries and add a mobile-friendly slide-out sidebar for the favorites panel (hidden on desktop behind the always-visible sidebar).

### 5a. Create `src/lib/ics.ts` — ICS generation utility

```ts
import type { PlannerEntryRow } from "@/lib/queries";

/** Generate an .ics calendar file string from locked-in planner entries. */
export function generateICS(
  entries: PlannerEntryRow[],
  childName: string
): string {
  const lockedEntries = entries.filter((e) => e.status === "locked_in");

  const events = lockedEntries.map((entry) => {
    const activity = entry.session.activity;
    const session = entry.session;
    const location = activity.activity_locations?.[0];

    // Build date strings — sessions have date-only starts_at/ends_at
    const startDate = session.starts_at.replace(/-/g, "");
    const endDate = session.ends_at.replace(/-/g, "");

    // If we have specific hours, use them; otherwise all-day event
    let dtStart: string;
    let dtEnd: string;
    if (session.hours_start && session.hours_end) {
      const hStart = session.hours_start.replace(/:/g, "").slice(0, 4) + "00";
      const hEnd = session.hours_end.replace(/:/g, "").slice(0, 4) + "00";
      dtStart = `DTSTART:${startDate}T${hStart}`;
      dtEnd = `DTEND:${startDate}T${hEnd}`;
    } else {
      // All-day: ends_at should be day after for ics spec
      const endPlus = new Date(session.ends_at + "T00:00:00");
      endPlus.setDate(endPlus.getDate() + 1);
      const endPlusStr = endPlus.toISOString().split("T")[0].replace(/-/g, "");
      dtStart = `DTSTART;VALUE=DATE:${startDate}`;
      dtEnd = `DTEND;VALUE=DATE:${endPlusStr}`;
    }

    const uid = `${entry.id}@kidtinerary`;
    const summary = escapeICS(`${activity.name} (${childName})`);
    const description = escapeICS(
      [
        entry.notes ? `Notes: ${entry.notes}` : "",
        activity.registration_url
          ? `Register: ${activity.registration_url}`
          : "",
      ]
        .filter(Boolean)
        .join("\\n")
    );
    const locationStr = location
      ? `LOCATION:${escapeICS((location as any).location_name ?? (location as any).address)}`
      : "";

    return [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      dtStart,
      dtEnd,
      `SUMMARY:${summary}`,
      description ? `DESCRIPTION:${description}` : "",
      locationStr,
      `DTSTAMP:${nowUTC()}`,
      "END:VEVENT",
    ]
      .filter(Boolean)
      .join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kidtinerary//Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${childName}'s Activities`,
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function nowUTC(): string {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}
```

### 5b. Add export button to `src/app/planner/client.tsx`

Add this function inside the `PlannerClient` component:

```tsx
import { generateICS } from "@/lib/ics";

// Inside PlannerClient component body:
const selectedChild = children.find((c) => c.id === selectedChildId);

function handleExportCalendar() {
  const lockedEntries = entries.filter((e) => e.status === "locked_in");
  if (lockedEntries.length === 0) {
    toast("No locked-in activities to export. Lock in some entries first!", "info");
    return;
  }
  const ics = generateICS(entries, selectedChild?.name ?? "My Child");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(selectedChild?.name ?? "planner").toLowerCase()}-activities.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast("Calendar file downloaded!", "success");
}
```

Add the `useToast` import and call at the top of the component:

```tsx
import { useToast } from "@/components/ui/toast";

// Inside PlannerClient:
const { toast } = useToast();
```

Add the export button in the header area, after the subtitle `<p>` tag:

```tsx
<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="font-serif text-4xl mb-2">My Planner</h1>
    <p className="text-stone text-lg">
      Drag activities onto weeks to build your schedule.
    </p>
  </div>
  <div className="flex gap-2">
    {/* Mobile sidebar toggle */}
    <button
      onClick={() => setShowMobileSidebar(true)}
      className="lg:hidden rounded-full font-mono text-xs uppercase tracking-widest px-4 py-2.5 bg-bark/5 text-bark hover:bg-bark/10 transition-colors cursor-pointer"
    >
      Favorites
    </button>
    <button
      onClick={handleExportCalendar}
      className="rounded-full font-mono text-xs uppercase tracking-widest px-4 py-2.5 bg-bark/5 text-bark hover:bg-bark/10 transition-colors cursor-pointer"
    >
      Export .ics
    </button>
  </div>
</div>
```

### 5c. Add mobile sidebar slide-out to `src/app/planner/client.tsx`

Add state for mobile sidebar:

```tsx
const [showMobileSidebar, setShowMobileSidebar] = useState(false);
```

Add the mobile sidebar overlay at the end of the `<main>` element, before the closing `</main>` tag:

```tsx
{/* Mobile sidebar overlay */}
{showMobileSidebar && (
  <div className="fixed inset-0 z-50 lg:hidden">
    {/* Backdrop */}
    <div
      className="absolute inset-0 bg-bark/40"
      onClick={() => setShowMobileSidebar(false)}
    />
    {/* Panel */}
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-cream shadow-xl overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-mono text-xs uppercase tracking-widest text-stone">
          Your Favorites
        </h2>
        <button
          onClick={() => setShowMobileSidebar(false)}
          className="w-8 h-8 flex items-center justify-center rounded-full text-stone hover:text-bark hover:bg-bark/5 transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <PlannerSidebar
        favoriteActivities={favoriteActivities}
        selectedChildId={selectedChildId}
      />
    </div>
  </div>
)}
```

### Verification

- Click "Export .ics" with locked-in entries. Verify a `.ics` file downloads.
- Open the file in a text editor and verify it contains valid VCALENDAR/VEVENT blocks.
- Import the `.ics` into Google Calendar or Apple Calendar and verify events appear.
- On mobile viewport, verify "Favorites" button opens slide-out panel.
- Verify the backdrop closes the panel on click.
- Run `npx tsc --noEmit`.
- Run `npm test` to verify no regressions.

---

## Summary of files created/modified

| File | Action |
|------|--------|
| `src/lib/queries.ts` | Modified — added `PlannerEntryRow`, `fetchPlannerEntries`, `fetchFavoriteActivitiesWithSessions` |
| `src/lib/actions.ts` | Modified — added `addPlannerEntry`, `updatePlannerEntryStatus`, `updatePlannerEntryNotes`, `updatePlannerEntrySortOrder`, `removePlannerEntry` |
| `src/lib/format.ts` | Modified — added `getWeekStart`, `getWeekKey`, `generateWeeks`, `formatWeekRange` |
| `src/lib/ics.ts` | Created — ICS calendar file generation |
| `src/components/layout/nav.tsx` | Modified — added Planner link |
| `src/app/planner/page.tsx` | Created — server component page |
| `src/app/planner/client.tsx` | Created — client shell with child tabs, week grid, export, mobile sidebar |
| `src/app/api/planner-entries/route.ts` | Created — API route for child-switch refetch |
| `src/components/planner/dnd-provider.tsx` | Created — DndContext wrapper |
| `src/components/planner/planner-sidebar.tsx` | Created — draggable favorites sidebar |
| `src/components/planner/week-row.tsx` | Created — droppable week row |
| `src/components/planner/planner-entry-card.tsx` | Created — entry card with status toggle, notes, remove |
