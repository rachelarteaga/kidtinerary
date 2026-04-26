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

  const [activities, kids] = await Promise.all([
    fetchUserActivities(user.id),
    fetchChildren(user.id),
  ]);

  return <CatalogClient activities={activities} kids={kids} />;
}
