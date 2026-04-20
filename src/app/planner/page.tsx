import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  fetchChildren,
  fetchPlannerEntries,
  fetchUserCamps,
  fetchPlannerBlocks,
  fetchDefaultPlanner,
} from "@/lib/queries";
import { PlannerClient } from "./client";

export const dynamic = "force-dynamic";

export default async function PlannerPage() {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const children = await fetchChildren(user.id);
  if (children.length === 0) redirect("/kids");

  const planner = await fetchDefaultPlanner(user.id);
  if (!planner) redirect("/auth/login");

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

  return (
    <PlannerClient
      kids={children}
      entries={allEntries}
      userCamps={userCamps}
      blocks={blocks}
      shareCampsDefault={profile?.share_camps_default ?? true}
      planner={planner}
    />
  );
}
