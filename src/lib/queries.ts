import { createClient } from "@/lib/supabase/server";
import type { PlannerBlockRow, PlannerEntryStatus, ScrapeJobRow } from "@/lib/supabase/types";

export interface ActivityFilters {
  keyword?: string;
  categories?: string[];
  ageMin?: number;
  ageMax?: number;
  childAge?: number;
  indoorOutdoor?: string;
  timeSlot?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "price_low" | "price_high" | "name" | "distance";
  page?: number;
  pageSize?: number;
  lat?: number;
  lng?: number;
  radiusMiles?: number;
}

export interface ActivityRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categories: string[];
  age_min: number | null;
  age_max: number | null;
  indoor_outdoor: string;
  registration_url: string | null;
  data_confidence: string;
  is_active: boolean;
  organization: { id: string; name: string; website: string | null } | null;
  activity_locations: { id: string; address: string; location_name: string | null }[];
  sessions: {
    id: string;
    starts_at: string;
    ends_at: string;
    time_slot: string;
    hours_start: string | null;
    hours_end: string | null;
    is_sold_out: boolean;
    spots_available: number | null;
  }[];
  price_options: {
    id: string;
    label: string;
    price_cents: number;
    price_unit: string;
    conditions: string | null;
    confidence: string;
  }[];
}

const PAGE_SIZE = 12;

export interface ActivityWithDistance extends ActivityRow {
  distance_miles?: number;
}

export async function fetchActivities(filters: ActivityFilters = {}): Promise<{ activities: ActivityWithDistance[]; total: number }> {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // If radius filtering is requested, first get IDs + distances via RPC
  let distanceMap: Map<string, number> | null = null;
  let radiusActivityIds: string[] | null = null;

  if (filters.lat != null && filters.lng != null) {
    const radiusMiles = filters.radiusMiles ?? 20;
    const { data: radiusData, error: radiusError } = await supabase.rpc(
      "activities_within_radius",
      {
        lat: filters.lat,
        lng: filters.lng,
        radius_miles: radiusMiles,
      }
    );

    if (radiusError) {
      console.error("activities_within_radius error:", radiusError);
      return { activities: [], total: 0 };
    }

    distanceMap = new Map<string, number>(
      (radiusData ?? []).map((r: { activity_id: string; distance_miles: number }) => [
        r.activity_id,
        r.distance_miles,
      ])
    );
    radiusActivityIds = Array.from(distanceMap.keys());

    // If no activities in radius, return early
    if (radiusActivityIds.length === 0) {
      return { activities: [], total: 0 };
    }
  }

  let query = supabase
    .from("activities")
    .select(
      `
      id, name, slug, description, categories, age_min, age_max,
      indoor_outdoor, registration_url, data_confidence, is_active,
      organization:organizations!inner(id, name, website),
      activity_locations(id, address, location_name),
      sessions(id, starts_at, ends_at, time_slot, hours_start, hours_end, is_sold_out, spots_available),
      price_options(id, label, price_cents, price_unit, conditions, confidence)
    `,
      { count: "exact" }
    )
    .eq("is_active", true);

  // Radius filter: restrict to IDs returned by RPC
  if (radiusActivityIds != null) {
    query = query.in("id", radiusActivityIds);
  }

  // Keyword search
  if (filters.keyword) {
    query = query.or(
      `name.ilike.%${filters.keyword}%,description.ilike.%${filters.keyword}%`
    );
  }

  // Category filter
  if (filters.categories && filters.categories.length > 0) {
    query = query.overlaps("categories", filters.categories);
  }

  // Age filter: activities whose range overlaps the requested range
  // Single child age: find activities where age_min <= childAge <= age_max
  if (filters.childAge != null) {
    query = query.or(`age_min.lte.${filters.childAge},age_min.is.null`);
    query = query.or(`age_max.gte.${filters.childAge},age_max.is.null`);
  }
  // Legacy range filters (kept for backwards compat)
  if (filters.ageMin != null && filters.childAge == null) {
    query = query.or(`age_max.gte.${filters.ageMin},age_max.is.null`);
  }
  if (filters.ageMax != null && filters.childAge == null) {
    query = query.or(`age_min.lte.${filters.ageMax},age_min.is.null`);
  }

  // Indoor/outdoor
  if (filters.indoorOutdoor && filters.indoorOutdoor !== "all") {
    query = query.or(
      `indoor_outdoor.eq.${filters.indoorOutdoor},indoor_outdoor.eq.both`
    );
  }

  // Sorting (distance sort is applied client-side after attaching distances)
  if (filters.sortBy !== "distance") {
    switch (filters.sortBy) {
      case "price_low":
        query = query.order("name", { ascending: true });
        break;
      case "price_high":
        query = query.order("name", { ascending: false });
        break;
      case "name":
      default:
        query = query.order("name", { ascending: true });
        break;
    }
  } else {
    // Default DB order; will be re-sorted by distance client-side
    query = query.order("name", { ascending: true });
  }

  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error("fetchActivities error:", error);
    return { activities: [] as ActivityWithDistance[], total: 0 };
  }

  let activities = (data ?? []) as ActivityWithDistance[];

  // Attach distances from the RPC result
  if (distanceMap != null) {
    activities = activities.map((a) => ({
      ...a,
      distance_miles: distanceMap!.get(a.id),
    }));
  }

  // Client-side price sort (Supabase can't sort by nested relation)
  if (filters.sortBy === "price_low" || filters.sortBy === "price_high") {
    activities = activities.sort((a, b) => {
      const aMin = Math.min(...(a.price_options?.map((p) => p.price_cents) ?? [Infinity]));
      const bMin = Math.min(...(b.price_options?.map((p) => p.price_cents) ?? [Infinity]));
      return filters.sortBy === "price_low" ? aMin - bMin : bMin - aMin;
    });
  }

  // Client-side distance sort
  if (filters.sortBy === "distance" && distanceMap != null) {
    activities = activities.sort((a, b) => {
      const aDist = a.distance_miles ?? Infinity;
      const bDist = b.distance_miles ?? Infinity;
      return aDist - bDist;
    });
  }

  return { activities, total: count ?? 0 };
}

