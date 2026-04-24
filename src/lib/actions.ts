"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { nextAvailablePaletteColor } from "@/lib/camp-palette";
import type { SessionPart, DayOfWeek, ExtraItem, PriceUnit } from "@/lib/supabase/types";
import { normalizeDays } from "@/lib/schedule";
import {
  validateSubmitCampInput,
  type SubmitCampRawInput,
} from "@/lib/submit-camp-validation";
import { geocodeAddress } from "@/lib/geocode";
import { validateProfileInput } from "@/lib/actions-profile-validation";
import { generateShareToken } from "@/lib/share-token";

/**
 * Find-or-create a placeholder activity_location for an activity.
 * Used when we need to satisfy the sessions.activity_location_id NOT NULL
 * constraint for user-submitted / week-scoped stub sessions, where we
 * don't yet have a real address.
 */
async function ensureActivityLocation(
  supabase: any,
  activityId: string
): Promise<string | null> {
  // Look for an existing location for this activity
  const { data: existing } = await supabase
    .from("activity_locations")
    .select("id")
    .eq("activity_id", activityId)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  // Create a placeholder location. `location` is NOT NULL (geography point),
  // so use POINT(0 0) as a sentinel; real locations get filled in by the
  // scraper pipeline once the activity is verified.
  const { data: created, error } = await supabase
    .from("activity_locations")
    .insert({
      activity_id: activityId,
      address: "",
      location_name: null,
      location: "POINT(0 0)",
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("ensureActivityLocation error:", error);
    return null;
  }
  return created.id;
}

export async function toggleFavorite(activityId: string) {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Check if already favorited
  const { data: existing } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("activity_id", activityId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("id", existing.id);

    if (error) return { error: "Failed to remove favorite" };
    revalidatePath("/catalog");
    return { favorited: false };
  } else {
    const { error } = await supabase
      .from("favorites")
      .insert({ user_id: user.id, activity_id: activityId });

    if (error) return { error: "Failed to add favorite" };
    revalidatePath("/catalog");
    return { favorited: true };
  }
}

export async function submitReport(
  activityId: string,
  reason: string,
  details: string
) {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase.from("activity_reports").insert({
    user_id: user.id,
    activity_id: activityId,
    reason,
    details: details || null,
    status: "pending",
  });

  if (error) {
    console.error("submitReport error:", error);
    return { error: "Failed to submit report" };
  }

  return { success: true };
}

export async function submitCampUrl(url: string) {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Check if URL already exists
  const { data: existing } = await supabase
    .from("scrape_sources")
    .select("id")
    .eq("url", url)
    .maybeSingle();

  if (existing) {
    return { error: "This URL has already been submitted" };
  }

  const { error } = await supabase.from("scrape_sources").insert({
    url,
    adapter_type: "generic_llm",
    scrape_frequency: "weekly",
  });

  if (error) {
    console.error("submitCampUrl error:", error);
    return { error: "Failed to submit camp" };
  }

  return { success: true };
}

export async function addChild(
  name: string,
  birthDate: string,
  interests: string[]
): Promise<{ success?: boolean; error?: string; childId?: string }> {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const trimmedName = name.trim();
  const { data: existing } = await supabase
    .from("children")
    .select("name")
    .eq("user_id", user.id);

  if (
    existing?.some(
      (k: { name: string }) => k.name.toLowerCase() === trimmedName.toLowerCase()
    )
  ) {
    return { error: `You already have a kid named ${trimmedName}.` };
  }

  const { data, error } = await supabase
    .from("children")
    .insert({
      user_id: user.id,
      name: trimmedName,
      birth_date: birthDate,
      interests,
    })
    .select("id")
    .single();

  if (error) {
    console.error("addChild error:", error);
    return { error: "Failed to add child" };
  }

  revalidatePath("/kids");
  return { success: true, childId: data?.id };
}

export async function updateChild(
  childId: string,
  name: string,
  birthDate: string,
  interests: string[]
) {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const trimmedName = name.trim();
  const { data: existing } = await supabase
    .from("children")
    .select("id, name")
    .eq("user_id", user.id)
    .neq("id", childId);

  if (
    existing?.some(
      (k: { id: string; name: string }) =>
        k.name.toLowerCase() === trimmedName.toLowerCase()
    )
  ) {
    return { error: `You already have a kid named ${trimmedName}.` };
  }

  const { error } = await supabase
    .from("children")
    .update({ name: trimmedName, birth_date: birthDate, interests })
    .eq("id", childId)
    .eq("user_id", user.id);

  if (error) {
    console.error("updateChild error:", error);
    return { error: "Failed to update child" };
  }

  revalidatePath("/kids");
  return { success: true };
}

export async function deleteChild(childId: string) {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("children")
    .delete()
    .eq("id", childId)
    .eq("user_id", user.id);

  if (error) {
    console.error("deleteChild error:", error);
    return { error: "Failed to delete child" };
  }

  revalidatePath("/kids");
  return { success: true };
}

export async function updatePlannerEntryStatus(
  entryId: string,
  status: "considering" | "waitlisted" | "registered"
) {
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("planner_entries")
    .update({ status })
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) {
    console.error("updatePlannerEntryStatus error:", error);
    return { error: "Failed to update status" };
  }

  revalidatePath("/planner");
  return { success: true };
}

