import { createClient } from "@/lib/supabase/server";

export interface ActivityFilters {
  keyword?: string;
  categories?: string[];
  ageMin?: number;
  ageMax?: number;
  indoorOutdoor?: string;
  timeSlot?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "price_low" | "price_high" | "name";
  page?: number;
  pageSize?: number;
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

export async function fetchActivities(filters: ActivityFilters = {}) {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

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
  if (filters.ageMin != null) {
    query = query.or(`age_max.gte.${filters.ageMin},age_max.is.null`);
  }
  if (filters.ageMax != null) {
    query = query.or(`age_min.lte.${filters.ageMax},age_min.is.null`);
  }

  // Indoor/outdoor
  if (filters.indoorOutdoor && filters.indoorOutdoor !== "all") {
    query = query.or(
      `indoor_outdoor.eq.${filters.indoorOutdoor},indoor_outdoor.eq.both`
    );
  }

  // Sorting
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

  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error("fetchActivities error:", error);
    return { activities: [] as ActivityRow[], total: 0 };
  }

  let activities = (data ?? []) as ActivityRow[];

  // Client-side price sort (Supabase can't sort by nested relation)
  if (filters.sortBy === "price_low" || filters.sortBy === "price_high") {
    activities = activities.sort((a, b) => {
      const aMin = Math.min(...(a.price_options?.map((p) => p.price_cents) ?? [Infinity]));
      const bMin = Math.min(...(b.price_options?.map((p) => p.price_cents) ?? [Infinity]));
      return filters.sortBy === "price_low" ? aMin - bMin : bMin - aMin;
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
    .select("id, name, birth_date, interests, created_at")
    .eq("user_id", userId)
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
  status: "penciled_in" | "locked_in" | "cancelled";
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
          id, name, slug, categories, registration_url,
          organization:organizations(id, name),
          price_options(id, label, price_cents, price_unit),
          activity_locations(id, address, location_name)
        )
      )
    `
    )
    .eq("user_id", userId)
    .eq("child_id", childId)
    .neq("status", "cancelled")
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
    status: "penciled_in" | "locked_in" | "cancelled";
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
    .neq("status", "cancelled")
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