export async function fetchActivityBySlug(slug: string): Promise<ActivityRow | null> {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from("activities")
    .select(
      `
      id, name, slug, description, categories, age_min, age_max,
      indoor_outdoor, registration_url, data_confidence, is_active,
      scraped_at, last_verified_at, source_url,
      organization:organizations!inner(id, name, website),
      activity_locations(id, address, location_name),
      sessions(id, starts_at, ends_at, time_slot, hours_start, hours_end, is_sold_out, spots_available),
      price_options(id, label, price_cents, price_unit, conditions, confidence)
    `
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) {
    console.error("fetchActivityBySlug error:", error);
    return null;
  }

  return data as ActivityRow;
}

export async function fetchUserFavoriteIds(userId: string): Promise<string[]> {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from("favorites")
    .select("activity_id")
    .eq("user_id", userId);

  if (error) {
    console.error("fetchUserFavoriteIds error:", error);
    return [];
  }

  return (data ?? []).map((f: any) => f.activity_id);
}

export async function fetchFavoriteActivities(userId: string) {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const { data: favs, error: favError } = await supabase
    .from("favorites")
    .select("activity_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (favError || !favs || favs.length === 0) {
    return [];
  }

  const activityIds = favs.map((f: any) => f.activity_id);

  const { data, error } = await supabase
    .from("activities")
    .select(
      `
      id, name, slug, description, categories, age_min, age_max,
      indoor_outdoor, registration_url, data_confidence, is_active,
      organization:organizations!inner(id, name, website),
      activity_locations(id, address, location_name),
      sessions(id, starts_at, ends_at, time_slot, hours_start, hours_end, is_sold_out, spots_available),
      price_options(id, label, price_cents, price_unit, conditions, confidence)
    `
    )
    .in("id", activityIds)
    .eq("is_active", true);

  if (error) {
    console.error("fetchFavoriteActivities error:", error);
    return [];
  }

  return (data ?? []) as ActivityRow[];
}