export async function updatePlannerEntryNotes(
  entryId: string,
  notes: string
) {
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("planner_entries")
    .update({ notes: notes || null })
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) {
    console.error("updatePlannerEntryNotes error:", error);
    return { error: "Failed to update notes" };
  }

  revalidatePath("/planner");
  return { success: true };
}

export async function updatePlannerEntrySortOrder(
  entryId: string,
  sortOrder: number
) {
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("planner_entries")
    .update({ sort_order: sortOrder })
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) {
    console.error("updatePlannerEntrySortOrder error:", error);
    return { error: "Failed to reorder" };
  }

  revalidatePath("/planner");
  return { success: true };
}

export async function removePlannerEntry(entryId: string) {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("planner_entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) {
    console.error("removePlannerEntry error:", error);
    return { error: "Failed to remove" };
  }

  revalidatePath("/planner");
  return { success: true };
}

export async function setReminder(
  activityId: string,
  type: "registration_opens" | "registration_closes" | "custom",
  remindAt: string
) {
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const validTypes = ["registration_opens", "registration_closes", "custom"];
  if (!validTypes.includes(type)) {
    return { error: "Invalid reminder type" };
  }

  const remindDate = new Date(remindAt);
  if (isNaN(remindDate.getTime()) || remindDate <= new Date()) {
    return { error: "remind_at must be a future date" };
  }

  const { data, error } = await supabase
    .from("reminders")
    .insert({
      user_id: user.id,
      activity_id: activityId,
      type,
      remind_at: remindAt,
      sent_at: null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("setReminder error:", error);
    return { error: "Failed to set reminder" };
  }

  return { success: true, id: data.id };
}

export async function updateNotificationPreferences(
  preferences: Record<string, boolean>
) {
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ notification_preferences: preferences })
    .eq("id", user.id);

  if (error) {
    console.error("updateNotificationPreferences error:", error);
    return { error: "Failed to update notification preferences" };
  }

  return { success: true };
}

export async function createSharedSchedule(
  childId: string,
  dateFrom: string,
  dateTo: string
) {
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const token = crypto.randomUUID();

  const { data, error } = await supabase
    .from("shared_schedules")
    .insert({
      user_id: user.id,
      child_id: childId,
      token,
      date_from: dateFrom,
      date_to: dateTo,
    })
    .select("token")
    .single();

  if (error) {
    console.error("createSharedSchedule error:", error);
    return { error: "Failed to create shared schedule" };
  }

  return { success: true, token: data.token };
}

export async function revokeSharedSchedule(token: string) {
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("shared_schedules")
    .delete()
    .eq("token", token)
    .eq("user_id", user.id);

  if (error) {
    console.error("revokeSharedSchedule error:", error);
    return { error: "Failed to revoke shared schedule" };
  }

  return { success: true };
}

// Planner Hero Redesign actions

interface SubmitCampContext {
  plannerId: string;
  childId?: string;
  weekStart?: string; // YYYY-MM-DD Monday
  initialStatus?: "considering" | "waitlisted" | "registered";
}

