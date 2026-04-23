import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ActiveSharesClient } from "./client";

export const metadata = {
  title: "Share preferences — Kidtinerary",
};

export const dynamic = "force-dynamic";

export default async function SharingPreferencesPage() {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: shares } = await supabase
    .from("shared_schedules")
    .select(
      "id, token, scope, planner_id, kid_ids, include_cost, include_personal_block_details, created_at"
    )
    .eq("user_id", user.id)
    .eq("scope", "planner")
    .order("created_at", { ascending: false });

  const plannerIds = Array.from(
    new Set((shares ?? []).map((s: any) => s.planner_id).filter(Boolean))
  );

  // Hydrate planner names so the list is readable.
  const plannerNameById: Record<string, string> = {};
  if (plannerIds.length > 0) {
    const { data: planners } = await supabase
      .from("planners")
      .select("id, name")
      .in("id", plannerIds);
    for (const p of (planners ?? []) as { id: string; name: string }[]) {
      plannerNameById[p.id] = p.name;
    }
  }

  const enriched = ((shares ?? []) as any[])
    .filter((s) => s.planner_id && plannerNameById[s.planner_id])
    .map((s) => ({
      id: s.id,
      token: s.token,
      plannerName: plannerNameById[s.planner_id] ?? "Untitled planner",
      kidCount: Array.isArray(s.kid_ids) ? s.kid_ids.length : 0,
      includeCost: !!s.include_cost,
      includePersonalBlockDetails: !!s.include_personal_block_details,
      createdAt: s.created_at,
    }));

  return <ActiveSharesClient shares={enriched} />;
}
