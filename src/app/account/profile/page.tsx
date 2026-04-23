import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditProfileClient } from "./client";

export const metadata = {
  title: "Edit profile — Kidtinerary",
};

export default async function ProfilePage() {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("address, phone")
    .eq("id", user.id)
    .single();

  return (
    <EditProfileClient
      initial={{
        fullName: (user.user_metadata?.full_name as string | undefined) ?? "",
        email: user.email ?? "",
        address: profile?.address ?? "",
        phone: profile?.phone ?? "",
      }}
    />
  );
}
