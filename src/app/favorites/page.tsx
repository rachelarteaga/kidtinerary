import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchFavoriteActivities } from "@/lib/queries";
import { CampCard } from "@/components/activity/camp-card";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const activities = await fetchFavoriteActivities(user.id);
  const favoriteIds = activities.map((a: any) => a.id);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-serif text-4xl mb-2">Your Favorites</h1>
      <p className="text-stone text-lg mb-8">
        {activities.length > 0
          ? "Activities you've saved for later."
          : "You haven't saved any favorites yet. Explore and tap the heart to save activities here."}
      </p>

      {activities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activities.map((activity: any) => (
            <CampCard
              key={activity.id}
              activity={activity}
              isFavorited={favoriteIds.includes(activity.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="font-serif text-2xl mb-2">Nothing saved yet</p>
          <p className="text-stone mb-6">
            Head over to Explore and find something your kids will love.
          </p>
          <a href="/explore">
            <button className="rounded-full font-mono text-xs uppercase tracking-widest px-6 py-2.5 bg-sunset text-white hover:bg-sunset/90 transition-colors">
              Start Exploring
            </button>
          </a>
        </div>
      )}
    </main>
  );
}
