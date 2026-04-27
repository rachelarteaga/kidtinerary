import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchUserActivities, fetchChildren } from "@/lib/queries";
import { CatalogClient } from "./client";

export const metadata = {
  title: "Your catalog — Kidtinerary",
};

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [activities, kids, profile] = await Promise.all([
    fetchUserActivities(user.id),
    fetchChildren(user.id),
    supabase
      .from("profiles")
      .select("share_camps_default, address")
      .eq("id", user.id)
      .maybeSingle()
      .then((r: any) => r.data),
  ]);

  return (
    <CatalogClient
      activities={activities}
      kids={kids}
      shareCampsDefault={profile?.share_camps_default ?? true}
      address={profile?.address ?? null}
    />
  );
}
