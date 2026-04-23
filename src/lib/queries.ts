import { createClient } from "@/lib/supabase/server";
import type { PlannerBlockRow, PlannerEntryStatus, PlannerRow, ScrapeJobRow } from "@/lib/supabase/types";

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

export async function fetchPlannerKids(plannerId: string, _userId: string) {
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from("planner_kids")
    .select(`
      child_id, sort_order,
      child:children!inner(id, name, birth_date, interests, color, sort_order, avatar_url, created_at)
    `)
    .eq("planner_id", plannerId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("fetchPlannerKids error:", error);
    return [];
  }

  const rows = (data ?? []).filter((r: any) => r.child && r.child.id);
  return rows.map((r: any) => r.child);
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
  planner_id: string;
  price_cents: number | null;
  price_unit: "per_week" | "per_day" | null;
  extras: Array<{ label: string; cost_cents: number; unit: "per_week" | "per_day" }>;
  session_part: "full" | "am" | "pm" | "overnight";
  days_of_week: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">;
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
      description: string | null;
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
      planner_id, price_cents, price_unit, extras, session_part, days_of_week,
      session:sessions!inner(
        id, starts_at, ends_at, time_slot, hours_start, hours_end, is_sold_out,
        activity:activities!inner(
          id, name, slug, verified, categories, registration_url, description,
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

export type SharedByTokenResult =
  | {
      type: "planner";
      token: string;
      plannerId: string;
      plannerName: string;
      plannerStart: string; // YYYY-MM-DD
      plannerEnd: string; // YYYY-MM-DD
      ownerDisplayName: string | null;
      kidIds: string[];
      includeCost: boolean;
      includePersonalBlockDetails: boolean;
      colorByActivityId: Record<string, string>;
      kids: {
        id: string;
        name: string;
        birth_date: string;
        avatar_url: string | null;
        color: string;
      }[];
      entries: {
        id: string;
        child_id: string;
        status: string;
        sort_order: number;
        notes: string | null;
        price_cents: number | null;
        price_unit: string | null;
        session_part: string | null;
        days_of_week: string[] | null;
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
            description: string | null;
            organization: { id: string; name: string } | null;
            activity_locations: { id: string; address: string; location_name: string | null }[];
          };
        };
      }[];
      blocks: {
        id: string;
        type: string;
        title: string;
        start_date: string;
        end_date: string;
        kid_ids: string[];
      }[];
    }
  | {
      type: "camp";
      token: string;
      campId: string;
      recommenderNote: string | null;
    }
  | { type: "notfound" };

export async function fetchSharedPlannerByToken(token: string): Promise<SharedByTokenResult> {
  const supabase = (await createClient()) as any;

  const { data: share, error: shareErr } = await supabase
    .from("shared_schedules")
    .select(
      "token, scope, user_id, planner_id, camp_id, kid_ids, include_cost, include_personal_block_details, recommender_note"
    )
    .eq("token", token)
    .single();

  if (shareErr || !share) return { type: "notfound" };

  if (share.scope === "camp") {
    if (!share.camp_id) return { type: "notfound" };
    return {
      type: "camp",
      token,
      campId: share.camp_id,
      recommenderNote: share.recommender_note ?? null,
    };
  }

  // Planner scope
  if (!share.planner_id) return { type: "notfound" };

  const { data: planner, error: plannerErr } = await supabase
    .from("planners")
    .select("id, name, start_date, end_date")
    .eq("id", share.planner_id)
    .single();
  if (plannerErr || !planner) return { type: "notfound" };

  // Public resolver for the owner's display name — returns the scalar value
  // directly in `data`. If the RPC hasn't been applied to the DB yet (or any
  // other failure), fall through to `null` so the header gracefully omits
  // "· X's planner".
  const { data: nameRow } = await supabase.rpc("get_profile_display_name", {
    target_user_id: share.user_id,
  });
  const ownerDisplayName: string | null =
    typeof nameRow === "string" && nameRow.trim().length > 0 ? nameRow : null;

  const kidIds: string[] = Array.isArray(share.kid_ids) ? share.kid_ids : [];

  // Fetch kids through planner_kids so we inherit the owner's column order
  // (drag-reorder updates planner_kids.sort_order, NOT children.sort_order).
  const { data: plannerKidRows } = await supabase
    .from("planner_kids")
    .select(`
      sort_order,
      child:children!inner(id, name, birth_date, avatar_url, color)
    `)
    .eq("planner_id", share.planner_id)
    .in("child_id", kidIds.length > 0 ? kidIds : ["00000000-0000-0000-0000-000000000000"])
    .order("sort_order", { ascending: true });

  const kids = (plannerKidRows ?? [])
    .map((r: any) => r.child)
    .filter((c: any) => c && c.id);

  const { data: entries } = await supabase
    .from("planner_entries")
    .select(
      `
      id, child_id, status, sort_order, notes, price_cents, price_unit,
      session_part, days_of_week,
      session:sessions!inner(
        id, starts_at, ends_at, time_slot, hours_start, hours_end, is_sold_out,
        activity:activities!inner(
          id, name, slug, categories, registration_url, description,
          organization:organizations(id, name),
          activity_locations(id, address, location_name)
        )
      )
    `
    )
    .eq("planner_id", share.planner_id)
    .in("child_id", kidIds.length > 0 ? kidIds : ["00000000-0000-0000-0000-000000000000"])
    .order("sort_order", { ascending: true });

  const { data: blockRows } = await supabase
    .from("planner_blocks")
    .select(
      `
      id, type, title, start_date, end_date,
      block_kids:planner_block_kids(child_id)
    `
    )
    .eq("planner_id", share.planner_id);

  const blocks = (blockRows ?? [])
    .map((b: any) => ({
      id: b.id,
      type: b.type,
      title: b.title ?? "",
      start_date: b.start_date,
      end_date: b.end_date,
      kid_ids: (b.block_kids ?? []).map((bk: any) => bk.child_id),
    }))
    .filter((b: { kid_ids: string[] }) => b.kid_ids.some((id: string) => kidIds.includes(id)));

  // Collect owner's camp colors for activities present in the entries
  const activityIds = Array.from(
    new Set((entries ?? []).map((e: any) => e.session.activity.id))
  );

  const { data: userCamps } = await supabase
    .from("user_camps")
    .select("activity_id, color")
    .eq("user_id", share.user_id)
    .in("activity_id", activityIds.length > 0 ? activityIds : ["00000000-0000-0000-0000-000000000000"]);

  const colorByActivityId: Record<string, string> = {};
  for (const uc of (userCamps ?? []) as { activity_id: string; color: string }[]) {
    colorByActivityId[uc.activity_id] = uc.color;
  }

  // kids is already ordered by planner_kids.sort_order from the query above.
  const sortedKids = kids;

  return {
    type: "planner",
    token,
    plannerId: planner.id,
    plannerName: planner.name,
    plannerStart: planner.start_date,
    plannerEnd: planner.end_date,
    ownerDisplayName,
    kidIds,
    includeCost: !!share.include_cost,
    includePersonalBlockDetails: !!share.include_personal_block_details,
    colorByActivityId,
    kids: sortedKids.map((k: any) => ({
      id: k.id,
      name: k.name,
      birth_date: k.birth_date,
      avatar_url: k.avatar_url,
      color: k.color,
    })),
    entries: (entries ?? []) as any,
    blocks,
  };
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
  color: string;
  activity: {
    id: string;
    name: string;
    slug: string;
    verified: boolean;
    source: "user" | "curated";
    source_url: string | null;
    categories: string[];
    description: string | null;
    age_min: number | null;
    age_max: number | null;
    registration_url: string | null;
    organization_id: string | null;
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
      id, created_at, color,
      activity:activities!inner(
        id, name, slug, verified, source, source_url, categories, description, age_min, age_max, registration_url, organization_id,
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
    color: row.color,
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
      id, user_id, type, title, emoji, start_date, end_date, created_at, planner_id,
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
    planner_id: row.planner_id,
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

export async function fetchDefaultPlanner(userId: string): Promise<PlannerRow | null> {
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from("planners")
    .select("id, user_id, name, start_date, end_date, is_default, created_at")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  if (error) {
    console.error("fetchDefaultPlanner error:", error);
    return null;
  }
  return data as PlannerRow | null;
}