export async function submitCamp(
  raw: SubmitCampRawInput,
  context: SubmitCampContext,
): Promise<{
  error?: string;
  jobId?: string;
  userCampId?: string;
  plannerEntryId?: string | null;
  activityId?: string;
}> {
  const validated = validateSubmitCampInput(raw);
  if (!validated.ok) return { error: validated.error };
  const input = validated.value;

  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Caller passes plannerId (the active planner the UI is on). Verify ownership
  // via RLS by selecting it. If it doesn't resolve, bail.
  const { data: planner } = await supabase
    .from("planners")
    .select("id")
    .eq("id", context.plannerId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!planner) return { error: "No planner found — refresh and retry" };

  let activityId: string | null = null;

  if (input.activityId) {
    activityId = input.activityId;
  } else {
    let orgId: string | null = null;
    let activityName: string;

    if (input.orgName && input.campName) {
      const { data: existingOrg } = await supabase
        .from("organizations")
        .select("id")
        .ilike("name", input.orgName)
        .eq("source", "user")
        .maybeSingle();

      if (existingOrg) {
        orgId = existingOrg.id;
      } else {
        const { data: newOrg, error: orgErr } = await supabase
          .from("organizations")
          .insert({ name: input.orgName, source: "user" })
          .select("id")
          .single();
        if (orgErr || !newOrg) {
          console.error("submitCamp org insert error:", orgErr);
          return { error: "Failed to create organization" };
        }
        orgId = newOrg.id;
      }
      activityName = input.campName;
    } else {
      activityName = "New camp";
    }

    const slug =
      activityName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)
      + "-" + Date.now().toString(36);

    const { data: stub, error: stubErr } = await supabase
      .from("activities")
      .insert({
        organization_id: orgId,
        name: activityName,
        slug,
        is_active: true,
        verified: false,
        source: "user",
        shared: input.shared,
        registration_url: input.url ?? null,
        categories: [],
      })
      .select("id")
      .single();

    if (stubErr || !stub) {
      console.error("submitCamp activity insert error:", stubErr);
      return { error: "Failed to create camp entry" };
    }
    activityId = stub.id;
  }

  const { data: existingCamps } = await supabase
    .from("user_camps")
    .select("color")
    .eq("user_id", user.id);

  const usedColors = ((existingCamps ?? []) as { color: string | null }[])
    .map((r) => r.color)
    .filter((c): c is string => typeof c === "string" && c.length > 0);

  const color = nextAvailablePaletteColor(usedColors);

  const { error: ucUpsertErr } = await supabase
    .from("user_camps")
    .upsert(
      { user_id: user.id, activity_id: activityId, color },
      { onConflict: "user_id,activity_id", ignoreDuplicates: true }
    );
  if (ucUpsertErr) {
    console.error("submitCamp user_camps upsert error:", ucUpsertErr);
    return { error: "Failed to save camp to shortlist" };
  }

  const { data: userCamp } = await supabase
    .from("user_camps")
    .select("id, color")
    .eq("user_id", user.id)
    .eq("activity_id", activityId)
    .single();
  if (!userCamp) return { error: "Failed to retrieve user camp" };

  let plannerEntryId: string | null = null;
  if (context.childId && context.weekStart) {
    const weekEnd = new Date(context.weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const { data: matchedSession } = await supabase
      .from("sessions")
      .select("id")
      .eq("activity_id", activityId)
      .gte("starts_at", context.weekStart)
      .lte("starts_at", weekEnd.toISOString().split("T")[0])
      .limit(1)
      .maybeSingle();

    let sessionId = matchedSession?.id;

    if (!sessionId) {
      const locationId = await ensureActivityLocation(supabase, activityId!);
      if (!locationId) return { error: "Could not set up camp location" };

      const { data: newSession, error: sessErr } = await supabase
        .from("sessions")
        .insert({
          activity_id: activityId,
          activity_location_id: locationId,
          starts_at: context.weekStart,
          ends_at: weekEnd.toISOString().split("T")[0],
          time_slot: "full_day",
          is_sold_out: false,
        })
        .select("id")
        .single();
      if (sessErr || !newSession) {
        console.error("submitCamp placeholder session error:", sessErr);
        return { error: "Failed to create session for week" };
      }
      sessionId = newSession.id;
    }

    const { data: entry, error: entryErr } = await supabase
      .from("planner_entries")
      .insert({
        user_id: user.id,
        planner_id: planner.id,
        child_id: context.childId,
        session_id: sessionId,
        status: context.initialStatus ?? "considering",
        sort_order: 0,
        session_part: "full",
        days_of_week: ["mon", "tue", "wed", "thu", "fri"],
      })
      .select("id")
      .single();

    if (entryErr || !entry) {
      console.error("submitCamp planner entry insert error:", entryErr);
      return { error: "Saved camp to shortlist, but couldn't place it in that week" };
    }
    plannerEntryId = entry.id;
  }

  let jobId: string | undefined;
  if (input.url) {
    const { data: job } = await supabase
      .from("scrape_jobs")
      .insert({
        user_id: user.id,
        input: input.url,
        context: {
          child_id: context.childId ?? null,
          week_start: context.weekStart ?? null,
          activity_id: activityId,
        },
        consent_share: input.shared,
        status: "queued",
      })
      .select("id")
      .single();
    jobId = job?.id;
  }

  revalidatePath("/planner");

  return {
    jobId,
    userCampId: userCamp.id,
    plannerEntryId,
    activityId: activityId ?? undefined,
  };
}

