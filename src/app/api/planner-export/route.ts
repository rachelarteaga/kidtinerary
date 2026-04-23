import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchPlannerEntries } from "@/lib/queries";
import { generateICS } from "@/lib/ics";

export async function GET(request: NextRequest) {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const childId = request.nextUrl.searchParams.get("childId");
  const plannerId = request.nextUrl.searchParams.get("plannerId");
  if (!childId) {
    return NextResponse.json({ error: "childId required" }, { status: 400 });
  }
  if (!plannerId) {
    return NextResponse.json({ error: "plannerId required" }, { status: 400 });
  }

  const { data: child } = await supabase
    .from("children")
    .select("name")
    .eq("id", childId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!child) {
    return NextResponse.json({ error: "Child not found" }, { status: 404 });
  }

  const entries = await fetchPlannerEntries(user.id, childId, plannerId);
  const origin = request.nextUrl.origin;

  const icsContent = generateICS(entries, child.name, origin);

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kidtinerary-plan.ics"',
      "Cache-Control": "no-store",
    },
  });
}
