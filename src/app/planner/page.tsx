import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchChildren, fetchPlannerEntries, fetchFavoriteActivitiesWithSessions } from "@/lib/queries";
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
