import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchChildren } from "@/lib/queries";
import { KidsPageClient } from "./client";

export const dynamic = "force-dynamic";

export default async function KidsPage() {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const children = await fetchChildren(user.id);

  return <KidsPageClient initialChildren={children} />;
}
