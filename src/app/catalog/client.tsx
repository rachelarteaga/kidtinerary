"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { UserActivityWithDetails } from "@/lib/queries";
import { CatalogRow } from "@/components/catalog/catalog-row";
import { CatalogEmptyState } from "@/components/catalog/empty-state";
import { ActivityDetailDrawer } from "@/components/planner/activity-detail-drawer";
import { KidFilter } from "@/components/catalog/kid-filter";
import { SourceFilter } from "@/components/catalog/source-filter";
import { SeasonFilter } from "@/components/catalog/season-filter";
import { CategoryFilter } from "@/components/catalog/category-filter";
import { SortMenu } from "@/components/catalog/sort-menu";
import { AddActivityToCatalogModal } from "@/components/catalog/add-activity-to-catalog-modal";
import { SparkleIcon } from "@/components/ui/sparkle-icon";
import {
  parseFilterState,
  matchesSourceFilter,
  matchesKidFilter,
  bucketSeason,
} from "@/lib/catalog-filters";

interface Props {
  activities: UserActivityWithDetails[];
  kids: { id: string; name: string }[];
}

export function CatalogClient({ activities, kids }: Props) {
  const [activeActivity, setActiveActivity] = useState<UserActivityWithDetails | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const searchParams = useSearchParams();

  const filterState = useMemo(
    () => parseFilterState(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const sortKey = (searchParams.get("sort") ?? "recents") as "recents" | "alpha" | "deadline";

  const filtered = useMemo(() => {
    const f = filterState;
    return activities.filter((a) => {
      // Kid filter (includes __unassigned sentinel)
      if (!matchesKidFilter(a.kidTags, f.kidIds)) return false;

      // Source filter
      if (!matchesSourceFilter(a.source, f.source)) return false;

      // Season filter
      if (f.seasons && f.seasons.length > 0) {
        const earliest =
          a.activity.sessions
            .map((s) => s.starts_at)
            .filter(Boolean)
            .sort()[0] ?? null;
        const bucket = bucketSeason(earliest);
        if (!f.seasons.includes(bucket)) return false;
      }

      // Category filter — match if any of the row's categories are in the filter
      if (f.categories && f.categories.length > 0) {
        const hit = a.activity.categories.some((c) => f.categories!.includes(c));
        if (!hit) return false;
      }

      return true;
    });
  }, [activities, filterState]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortKey === "alpha") {
      arr.sort((a, b) =>
        a.activity.name.toLowerCase().localeCompare(b.activity.name.toLowerCase()),
      );
    } else if (sortKey === "deadline") {
      arr.sort((a, b) => {
        const aD = a.registrationEndDate;
        const bD = b.registrationEndDate;
        if (!aD && !bD) return 0;
        if (!aD) return 1; // nulls last
        if (!bD) return -1;
        return aD.localeCompare(bD);
      });
    } else {
      // recents: created_at desc (already server-ordered, but be defensive)
      arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    return arr;
  }, [filtered, sortKey]);

  function handleHelpMeFind() {
    // TODO: Phase 9 wires the slide-over
    console.log("Help me find — coming soon");
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-ink tracking-tight">
          Your catalog
        </h1>
        <div className="flex items-center gap-2 flex-shrink-0 mt-2">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-surface text-ink border border-ink hover:bg-base"
          >
            + Add activity
          </button>
          <button
            type="button"
            onClick={handleHelpMeFind}
            className="inline-flex items-center gap-1.5 font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-hero text-ink border border-ink hover:brightness-95"
          >
            <SparkleIcon size={11} fill="#151515" />
            Help me find
          </button>
        </div>
      </div>
      <p className="text-ink-2 mb-8">
        Every camp, class &amp; lesson — past, present, considering.
      </p>

      {/* Toolbar: filter chips + sort selector */}
      {activities.length > 0 && (
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <KidFilter kids={kids} value={filterState.kidIds} />
            <SourceFilter value={filterState.source} />
            <SeasonFilter value={filterState.seasons} />
            <CategoryFilter value={filterState.categories} />
          </div>
          <SortMenu value={sortKey} />
        </div>
      )}

      {/* Row list / empty states */}
      {activities.length > 0 && sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-3 bg-surface p-6 text-center">
          <p className="font-sans text-sm text-ink-2">No matches. Try clearing a filter.</p>
        </div>
      ) : sorted.length === 0 ? (
        <CatalogEmptyState onAdd={() => setAddOpen(true)} onHelpMeFind={handleHelpMeFind} />
      ) : (
        <div className="space-y-3">
          {sorted.map((activity) => (
            <CatalogRow
              key={activity.id}
              activity={activity}
              kids={kids}
              onClick={() => setActiveActivity(activity)}
            />
          ))}
        </div>
      )}

      {activeActivity && (
        <ActivityDetailDrawer
          mode="catalog"
          open={true}
          catalogActivity={activeActivity}
          onClose={() => setActiveActivity(null)}
        />
      )}

      <AddActivityToCatalogModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />
    </main>
  );
}
