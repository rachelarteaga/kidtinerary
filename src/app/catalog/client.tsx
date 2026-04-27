"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { UserActivityWithDetails } from "@/lib/queries";
import { CatalogRow } from "@/components/catalog/catalog-row";
import { CatalogEmptyState } from "@/components/catalog/empty-state";
import { ActivityDetailDrawer } from "@/components/planner/activity-detail-drawer";
import { AddActivityModal } from "@/components/planner/add-activity-modal";
import { KidFilter } from "@/components/catalog/kid-filter";
import { SourceFilter } from "@/components/catalog/source-filter";
import { SeasonFilter } from "@/components/catalog/season-filter";
import { CategoryFilter } from "@/components/catalog/category-filter";
import { SortMenu } from "@/components/catalog/sort-menu";
import { SparkleIcon } from "@/components/ui/sparkle-icon";
import { HelpMeFindPanel, type KidSummary } from "@/components/catalog/help-me-find-panel";
import { removeFromCatalog } from "@/lib/actions";
import {
  parseFilterState,
  matchesSourceFilter,
  matchesKidFilter,
  bucketSeason,
} from "@/lib/catalog-filters";

interface Props {
  activities: UserActivityWithDetails[];
  kids: KidSummary[];
  shareCampsDefault: boolean;
  address: string | null;
}

export function CatalogClient({ activities, kids, shareCampsDefault, address }: Props) {
  const router = useRouter();
  const [activeActivity, setActiveActivity] = useState<UserActivityWithDetails | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [helpMeFindOpen, setHelpMeFindOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<UserActivityWithDetails | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isRemoving, startRemoveTransition] = useTransition();
  const searchParams = useSearchParams();

  function confirmRemove() {
    if (!pendingRemove) return;
    setRemoveError(null);
    const target = pendingRemove;
    startRemoveTransition(async () => {
      const result = await removeFromCatalog(target.id);
      if (result.error) {
        setRemoveError(result.error);
        return;
      }
      setPendingRemove(null);
      router.refresh();
    });
  }

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
    setHelpMeFindOpen(true);
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
              onRemove={() => {
                setRemoveError(null);
                setPendingRemove(activity);
              }}
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

      <AddActivityModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        shareCampsDefault={shareCampsDefault}
        onSubmitted={() => {
          setAddOpen(false);
          router.refresh();
        }}
      />

      <HelpMeFindPanel
        open={helpMeFindOpen}
        onClose={() => setHelpMeFindOpen(false)}
        kids={kids}
        address={address}
        onSaved={() => router.refresh()}
      />

      {pendingRemove && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Remove ${pendingRemove.activity.name}`}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
        >
          <div
            className="absolute inset-0 bg-ink/40 cursor-pointer"
            onClick={() => !isRemoving && setPendingRemove(null)}
          />
          <div className="relative bg-surface rounded-2xl shadow-xl w-full max-w-sm p-6 border border-ink-3">
            <h3 className="font-display font-extrabold text-xl text-ink mb-2">
              Remove {pendingRemove.activity.name}?
            </h3>
            <p className="text-sm text-ink-2 mb-4 leading-relaxed">
              {pendingRemove.plannerEntryCount > 0 ? (
                <>
                  This will remove {pendingRemove.activity.name} from your catalog AND delete{" "}
                  <strong>{pendingRemove.plannerEntryCount}</strong> planner entr
                  {pendingRemove.plannerEntryCount === 1 ? "y" : "ies"} across your weeks.
                  This cannot be undone.
                </>
              ) : (
                <>This will remove {pendingRemove.activity.name} from your catalog.</>
              )}
            </p>
            {removeError && (
              <p className="font-sans text-xs text-[#c96164] mb-3">{removeError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setPendingRemove(null)}
                disabled={isRemoving}
                className="font-sans font-semibold text-[11px] uppercase tracking-widest px-3 py-1.5 text-ink-2 hover:text-ink disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemove}
                disabled={isRemoving}
                className="font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-[#ef8c8f] text-ink border border-ink hover:brightness-95 disabled:opacity-50"
              >
                {isRemoving ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
