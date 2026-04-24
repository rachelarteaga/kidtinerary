import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  fetchChildren,
  fetchPlannerEntries,
  fetchUserCamps,
  fetchPlannerBlocks,
  fetchPlannerById,
  fetchUserPlannerIds,
  fetchPlannerKids,
} from "@/lib/queries";
import { PlannerClient } from "./client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ id?: string }>;
}

export default async function PlannerPage({ searchParams }: PageProps) {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { id: requestedId } = await searchParams;

  // Requested-id path: load that planner if the user owns it.
  let planner = requestedId ? await fetchPlannerById(requestedId, user.id) : null;

  // No id (or bad id): smart redirect — drive first-timers straight into the
  // new-planner flow, open the sole planner for single-planner users, and send
  // multi-planner users to the catalog to pick.
  if (!planner) {
    const ids = await fetchUserPlannerIds(user.id);
    if (ids.length === 0) redirect("/account/planners?new=1");
    if (ids.length > 1) redirect("/account/planners");
    planner = await fetchPlannerById(ids[0], user.id);
    if (!planner) redirect("/account/planners?new=1");
  }

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
    await Promise.all(children.map((c: any) => fetchPlannerEntries(user.id, c.id, planner.id)))
  ).flat();

  const userCamps = await fetchUserCamps(user.id);
  const blocks = await fetchPlannerBlocks(user.id, planner.id);

  const ownerDisplayName = (user.user_metadata?.full_name as string | undefined) ?? null;

  return (
    <PlannerClient
      kids={children}
      allUserKids={allUserKids}
      entries={allEntries}
      userActivities={userCamps}
      blocks={blocks}
      shareCampsDefault={profile?.share_camps_default ?? true}
      planner={planner}
      sharesActiveCount={sharesActiveCount ?? 0}
      ownerDisplayName={ownerDisplayName}
    />
  );
}