export async function fetchChildren(userId: string) {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from("children")
    .select("id, name, birth_date, interests, color, sort_order, avatar_url, created_at")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("fetchChildren error:", error);
    return [];
  }

  return data ?? [];
}

export interface PlannerEntryRow {
  id: string;
  user_id: string;
  child_id: string;
  session_id: string;
  status: PlannerEntryStatus;
  sort_order: number;
  notes: string | null;
  created_at: string;
  session: {
    id: string;
    starts_at: string;
    ends_at: string;
    time_slot: string;
    hours_start: string | null;
    hours_end: string | null;
    is_sold_out: boolean;
    activity: {
      id: string;
      name: string;
      slug: string;
      verified: boolean;
      categories: string[];
      registration_url: string | null;
      organization: { id: string; name: string } | null;
      price_options: {
        id: string;
        label: string;
        price_cents: number;
        price_unit: string;
      }[];
      activity_locations: { id: string; address: string; location_name: string | null }[];
    };
  };
}

export async function fetchPlannerEntries(
  userId: string,
  childId: string
): Promise<PlannerEntryRow[]> {
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from("planner_entries")
    .select(
      `
      id, user_id, child_id, session_id, status, sort_order, notes, created_at,
      session:sessions!inner(
        id, starts_at, ends_at, time_slot, hours_start, hours_end, is_sold_out,
        activity:activities!inner(
          id, name, slug, verified, categories, registration_url,
          organization:organizations(id, name),
          price_options(id, label, price_cents, price_unit),
          activity_locations(id, address, location_name)
        )
      )
    `
    )
    .eq("user_id", userId)
    .eq("child_id", childId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("fetchPlannerEntries error:", error);
    return [];
  }

  return (data ?? []) as PlannerEntryRow[];
}

export interface SharedScheduleRow {
  token: string;
  child_id: string;
  date_from: string;
  date_to: string;
  child_name: string;
  entries: {
    id: string;
    status: PlannerEntryStatus;
    sort_order: number;
    session: {
      id: string;
      starts_at: string;
      ends_at: string;
      time_slot: string;
      hours_start: string | null;
      hours_end: string | null;
      is_sold_out: boolean;
      activity: {
        id: string;
        name: string;
        slug: string;
        categories: string[];
        registration_url: string | null;
        organization: { id: string; name: string } | null;
        price_options: {
          id: string;
          label: string;
          price_cents: number;
          price_unit: string;
        }[];
        activity_locations: { id: string; address: string; location_name: string | null }[];
      };
    };
  }[];
}

export async function fetchSharedSchedule(token: string): Promise<SharedScheduleRow | null> {
  // Uses the anon/public Supabase client — no auth required
  const supabase = (await createClient()) as any;

  // Fetch the shared schedule record
  const { data: schedule, error: scheduleError } = await supabase
    .from("shared_schedules")
    .select("token, child_id, date_from, date_to")
    .eq("token", token)
    .single();

  if (scheduleError || !schedule) {
    return null;
  }

  // Fetch the child name
  const { data: child, error: childError } = await supabase
    .from("children")
    .select("name")
    .eq("id", schedule.child_id)
    .single();

  if (childError || !child) {
    return null;
  }

  // Fetch planner entries for this child within the date range, excluding notes
  const { data: entries, error: entriesError } = await supabase
    .from("planner_entries")
    .select(
      `
      id, status, sort_order,
      session:sessions!inner(
        id, starts_at, ends_at, time_slot, hours_start, hours_end, is_sold_out,
        activity:activities!inner(
          id, name, slug, categories, registration_url,
          organization:organizations(id, name),
          price_options(id, label, price_cents, price_unit),
          activity_locations(id, address, location_name)
        )
      )
    `
    )
    .eq("child_id", schedule.child_id)
    .gte("session.starts_at", schedule.date_from)
    .lte("session.starts_at", schedule.date_to)
    .order("sort_order", { ascending: true });

  if (entriesError) {
    console.error("fetchSharedSchedule entries error:", entriesError);
    return null;
  }

  return {
    token: schedule.token,
    child_id: schedule.child_id,
    date_from: schedule.date_from,
    date_to: schedule.date_to,
    child_name: child.name,
    entries: (entries ?? []) as SharedScheduleRow["entries"],
  };
}