export async function updateActivityFields(params: {
  activityId: string;
  name?: string;
  orgName?: string;
  url?: string | null;
  description?: string | null;
  ageMin?: number | null;
  ageMax?: number | null;
  categories?: string[];
  address?: string | null;
  locationName?: string | null;
}): Promise<{ error?: string; orgId?: string | null }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Auth guard: caller must own a user_camps row for this activity.
  const { data: ownership } = await supabase
    .from("user_camps")
    .select("id")
    .eq("user_id", user.id)
    .eq("activity_id", params.activityId)
    .maybeSingle();
  if (!ownership) return { error: "Not your camp" };

  const patch: Record<string, unknown> = {};

  if (params.name !== undefined) {
    const trimmed = params.name.trim();
    if (!trimmed) return { error: "Name can't be blank" };
    patch.name = trimmed;
  }

  if (params.url !== undefined) {
    if (params.url === null || params.url.trim() === "") {
      patch.registration_url = null;
    } else {
      const trimmed = params.url.trim();
      try {
        new URL(trimmed);
      } catch {
        return { error: "That doesn't look like a valid URL." };
      }
      patch.registration_url = trimmed;
    }
  }

  let resolvedOrgId: string | null | undefined = undefined;

  if (params.orgName !== undefined) {
    const trimmed = params.orgName.trim();
    if (!trimmed) {
      patch.organization_id = null;
      resolvedOrgId = null;
    } else {
      const { data: existingOrg } = await supabase
        .from("organizations")
        .select("id")
        .ilike("name", trimmed)
        .eq("source", "user")
        .maybeSingle();
      if (existingOrg) {
        patch.organization_id = existingOrg.id;
        resolvedOrgId = existingOrg.id;
      } else {
        const { data: newOrg, error: orgErr } = await supabase
          .from("organizations")
          .insert({ name: trimmed, source: "user" })
          .select("id")
          .single();
        if (orgErr || !newOrg) {
          console.error("updateActivityFields org insert error:", orgErr);
          return { error: "Failed to save organization" };
        }
        patch.organization_id = newOrg.id;
        resolvedOrgId = newOrg.id;
      }
    }
  }

  if (params.description !== undefined) {
    if (params.description === null) {
      patch.description = null;
    } else {
      const trimmed = params.description.trim();
      patch.description = trimmed.length ? trimmed.slice(0, 4000) : null;
    }
  }

  if (params.ageMin !== undefined) {
    if (params.ageMin === null) {
      patch.age_min = null;
    } else if (!Number.isFinite(params.ageMin) || params.ageMin < 0 || params.ageMin > 25) {
      return { error: "Min age must be between 0 and 25." };
    } else {
      patch.age_min = Math.floor(params.ageMin);
    }
  }

  if (params.ageMax !== undefined) {
    if (params.ageMax === null) {
      patch.age_max = null;
    } else if (!Number.isFinite(params.ageMax) || params.ageMax < 0 || params.ageMax > 25) {
      return { error: "Max age must be between 0 and 25." };
    } else {
      patch.age_max = Math.floor(params.ageMax);
    }
  }

  if (patch.age_min != null && patch.age_max != null && (patch.age_min as number) > (patch.age_max as number)) {
    return { error: "Min age can't exceed max age." };
  }

  if (params.categories !== undefined) {
    const ALLOWED = new Set([
      "sports", "arts", "stem", "nature", "music", "theater",
      "academic", "special_needs", "religious", "swimming", "cooking", "language",
    ]);
    const cleaned = Array.from(new Set(params.categories.filter((c) => ALLOWED.has(c))));
    patch.categories = cleaned;
  }

  const hasActivityPatch = Object.keys(patch).length > 0;
  const hasLocationPatch = params.address !== undefined || params.locationName !== undefined;
  if (!hasActivityPatch && !hasLocationPatch) return {};

  if (hasActivityPatch) {
    const { data: updatedRows, error: updErr } = await supabase
      .from("activities")
      .update(patch)
      .eq("id", params.activityId)
      .select("id");

    if (updErr) {
      console.error("updateActivityFields update error:", updErr);
      return { error: "Failed to save changes" };
    }
    if (!updatedRows || updatedRows.length === 0) {
      console.error("updateActivityFields update silently affected 0 rows — check activities UPDATE RLS policy");
      return { error: "Couldn't save changes — the database rejected the update (RLS policy may be missing)." };
    }
  }

  if (hasLocationPatch) {
    const locationId = await ensureActivityLocation(supabase, params.activityId);
    if (!locationId) return { error: "Could not set up camp location" };

    const locPatch: Record<string, unknown> = {};
    if (params.address !== undefined) {
      locPatch.address = params.address?.trim() ?? "";
    }
    if (params.locationName !== undefined) {
      const trimmedName = params.locationName?.trim() ?? "";
      locPatch.location_name = trimmedName.length ? trimmedName : null;
    }

    const { data: locRows, error: locErr } = await supabase
      .from("activity_locations")
      .update(locPatch)
      .eq("id", locationId)
      .select("id");

    if (locErr) {
      console.error("updateActivityFields location update error:", locErr);
      return { error: "Failed to save location" };
    }
    if (!locRows || locRows.length === 0) {
      console.error("updateActivityFields location update silently affected 0 rows — check activity_locations UPDATE RLS policy");
      return { error: "Couldn't save location — the database rejected the update." };
    }
  }

  revalidatePath("/planner");
  return { orgId: resolvedOrgId };
}

export async function assignCampToWeek(
  plannerId: string,
  userCampId: string,
  childId: string,
  weekStart: string,
  status: "considering" | "waitlisted" | "registered" = "considering"
): Promise<{ error?: string; entryId?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: planner } = await supabase
    .from("planners")
    .select("id")
    .eq("id", plannerId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!planner) return { error: "No planner found — refresh and retry" };

  const { data: uc } = await supabase
    .from("user_camps")
    .select("activity_id")
    .eq("id", userCampId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!uc) return { error: "Camp not in your shortlist" };

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const { data: matchedSession } = await supabase
    .from("sessions")
    .select("id")
    .eq("activity_id", uc.activity_id)
    .gte("starts_at", weekStart)
    .lte("starts_at", weekEnd.toISOString().split("T")[0])
    .limit(1)
    .maybeSingle();

  let sessionId = matchedSession?.id;

  if (!sessionId) {
    const locationId = await ensureActivityLocation(supabase, uc.activity_id);
    if (!locationId) return { error: "Could not set up camp location" };

    const { data: newSession, error: sessErr } = await supabase
      .from("sessions")
      .insert({
        activity_id: uc.activity_id,
        activity_location_id: locationId,
        starts_at: weekStart,
        ends_at: weekEnd.toISOString().split("T")[0],
        time_slot: "full_day",
        is_sold_out: false,
      })
      .select("id")
      .single();
    if (sessErr || !newSession) {
      console.error("assignCampToWeek session insert error:", sessErr);
      return { error: "Failed to create session for week" };
    }
    sessionId = newSession.id;
  }

  if (!sessionId) return { error: "Could not create session" };

  const { data: entry, error } = await supabase
    .from("planner_entries")
    .insert({
      user_id: user.id,
      planner_id: planner.id,
      child_id: childId,
      session_id: sessionId,
      status,
      sort_order: 0,
      session_part: "full",
      days_of_week: ["mon", "tue", "wed", "thu", "fri"],
    })
    .select("id")
    .single();

  if (error || !entry) return { error: "Failed to assign camp" };

  revalidatePath("/planner");
  return { entryId: entry.id };
}

