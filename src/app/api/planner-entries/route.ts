import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchPlannerEntries } from "@/lib/queries";

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

  const entries = await fetchPlannerEntries(user.id, childId, plannerId);
  return NextResponse.json({ entries });
}
