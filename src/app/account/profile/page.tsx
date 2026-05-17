import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditProfileClient } from "./client";

export const metadata = {
  title: "Edit profile — Kidtinerary",
};

export default async function ProfilePage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, address, phone")
    .eq("id", user.id)
    .single();

  return (
    <EditProfileClient
      initial={{
        firstName: profile?.first_name ?? "",
        lastName: profile?.last_name ?? "",
        email: user.email ?? "",
        address: profile?.address ?? "",
        phone: profile?.phone ?? "",
      }}
    />
  );
}