export async function removeCampFromShortlist(userCampId: string): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: uc } = await supabase
    .from("user_camps")
    .select("activity_id")
    .eq("id", userCampId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!uc) return {};

  // Cascade-delete planner entries for this activity for this user.
  const { data: sessionRows } = await supabase
    .from("sessions")
    .select("id")
    .eq("activity_id", uc.activity_id);
  const sessionIds = (sessionRows ?? []).map((s: any) => s.id);

  if (sessionIds.length > 0) {
    await supabase
      .from("planner_entries")
      .delete()
      .eq("user_id", user.id)
      .in("session_id", sessionIds);
  }

  await supabase.from("user_camps").delete().eq("id", userCampId).eq("user_id", user.id);

  revalidatePath("/planner");
  return {};
}

export async function addPlannerBlock(data: {
  plannerId: string;
  type: "school" | "travel" | "at_home" | "other";
  title: string;
  emoji?: string | null;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  childIds: string[];
}): Promise<{ error?: string; blockId?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!data.title.trim()) return { error: "Title required" };
  if (data.childIds.length === 0) return { error: "Pick at least one kid" };
  if (data.startDate > data.endDate) return { error: "End date must be after start" };

  const { data: planner } = await supabase
    .from("planners")
    .select("id")
    .eq("id", data.plannerId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!planner) return { error: "No planner found — refresh and retry" };

  const { data: block, error } = await supabase
    .from("planner_blocks")
    .insert({
      user_id: user.id,
      planner_id: planner.id,
      type: data.type,
      title: data.title.trim(),
      emoji: data.emoji ?? null,
      start_date: data.startDate,
      end_date: data.endDate,
    })
    .select("id")
    .single();

  if (error || !block) {
    console.error("addPlannerBlock error:", error);
    return { error: "Failed to add block" };
  }

  const { error: joinErr } = await supabase
    .from("planner_block_kids")
    .insert(data.childIds.map((cid) => ({ block_id: block.id, child_id: cid })));

  if (joinErr) {
    console.error("addPlannerBlock join error:", joinErr);
    await supabase.from("planner_blocks").delete().eq("id", block.id);
    return { error: "Failed to attach kids" };
  }

  revalidatePath("/planner");
  return { blockId: block.id };
}

export async function removePlannerBlock(blockId: string): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("planner_blocks")
    .delete()
    .eq("id", blockId)
    .eq("user_id", user.id);

  if (error) return { error: "Failed to remove block" };
  revalidatePath("/planner");
  return {};
}

export async function reorderKidColumns(
  plannerId: string,
  orderedChildIds: string[]
): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: planner } = await supabase
    .from("planners")
    .select("id")
    .eq("id", plannerId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!planner) return { error: "Planner not found" };

  const updates = orderedChildIds.map((childId, idx) =>
    supabase
      .from("planner_kids")
      .update({ sort_order: idx })
      .eq("planner_id", plannerId)
      .eq("child_id", childId)
  );
  const results = await Promise.all(updates);
  const firstError = results.find((r: any) => r.error);
  if (firstError) return { error: "Failed to save order" };

  revalidatePath("/planner");
  return {};
}

export async function addKidToPlanner(
  plannerId: string,
  childId: string
): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify planner + child belong to user
  const { data: planner } = await supabase
    .from("planners")
    .select("id")
    .eq("id", plannerId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!planner) return { error: "Planner not found" };

  const { data: child } = await supabase
    .from("children")
    .select("id")
    .eq("id", childId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!child) return { error: "Child not found" };

  // Determine next sort_order
  const { data: max } = await supabase
    .from("planner_kids")
    .select("sort_order")
    .eq("planner_id", plannerId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (max?.sort_order ?? -1) + 1;

  const { error } = await supabase
    .from("planner_kids")
    .upsert(
      { planner_id: plannerId, child_id: childId, sort_order: nextSort },
      { onConflict: "planner_id,child_id", ignoreDuplicates: true }
    );
  if (error) {
    console.error("addKidToPlanner error:", error);
    return { error: "Failed to add kid to planner" };
  }

  revalidatePath("/planner");
  return {};
}

export async function removeKidFromPlanner(
  plannerId: string,
  childId: string
): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify planner ownership
  const { data: planner } = await supabase
    .from("planners")
    .select("id")
    .eq("id", plannerId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!planner) return { error: "Planner not found" };

  const { error } = await supabase
    .from("planner_kids")
    .delete()
    .eq("planner_id", plannerId)
    .eq("child_id", childId);
  if (error) {
    console.error("removeKidFromPlanner error:", error);
    return { error: "Failed to remove kid from planner" };
  }

  revalidatePath("/planner");
  return {};
}

export async function updateChildColor(
  childId: string,
  color: string
): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("children")
    .update({ color })
    .eq("id", childId)
    .eq("user_id", user.id);

  if (error) return { error: "Failed to update color" };
  revalidatePath("/planner");
  revalidatePath("/kids");
  return {};
}

export async function updateShareCampsDefault(
  enabled: boolean
): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ share_camps_default: enabled })
    .eq("id", user.id);

  if (error) return { error: "Failed to update preference" };
  return {};
}

export async function updateChildAvatar(
  childId: string,
  formData: FormData
): Promise<{ error?: string; url?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file provided" };
  if (file.size > 2 * 1024 * 1024) return { error: "File must be under 2MB" };
  if (!file.type.startsWith("image/")) return { error: "Must be an image" };

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${user.id}/${childId}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadErr) {
    console.error("updateChildAvatar storage error:", uploadErr);
    return { error: `Upload failed: ${uploadErr.message ?? "unknown"}` };
  }

  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error: dbErr } = await supabase
    .from("children")
    .update({ avatar_url: urlData.publicUrl })
    .eq("id", childId)
    .eq("user_id", user.id);

  if (dbErr) {
    console.error("updateChildAvatar db error:", dbErr);
    return { error: "Saved upload but failed to update profile" };
  }

  revalidatePath("/planner");
  revalidatePath("/kids");
  return { url: urlData.publicUrl };
}

