import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function splitFullName(full: string): { first: string; last: string } {
  const trimmed = full.trim();
  if (!trimmed) return { first: "", last: "" };
  const idx = trimmed.indexOf(" ");
  if (idx === -1) return { first: trimmed, last: "" };
  return {
    first: trimmed.slice(0, idx).trim(),
    last: trimmed.slice(idx + 1).trim(),
  };
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";

  if (code) {
    // TODO: remove cast when types are generated
    const supabase = (await createClient()) as any;
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const meta = user.user_metadata ?? {};
        const rawGiven = typeof meta.given_name === "string" ? meta.given_name.trim() : "";
        const rawFamily = typeof meta.family_name === "string" ? meta.family_name.trim() : "";
        const rawFull = typeof meta.full_name === "string" ? meta.full_name : "";
        const splitFromFull = splitFullName(rawFull);
        const firstName = rawGiven || splitFromFull.first;
        const lastName = rawFamily || splitFromFull.last;

        // Read existing first/last so we never overwrite a user's edits with
        // raw provider data on a return sign-in.
        const { data: existing } = await supabase
          .from("profiles")
          .select("first_name, last_name, onboarding_completed")
          .eq("id", user.id)
          .maybeSingle();

        const patch: { first_name?: string; last_name?: string } = {};
        if (!existing?.first_name && firstName) patch.first_name = firstName;
        if (!existing?.last_name && lastName) patch.last_name = lastName;
        if (Object.keys(patch).length > 0) {
          await supabase.from("profiles").update(patch).eq("id", user.id);
        }

        const destination = existing?.onboarding_completed ? next : "/onboarding";
        return NextResponse.redirect(`${origin}${destination}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
