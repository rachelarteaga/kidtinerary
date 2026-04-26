"use client";

import { useState } from "react";
import type { UserActivityWithDetails } from "@/lib/queries";
import { CatalogRow } from "@/components/catalog/catalog-row";
import { CatalogEmptyState } from "@/components/catalog/empty-state";
import { ActivityDetailDrawer } from "@/components/planner/activity-detail-drawer";

interface Props {
  activities: UserActivityWithDetails[];
  kids: { id: string; name: string }[];
}

export function CatalogClient({ activities, kids }: Props) {
  const [activeActivity, setActiveActivity] = useState<UserActivityWithDetails | null>(null);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-ink tracking-tight">
        Your catalog
      </h1>
      <p className="text-ink-2 mb-8">
        Every camp, class &amp; lesson — past, present, considering.
      </p>

      {activities.length === 0 ? (
        <CatalogEmptyState />
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
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
    </main>
  );
}
