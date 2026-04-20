import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = (await createClient()) as any;
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const { data } = await supabase
    .from("activities")
    .select("id, name, slug, verified, organization:organizations(id, name), activity_locations(address)")
    .ilike("name", `%${q}%`)
    .eq("is_active", true)
    .limit(8);

  return NextResponse.json({ results: data ?? [] });
}
