import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchUserPlanners, fetchSavedShares } from "@/lib/queries";
import { MyPlannersClient } from "./client";

export const metadata = {
  title: "My planners — Kidtinerary",
};

export const dynamic = "force-dynamic";

export default async function MyPlannersPage() {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [planners, savedShares, kidsRes] = await Promise.all([
    fetchUserPlanners(user.id),
    fetchSavedShares(user.id),
    supabase
      .from("children")
      .select("id, name")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
  ]);

  // Save counts for "N saved" pill on each owned planner card. The RPC
  // filters internally by auth.uid() — no parameter needed.
  const { data: countRows } = await supabase.rpc(
    "get_save_counts_for_share_owner",
  );
  const saveCountByShareId: Record<string, number> = {};
  for (const row of (countRows ?? []) as { share_id: string; save_count: number | string }[]) {
    saveCountByShareId[row.share_id] = Number(row.save_count) || 0;
  }

  return (
    <MyPlannersClient
      initialPlanners={planners}
      initialSavedShares={savedShares}
      saveCountByShareId={saveCountByShareId}
      allKids={(kidsRes.data ?? []) as { id: string; name: string }[]}
    />
  );
}
