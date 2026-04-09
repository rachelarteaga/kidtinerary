import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { fetchActivities, fetchUserFavoriteIds, type ActivityFilters, type ActivityWithDistance } from "@/lib/queries";
import { SearchBar } from "@/components/explore/search-bar";
import { FilterSidebar } from "@/components/explore/filter-sidebar";
import { SortBar } from "@/components/explore/sort-bar";
import { ActivityList } from "@/components/explore/activity-list";

export const dynamic = "force-dynamic";

interface ExplorePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = await searchParams;

  // Build filters from URL search params
  const filters: ActivityFilters = {};
  if (typeof params.q === "string") filters.keyword = params.q;
  if (typeof params.category === "string") filters.categories = [params.category];
  if (typeof params.categories === "string" && params.categories) {
    filters.categories = params.categories.split(",").filter(Boolean);
  }
  if (typeof params.age_min === "string") filters.ageMin = parseInt(params.age_min, 10) || undefined;
  if (typeof params.age_max === "string") filters.ageMax = parseInt(params.age_max, 10) || undefined;
  if (typeof params.indoor_outdoor === "string") filters.indoorOutdoor = params.indoor_outdoor;
  if (typeof params.sort === "string") filters.sortBy = params.sort as ActivityFilters["sortBy"];

  // Radius filter params
  if (typeof params.lat === "string") filters.lat = parseFloat(params.lat) || undefined;
  if (typeof params.lng === "string") filters.lng = parseFloat(params.lng) || undefined;
  if (typeof params.radius === "string") filters.radiusMiles = parseInt(params.radius, 10) || undefined;

  const page = typeof params.page === "string" ? parseInt(params.page, 10) || 1 : 1;
  filters.page = page;

  const { activities, total } = await fetchActivities(filters);

  // Get user favorites (if logged in)
  let favoriteIds: string[] = [];
  try {
    // TODO: remove cast when types are generated
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      favoriteIds = await fetchUserFavoriteIds(user.id);
    }
  } catch {
    // Not logged in — that's fine
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero / Search */}
      <div className="mb-8">
        <h1 className="font-serif text-4xl sm:text-5xl mb-2">
          Find something they&apos;ll love
        </h1>
        <p className="text-stone text-lg mb-6">
          Camps, classes, and activities for kids in the Raleigh area.
        </p>
        <Suspense fallback={<div className="h-24 bg-white rounded-2xl animate-pulse" />}>
          <SearchBar />
        </Suspense>
      </div>

      {/* Main content: sidebar + results */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filters sidebar (desktop) */}
        <div className="hidden lg:block w-56 flex-shrink-0">
          <Suspense fallback={null}>
            <FilterSidebar />
          </Suspense>
        </div>

        {/* Results */}
        <div className="flex-1 min-w-0">
          <Suspense fallback={null}>
            <SortBar total={total} />
          </Suspense>
          <Suspense
            fallback={
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl border border-driftwood/30 h-72 animate-pulse"
                  />
                ))}
              </div>
            }
          >
            <ActivityList
              activities={activities as ActivityWithDistance[]}
              favoriteIds={favoriteIds}
              total={total}
              page={page}
              pageSize={12}
            />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