export async function updateEntrySchedule(
  entryId: string,
  sessionPart: SessionPart,
  daysOfWeek: DayOfWeek[]
): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("planner_entries")
    .update({
      session_part: sessionPart,
      days_of_week: normalizeDays(daysOfWeek),
    })
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) return { error: "Failed to update schedule" };
  revalidatePath("/planner");
  return {};
}

export async function updateEntryPrice(
  entryId: string,
  priceCents: number | null,
  priceUnit: PriceUnit | null
): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("planner_entries")
    .update({ price_cents: priceCents, price_unit: priceUnit })
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) return { error: "Failed to update price" };
  revalidatePath("/planner");
  return {};
}

export async function updateEntryExtras(
  entryId: string,
  extras: ExtraItem[]
): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const cleaned = extras
    .filter((e) => typeof e.label === "string" && e.label.trim().length > 0)
    .map((e) => ({
      label: e.label.trim(),
      cost_cents: Math.max(0, Math.round(e.cost_cents)),
      unit: e.unit === "per_day" ? "per_day" : "per_week",
    }));

  const { error } = await supabase
    .from("planner_entries")
    .update({ extras: cleaned })
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) return { error: "Failed to update extras" };
  revalidatePath("/planner");
  return {};
}

export async function updateEntryNotes(
  entryId: string,
  notes: string
): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("planner_entries")
    .update({ notes: notes.trim() || null })
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) return { error: "Failed to update notes" };
  revalidatePath("/planner");
  return {};
}

export async function updatePlannerName(
  plannerId: string,
  name: string
): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = name.trim();
  if (trimmed.length === 0) return { error: "Name required" };
  if (trimmed.length > 50) return { error: "Name must be 50 characters or fewer" };
  if (!/^[a-zA-Z0-9 \-']+$/.test(trimmed)) return { error: "Use letters, numbers, spaces, hyphens, or apostrophes" };

  const { error } = await supabase
    .from("planners")
    .update({ name: trimmed })
    .eq("id", plannerId)
    .eq("user_id", user.id);

  if (error) return { error: "Failed to update name" };
  revalidatePath("/planner");
  return {};
}

export async function updatePlannerRange(
  plannerId: string,
  startDate: string,
  endDate: string
): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (startDate > endDate) return { error: "End date must be on or after start date" };

  const { error } = await supabase
    .from("planners")
    .update({ start_date: startDate, end_date: endDate })
    .eq("id", plannerId)
    .eq("user_id", user.id);

  if (error) return { error: "Failed to update planner range" };
  revalidatePath("/planner");
  return {};
}

export async function updateBlockDetails(data: {
  blockId: string;
  type: "school" | "travel" | "at_home" | "other";
  title: string;
  emoji?: string | null;
  startDate: string;
  endDate: string;
  childIds: string[];
}): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!data.title.trim()) return { error: "Title required" };
  if (data.childIds.length === 0) return { error: "Pick at least one kid" };
  if (data.startDate > data.endDate) return { error: "End date must be on or after start" };

  const { error: updErr } = await supabase
    .from("planner_blocks")
    .update({
      type: data.type,
      title: data.title.trim(),
      emoji: data.emoji ?? null,
      start_date: data.startDate,
      end_date: data.endDate,
    })
    .eq("id", data.blockId)
    .eq("user_id", user.id);

  if (updErr) return { error: "Failed to update block" };

  // Replace kid join rows
  await supabase.from("planner_block_kids").delete().eq("block_id", data.blockId);
  const { error: joinErr } = await supabase
    .from("planner_block_kids")
    .insert(data.childIds.map((cid) => ({ block_id: data.blockId, child_id: cid })));

  if (joinErr) return { error: "Failed to update kid assignments" };

  revalidatePath("/planner");
  return {};
}

export async function updatePlannerRangeWithCleanup(
  plannerId: string,
  startDate: string,
  endDate: string
): Promise<{ error?: string; removedEntries?: number; removedBlocks?: number }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (startDate > endDate) return { error: "End date must be on or after start date" };

  // Delete entries whose underlying session.starts_at falls outside the new range
  const { data: entries } = await supabase
    .from("planner_entries")
    .select("id, session:sessions!inner(starts_at, ends_at)")
    .eq("planner_id", plannerId)
    .eq("user_id", user.id);

  const outOfRangeEntryIds: string[] = [];
  for (const e of (entries ?? []) as any[]) {
    const start = e.session?.starts_at as string | undefined;
    const end = e.session?.ends_at as string | undefined;
    if (!start || !end) continue;
    if (end < startDate || start > endDate) outOfRangeEntryIds.push(e.id);
  }

  if (outOfRangeEntryIds.length > 0) {
    await supabase.from("planner_entries").delete().in("id", outOfRangeEntryIds);
  }

  // Delete blocks fully outside the new range
  const { data: blocks } = await supabase
    .from("planner_blocks")
    .select("id, start_date, end_date")
    .eq("planner_id", plannerId)
    .eq("user_id", user.id);

  const outOfRangeBlockIds: string[] = [];
  for (const b of (blocks ?? []) as any[]) {
    if (b.end_date < startDate || b.start_date > endDate) outOfRangeBlockIds.push(b.id);
  }

  if (outOfRangeBlockIds.length > 0) {
    await supabase.from("planner_blocks").delete().in("id", outOfRangeBlockIds);
  }

  const { error } = await supabase
    .from("planners")
    .update({ start_date: startDate, end_date: endDate })
    .eq("id", plannerId)
    .eq("user_id", user.id);

  if (error) return { error: "Failed to update planner range" };
  revalidatePath("/planner");
  return { removedEntries: outOfRangeEntryIds.length, removedBlocks: outOfRangeBlockIds.length };
}

