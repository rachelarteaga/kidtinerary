import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  fetchChildren,
  fetchPlannerEntries,
  fetchUserCamps,
  fetchPlannerBlocks,
  fetchDefaultPlanner,
  fetchPlannerKids,
} from "@/lib/queries";
import { PlannerClient } from "./client";

export const dynamic = "force-dynamic";

export default async function PlannerPage() {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const planner = await fetchDefaultPlanner(user.id);
  if (!planner) redirect("/auth/login");

  // Count active shares for this planner
  const { count: sharesActiveCount } = await supabase
    .from("shared_schedules")
    .select("id", { count: "exact", head: true })
    .eq("planner_id", planner.id)
    .eq("user_id", user.id);

  // Kids on THIS planner (may be empty — user can add via the header).
  const children = await fetchPlannerKids(planner.id, user.id);

  // All the user's kids from their profile — used by the "+ Add kid" menu.
  const allUserKids = await fetchChildren(user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("share_camps_default")
    .eq("id", user.id)
    .maybeSingle();

  const allEntries = (
    await Promise.all(children.map((c: any) => fetchPlannerEntries(user.id, c.id)))
  ).flat();

  const userCamps = await fetchUserCamps(user.id);
  const blocks = await fetchPlannerBlocks(user.id);

  const ownerDisplayName = (user.user_metadata?.full_name as string | undefined) ?? null;

  return (
    <PlannerClient
      kids={children}
      allUserKids={allUserKids}
      entries={allEntries}
      userCamps={userCamps}
      blocks={blocks}
      shareCampsDefault={profile?.share_camps_default ?? true}
      planner={planner}
      sharesActiveCount={sharesActiveCount ?? 0}
      ownerDisplayName={ownerDisplayName}
    />
  );
}
