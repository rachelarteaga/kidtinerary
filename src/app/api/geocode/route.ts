import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocode";

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");

  if (!address || !address.trim()) {
    return NextResponse.json({ error: "address parameter is required" }, { status: 400 });
  }

  const result = await geocodeAddress(address.trim());

  if (!result) {
    return NextResponse.json({ error: "Could not geocode address" }, { status: 422 });
  }

  return NextResponse.json({
    lat: result.lat,
    lng: result.lng,
    formatted_address: result.formatted_address,
  });
}
