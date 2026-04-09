-- Function to find activities within a radius of a point
CREATE OR REPLACE FUNCTION activities_within_radius(
  lat double precision,
  lng double precision,
  radius_miles double precision DEFAULT 20
)
RETURNS TABLE(activity_id uuid, distance_miles double precision)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT al.activity_id,
    ST_Distance(
      al.location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) / 1609.34 AS distance_miles
  FROM activity_locations al
  WHERE ST_DWithin(
    al.location,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_miles * 1609.34  -- convert miles to meters
  )
$$;
