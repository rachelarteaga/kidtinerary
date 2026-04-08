import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchActivityBySlug, fetchUserFavoriteIds } from "@/lib/queries";
import { formatDataFreshness } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import { DetailHero } from "@/components/activity/detail-hero";
import { SessionTable } from "@/components/activity/session-table";
import { PriceTable } from "@/components/activity/price-table";
import { ReportModal } from "@/components/activity/report-modal";
import { PlannerStub } from "./planner-stub";

export const dynamic = "force-dynamic";

interface ActivityDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ActivityDetailPage({ params }: ActivityDetailPageProps) {
  const { slug } = await params;
  const activity = await fetchActivityBySlug(slug);

  if (!activity) {
    notFound();
  }

  // Get user favorites
  let isFavorited = false;
  try {
    // TODO: remove cast when types are generated
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const favIds = await fetchUserFavoriteIds(user.id);
      isFavorited = favIds.includes(activity.id);
    }
  } catch {
    // Not logged in
  }

  const location = activity.activity_locations?.[0];
  const freshness = formatDataFreshness((activity as any).last_verified_at ?? (activity as any).scraped_at);

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <DetailHero activity={activity} />

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        {activity.registration_url && (
          <a href={activity.registration_url} target="_blank" rel="noopener noreferrer">
            <Button>Visit Camp Website</Button>
          </a>
        )}
        <FavoriteButton activityId={activity.id} initialFavorited={isFavorited} />
        <PlannerStub />
      </div>

      {/* Description */}
      {activity.description && (
        <section className="mb-8">
          <h2 className="font-serif text-xl mb-3">About this activity</h2>
          <p className="text-bark/80 leading-relaxed">{activity.description}</p>
        </section>
      )}

      {/* Location */}
      {location && (
        <section className="mb-8">
          <h2 className="font-serif text-xl mb-3">Location</h2>
          <div className="bg-white rounded-xl border border-driftwood/30 p-4">
            {(location as any).location_name && (
              <p className="font-medium mb-1">{(location as any).location_name}</p>
            )}
            <p className="text-stone text-sm">{(location as any).address}</p>
            {/* Map placeholder */}
            <div className="mt-3 h-40 bg-driftwood/10 rounded-lg flex items-center justify-center">
              <span className="font-mono text-[10px] uppercase tracking-wide text-stone">
                Map view coming soon
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Sessions */}
      <section className="mb-8">
        <h2 className="font-serif text-xl mb-3">Sessions</h2>
        <div className="bg-white rounded-xl border border-driftwood/30 p-4">
          <SessionTable sessions={activity.sessions ?? []} />
        </div>
      </section>

      {/* Pricing */}
      <section className="mb-8">
        <h2 className="font-serif text-xl mb-3">Pricing</h2>
        <div className="bg-white rounded-xl border border-driftwood/30 p-4">
          <PriceTable priceOptions={activity.price_options ?? []} />
        </div>
      </section>

      {/* Data freshness + report */}
      <section className="flex items-center justify-between pt-6 border-t border-driftwood/30">
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${
            freshness.includes("stale") ? "bg-campfire" : "bg-meadow"
          }`} />
          <span className="font-mono text-[10px] uppercase tracking-wide text-stone">
            {freshness}
          </span>
          {activity.registration_url && (
            <a
              href={activity.registration_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase tracking-wide text-sunset hover:underline"
            >
              Verify on camp website
            </a>
          )}
        </div>
        <ReportModal activityId={activity.id} />
      </section>
    </main>
  );
}
