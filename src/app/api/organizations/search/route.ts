import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = (await createClient()) as any;
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  // Orgs that have at least one shared+verified activity attached.
  const { data } = await supabase
    .from("organizations")
    .select("id, name, activities!inner(id)")
    .eq("source", "user")
    .eq("activities.shared", true)
    .eq("activities.verified", true)
    .ilike("name", `%${q}%`)
    .limit(8);

  const results = (data ?? []).map((o: { id: string; name: string }) => ({ id: o.id, name: o.name }));
  return NextResponse.json({ results });
}
