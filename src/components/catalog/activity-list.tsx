"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CampCard } from "@/components/activity/camp-card";
import { Button } from "@/components/ui/button";
import type { ActivityWithDistance } from "@/lib/queries";

interface ActivityListProps {
  activities: ActivityWithDistance[];
  total: number;
  page: number;
  pageSize: number;
}

export function ActivityList({
  activities,
  total,
  page,
  pageSize,
}: ActivityListProps) {

  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.ceil(total / pageSize);

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", p.toString());
    router.push(`/catalog?${params.toString()}`);
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-16">
        <h3 className="font-display font-extrabold text-2xl mb-2">No activities found</h3>
        <p className="text-ink-2">
          Try adjusting your filters or search for something else.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {activities.map((activity) => (
          <CampCard
            key={activity.id}
            activity={activity}
            distance={activity.distance_miles}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="ghost"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="font-sans text-xs text-ink-2 uppercase tracking-wide px-3">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="ghost"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
