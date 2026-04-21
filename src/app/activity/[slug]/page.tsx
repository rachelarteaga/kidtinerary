import { notFound } from "next/navigation";
import { fetchActivityBySlug } from "@/lib/queries";
import { formatDataFreshness } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DetailHero } from "@/components/activity/detail-hero";
import { SessionTable } from "@/components/activity/session-table";
import { PriceTable } from "@/components/activity/price-table";
import { ReportModal } from "@/components/activity/report-modal";
import { ShareButton } from "@/components/activity/share-button";
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
        <PlannerStub />
        <ShareButton
          title={activity.name}
          url={`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/activity/${activity.slug}`}
        />
      </div>

      {/* Description */}
      {activity.description && (
        <section className="mb-8">
          <h2 className="font-display font-extrabold text-xl mb-3">About this activity</h2>
          <p className="text-ink/80 leading-relaxed">{activity.description}</p>
        </section>
      )}

      {/* Location */}
      {location && (
        <section className="mb-8">
          <h2 className="font-display font-extrabold text-xl mb-3">Location</h2>
          <div className="bg-surface rounded-xl border border-ink-3 p-4">
            {(location as any).location_name && (
              <p className="font-medium mb-1">{(location as any).location_name}</p>
            )}
            <p className="text-ink-2 text-sm">{(location as any).address}</p>
            {/* Map placeholder */}
            <div className="mt-3 h-40 bg-ink-3/10 rounded-lg flex items-center justify-center">
              <span className="font-sans text-[10px] uppercase tracking-wide text-ink-2">
                Map view coming soon
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Sessions */}
      <section className="mb-8">
        <h2 className="font-display font-extrabold text-xl mb-3">Sessions</h2>
        <div className="bg-surface rounded-xl border border-ink-3 p-4">
          <SessionTable sessions={activity.sessions ?? []} />
        </div>
      </section>

      {/* Pricing */}
      <section className="mb-8">
        <h2 className="font-display font-extrabold text-xl mb-3">Pricing</h2>
        <div className="bg-surface rounded-xl border border-ink-3 p-4">
          <PriceTable priceOptions={activity.price_options ?? []} />
        </div>
      </section>

      {/* Data freshness + report */}
      <section className="flex items-center justify-between pt-6 border-t border-ink-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
            freshness.includes("stale") ? "bg-hero-light" : "bg-[#8ec4ad]"
          }`} />
          {(activity as any).source_url ? (
            <span className="font-sans text-[10px] uppercase tracking-wide text-ink-2">
              Info sourced from{" "}
              <a
                href={(activity as any).source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink hover:underline normal-case"
              >
                {(() => {
                  try {
                    return new URL((activity as any).source_url).hostname.replace(/^www\./, "");
                  } catch {
                    return (activity as any).source_url;
                  }
                })()}
              </a>
              {" · "}
              {freshness.replace("Updated ", "").replace("Data may be stale", "may be stale")}
            </span>
          ) : (
            <span className="font-sans text-[10px] uppercase tracking-wide text-ink-2">
              {freshness}
            </span>
          )}
          {activity.registration_url && !(activity as any).source_url && (
            <a
              href={activity.registration_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-sans text-[10px] uppercase tracking-wide text-ink hover:underline"
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
