import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchUserPlanners } from "@/lib/queries";
import { MyPlannersClient } from "./client";

export const metadata = {
  title: "My planners — Kidtinerary",
};

export const dynamic = "force-dynamic";

export default async function MyPlannersPage() {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const planners = await fetchUserPlanners(user.id);

  const { data: kids } = await supabase
    .from("children")
    .select("id, name")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  return <MyPlannersClient initialPlanners={planners} allKids={(kids ?? []) as { id: string; name: string }[]} />;
}