export async function updateProfile(input: {
  fullName: string;
  address: string;
  phone: string;
}): Promise<{ error?: string }> {
  const validation = validateProfileInput(input);
  if (validation.error) return { error: validation.error };

  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // 1. Name → auth.users.user_metadata
  const { error: authErr } = await supabase.auth.updateUser({
    data: { full_name: input.fullName.trim() },
  });
  if (authErr) return { error: authErr.message };

  // 2. Address → profiles.address (geocoded formatted form when available).
  //    Location (PostGIS point) is not set here — matches onboarding pattern.
  const addr = input.address.trim();
  let storedAddress: string | null = addr || null;
  if (addr) {
    const geo = await geocodeAddress(addr);
    if (geo) storedAddress = geo.formatted_address;
  }

  const { error: profErr } = await supabase
    .from("profiles")
    .update({
      address: storedAddress,
      phone: input.phone.trim() || null,
      display_name: input.fullName.trim(),
    })
    .eq("id", user.id);
  if (profErr) return { error: profErr.message };

  revalidatePath("/account/profile");
  return {};
}

/**
 * Binary per-planner sharing: at most one active share row per (user, planner).
 * If a row already exists, update it in place (token stays stable while the
 * owner edits filters). If none exists, insert a fresh row with a new token.
 * Toggling OFF happens via revokePlannerShareByPlanner.
 */
export async function createPlannerShare(input: {
  plannerId: string;
  kidIds: string[];
  includeCost: boolean;
  includePersonalBlockDetails: boolean;
}): Promise<{ token?: string; error?: string }> {
  if (input.kidIds.length === 0) return { error: "Select at least one kid." };

  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: existing } = await supabase
    .from("shared_schedules")
    .select("id, token")
    .eq("user_id", user.id)
    .eq("planner_id", input.plannerId)
    .eq("scope", "planner")
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("shared_schedules")
      .update({
        kid_ids: input.kidIds,
        include_cost: input.includeCost,
        include_personal_block_details: input.includePersonalBlockDetails,
      })
      .eq("id", existing.id)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
    revalidatePath("/account/planners");
    revalidatePath("/account/sharing");
    revalidatePath("/planner");
    return { token: existing.token };
  }

  const token = generateShareToken();
  const { error } = await supabase.from("shared_schedules").insert({
    user_id: user.id,
    token,
    scope: "planner",
    planner_id: input.plannerId,
    kid_ids: input.kidIds,
    include_cost: input.includeCost,
    include_personal_block_details: input.includePersonalBlockDetails,
  });
  if (error) return { error: error.message };

  revalidatePath("/account/planners");
  revalidatePath("/account/sharing");
  revalidatePath("/planner");
  return { token };
}

export async function revokePlannerShareByPlanner(plannerId: string): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("shared_schedules")
    .delete()
    .eq("user_id", user.id)
    .eq("planner_id", plannerId)
    .eq("scope", "planner");
  if (error) return { error: error.message };

  revalidatePath("/account/planners");
  revalidatePath("/account/sharing");
  revalidatePath("/planner");
  return {};
}

export async function createCampShare(input: {
  campId: string;
  recommenderNote: string | null;
}): Promise<{ token?: string; error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const token = generateShareToken();
  const { error } = await supabase.from("shared_schedules").insert({
    user_id: user.id,
    token,
    scope: "camp",
    camp_id: input.campId,
    recommender_note: input.recommenderNote,
  });
  if (error) return { error: error.message };

  revalidatePath("/account/sharing");
  return { token };
}

export async function revokeShare(shareId: string): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("shared_schedules")
    .delete()
    .eq("id", shareId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/account/planners");
  revalidatePath("/account/sharing");
  revalidatePath("/planner");
  return {};
}

// ---------------------------------------------------------------------------
// Planner CRUD (My Planners catalog)
// ---------------------------------------------------------------------------

function validatePlannerName(name: string): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { ok: false, error: "Name required" };
  if (trimmed.length > 50) return { ok: false, error: "Name must be 50 characters or fewer" };
  if (!/^[a-zA-Z0-9 \-']+$/.test(trimmed)) {
    return { ok: false, error: "Use letters, numbers, spaces, hyphens, or apostrophes" };
  }
  return { ok: true, value: trimmed };
}

/**
 * Create a new planner. Starts empty — no kids attached. Users add kids
 * on the planner page via the existing "+ Add kid" flow. The signup
 * trigger still seeds a "My planner" for brand-new profiles.
 */