export async function fetchFavoriteActivitiesWithSessions(userId: string) {
  const supabase = (await createClient()) as any;

  const { data: favs, error: favError } = await supabase
    .from("favorites")
    .select("activity_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (favError || !favs || favs.length === 0) {
    return [];
  }

  const activityIds = favs.map((f: any) => f.activity_id);

  const { data, error } = await supabase
    .from("activities")
    .select(
      `
      id, name, slug, categories, registration_url,
      organization:organizations!inner(id, name),
      sessions(id, starts_at, ends_at, time_slot, hours_start, hours_end, is_sold_out),
      price_options(id, label, price_cents, price_unit),
      activity_locations(id, address, location_name)
    `
    )
    .in("id", activityIds)
    .eq("is_active", true);

  if (error) {
    console.error("fetchFavoriteActivitiesWithSessions error:", error);
    return [];
  }

  return (data ?? []) as any[];
}

export interface UserCampWithActivity {
  id: string;
  created_at: string;
  activity: {
    id: string;
    name: string;
    slug: string;
    verified: boolean;
    categories: string[];
    organization: { id: string; name: string } | null;
    activity_locations: { id: string; address: string; location_name: string | null }[];
    price_options: { id: string; label: string; price_cents: number; price_unit: string }[];
    sessions: {
      id: string;
      starts_at: string;
      ends_at: string;
      time_slot: string;
      hours_start: string | null;
      hours_end: string | null;
    }[];
  };
  plannerEntryCount: number;
}

export async function fetchUserCamps(userId: string): Promise<UserCampWithActivity[]> {
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from("user_camps")
    .select(`
      id, created_at,
      activity:activities!inner(
        id, name, slug, verified, categories,
        organization:organizations(id, name),
        activity_locations(id, address, location_name),
        price_options(id, label, price_cents, price_unit),
        sessions(id, starts_at, ends_at, time_slot, hours_start, hours_end)
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchUserCamps error:", error);
    return [];
  }

  // Get planner entry counts per activity_id for this user
  const activityIds = (data ?? []).map((r: any) => r.activity.id);
  if (activityIds.length === 0) return [];

  const { data: counts } = await supabase
    .from("planner_entries")
    .select("session:sessions(activity_id)", { count: "exact" })
    .eq("user_id", userId)
    .in("session.activity_id", activityIds);

  const countMap: Record<string, number> = {};
  for (const row of (counts ?? []) as any[]) {
    const aid = row.session?.activity_id;
    if (aid) countMap[aid] = (countMap[aid] ?? 0) + 1;
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    created_at: row.created_at,
    activity: row.activity,
    plannerEntryCount: countMap[row.activity.id] ?? 0,
  }));
}

export interface PlannerBlockWithKids extends PlannerBlockRow {
  child_ids: string[];
}

export async function fetchPlannerBlocks(userId: string): Promise<PlannerBlockWithKids[]> {
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from("planner_blocks")
    .select(`
      id, user_id, type, title, emoji, start_date, end_date, created_at,
      planner_block_kids(child_id)
    `)
    .eq("user_id", userId)
    .order("start_date", { ascending: true });

  if (error) {
    console.error("fetchPlannerBlocks error:", error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    title: row.title,
    emoji: row.emoji,
    start_date: row.start_date,
    end_date: row.end_date,
    created_at: row.created_at,
    child_ids: (row.planner_block_kids ?? []).map((k: any) => k.child_id),
  }));
}

export async function fetchScrapeJob(jobId: string, userId: string): Promise<ScrapeJobRow | null> {
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from("scrape_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("fetchScrapeJob error:", error);
    return null;
  }

  return data as ScrapeJobRow | null;
}
