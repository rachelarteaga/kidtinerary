import { createClient } from "@supabase/supabase-js";
import { geocodeAddress, type GeoResult } from "@/lib/geocode";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not set for scraper");
  return createClient(url, key);
}

/**
 * Returns lat/lng for the given address.
 * Checks activity_locations table first (PostGIS POINT stored as text "POINT(lng lat)").
 * Falls back to Google Maps API on cache miss, but does NOT write — the upsert
 * step owns writing locations to the DB.
 */
export async function geocodeWithCache(address: string): Promise<GeoResult | null> {
  const supabase = getServiceClient() as any;

  // Check if we already have this address geocoded in the DB
  const { data } = await supabase
    .from("activity_locations")
    .select("location")
    .eq("address", address)
    .not("location", "is", null)
    .limit(1)
    .maybeSingle();

  if (data?.location) {
    // location is a PostGIS geography serialized as GeoJSON by Supabase
    // Supabase returns it as { type: "Point", coordinates: [lng, lat] }
    try {
      const geo = typeof data.location === "string"
        ? JSON.parse(data.location)
        : data.location;
      const [lng, lat] = geo.coordinates as [number, number];
      return { lat, lng, formatted_address: address };
    } catch {
      // fall through to API
    }
  }

  // Cache miss — call Google Maps
  return geocodeAddress(address);
}
