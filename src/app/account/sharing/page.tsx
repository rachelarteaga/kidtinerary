import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function SharingPreferencesPageRedirect() {
  redirect("/account/planners");
}
