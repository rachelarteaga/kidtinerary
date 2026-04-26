import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchUserActivities } from "@/lib/queries";
import { CatalogClient } from "./client";

export const metadata = {
  title: "Your catalog — Kidtinerary",
};

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const activities = await fetchUserActivities(user.id);

  return <CatalogClient activities={activities} />;
}
