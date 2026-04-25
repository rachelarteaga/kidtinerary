"use client";

import type { UserActivityWithDetails } from "@/lib/queries";
import { CatalogRow } from "@/components/catalog/catalog-row";
import { CatalogEmptyState } from "@/components/catalog/empty-state";

interface Props {
  activities: UserActivityWithDetails[];
}

export function CatalogClient({ activities }: Props) {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-ink tracking-tight">
        Your catalog
      </h1>
      <p className="text-ink-2 mb-8">
        Every camp, class & lesson — past, present, considering.
      </p>

      {activities.length === 0 ? (
        <CatalogEmptyState />
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <CatalogRow key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </main>
  );
}