export async function createPlanner(input: {
  name: string;
  startDate: string;
  endDate: string;
}): Promise<{ plannerId?: string; error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const nameCheck = validatePlannerName(input.name);
  if (!nameCheck.ok) return { error: nameCheck.error };
  if (input.startDate > input.endDate) return { error: "End date must be on or after start date" };

  const { data: planner, error: insertErr } = await supabase
    .from("planners")
    .insert({
      user_id: user.id,
      name: nameCheck.value,
      start_date: input.startDate,
      end_date: input.endDate,
    })
    .select("id")
    .single();

  if (insertErr || !planner) {
    console.error("createPlanner error:", insertErr);
    return { error: "Failed to create planner" };
  }

  revalidatePath("/account/planners");
  return { plannerId: planner.id };
}

/**
 * Duplicate a planner. Copies:
 *   - the planner row (new id, name + " (copy)")
 *   - planner_kids junction rows
 *   - planner_entries (same session/child refs, new planner_id)
 *   - planner_blocks + planner_block_kids (new block ids)
 * Does NOT copy shared_schedules — duplicates start un-shared.
 */
export async function duplicatePlanner(plannerId: string): Promise<{ plannerId?: string; error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: src, error: srcErr } = await supabase
    .from("planners")
    .select("id, name, start_date, end_date")
    .eq("id", plannerId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (srcErr || !src) return { error: "Planner not found" };

  const copyBaseName = `${src.name} (copy)`;
  const copyName = copyBaseName.length > 50 ? copyBaseName.slice(0, 50) : copyBaseName;

  const { data: newPlanner, error: insertErr } = await supabase
    .from("planners")
    .insert({
      user_id: user.id,
      name: copyName,
      start_date: src.start_date,
      end_date: src.end_date,
    })
    .select("id")
    .single();
  if (insertErr || !newPlanner) {
    console.error("duplicatePlanner insert error:", insertErr);
    return { error: "Failed to duplicate planner" };
  }

  // planner_kids
  const { data: kids } = await supabase
    .from("planner_kids")
    .select("child_id, sort_order")
    .eq("planner_id", plannerId);
  const kidRows = ((kids ?? []) as { child_id: string; sort_order: number | null }[]).map((k) => ({
    planner_id: newPlanner.id,
    child_id: k.child_id,
    sort_order: k.sort_order ?? 0,
  }));
  if (kidRows.length > 0) {
    await supabase.from("planner_kids").insert(kidRows);
  }

  // planner_entries — keep same session_id + child_id, new planner_id, same user_id
  const { data: entries } = await supabase
    .from("planner_entries")
    .select(
      "child_id, session_id, status, sort_order, notes, price_cents, price_unit, extras, session_part, days_of_week"
    )
    .eq("planner_id", plannerId)
    .eq("user_id", user.id);

  const entryRows = ((entries ?? []) as any[]).map((e) => ({
    user_id: user.id,
    planner_id: newPlanner.id,
    child_id: e.child_id,
    session_id: e.session_id,
    status: e.status,
    sort_order: e.sort_order,
    notes: e.notes,
    price_cents: e.price_cents,
    price_unit: e.price_unit,
    extras: e.extras,
    session_part: e.session_part,
    days_of_week: e.days_of_week,
  }));
  if (entryRows.length > 0) {
    const { error: entriesErr } = await supabase.from("planner_entries").insert(entryRows);
    if (entriesErr) console.error("duplicatePlanner entries error:", entriesErr);
  }

  // planner_blocks + planner_block_kids — need to map old block_id → new block_id
  const { data: blocks } = await supabase
    .from("planner_blocks")
    .select("id, type, title, emoji, start_date, end_date")
    .eq("planner_id", plannerId)
    .eq("user_id", user.id);

  const oldToNewBlockId: Record<string, string> = {};
  for (const b of ((blocks ?? []) as any[])) {
    const { data: nb, error: bErr } = await supabase
      .from("planner_blocks")
      .insert({
        user_id: user.id,
        planner_id: newPlanner.id,
        type: b.type,
        title: b.title,
        emoji: b.emoji,
        start_date: b.start_date,
        end_date: b.end_date,
      })
      .select("id")
      .single();
    if (bErr || !nb) {
      console.error("duplicatePlanner block insert error:", bErr);
      continue;
    }
    oldToNewBlockId[b.id] = nb.id;
  }

  const oldBlockIds = Object.keys(oldToNewBlockId);
  if (oldBlockIds.length > 0) {
    const { data: blockKids } = await supabase
      .from("planner_block_kids")
      .select("block_id, child_id")
      .in("block_id", oldBlockIds);

    const blockKidRows = ((blockKids ?? []) as { block_id: string; child_id: string }[])
      .map((bk) => ({
        block_id: oldToNewBlockId[bk.block_id],
        child_id: bk.child_id,
      }))
      .filter((r) => r.block_id);

    if (blockKidRows.length > 0) {
      await supabase.from("planner_block_kids").insert(blockKidRows);
    }
  }

  revalidatePath("/account/planners");
  return { plannerId: newPlanner.id };
}

/**
 * Delete a planner. Cascades remove planner_entries, planner_blocks,
 * planner_kids, and shared_schedules (all have ON DELETE CASCADE).
 * Refuses to delete the user's only planner so they always have at least one.
 */
export async function deletePlanner(plannerId: string): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { count } = await supabase
    .from("planners")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) <= 1) {
    return { error: "You need at least one planner. Create another before deleting this one." };
  }

  const { error } = await supabase
    .from("planners")
    .delete()
    .eq("id", plannerId)
    .eq("user_id", user.id);
  if (error) {
    console.error("deletePlanner error:", error);
    return { error: "Failed to delete planner" };
  }

  revalidatePath("/account/planners");
  revalidatePath("/planner");
  return {};
}
