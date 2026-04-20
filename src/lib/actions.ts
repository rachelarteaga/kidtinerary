"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
    revalidatePath("/favorites");
    revalidatePath("/explore");
    return { favorited: false };
  } else {
    const { error } = await supabase
      .from("favorites")
      .insert({ user_id: user.id, activity_id: activityId });

    if (error) return { error: "Failed to add favorite" };
    revalidatePath("/favorites");
    revalidatePath("/explore");
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

export async function addChild(name: string, birthDate: string, interests: string[]) {
  // TODO: remove cast when types are generated
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase.from("children").insert({
    user_id: user.id,
    name,
    birth_date: birthDate,
    interests,
  });

  if (error) {
    console.error("addChild error:", error);
    return { error: "Failed to add child" };
  }

  revalidatePath("/kids");
  return { success: true };
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

  const { error } = await supabase
    .from("children")
    .update({ name, birth_date: birthDate, interests })
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

export async function addPlannerEntry(
  childId: string,
  sessionId: string,
  sortOrder: number
) {
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from("planner_entries")
    .select("id")
    .eq("user_id", user.id)
    .eq("child_id", childId)
    .eq("session_id", sessionId)
    .neq("status", "cancelled")
    .maybeSingle();

  if (existing) {
    return { error: "This session is already in the planner" };
  }

  const { data, error } = await supabase
    .from("planner_entries")
    .insert({
      user_id: user.id,
      child_id: childId,
      session_id: sessionId,
      status: "penciled_in",
      sort_order: sortOrder,
    })
    .select("id")
    .single();

  if (error) {
    console.error("addPlannerEntry error:", error);
    return { error: "Failed to add to planner" };
  }

  revalidatePath("/planner");
  return { success: true, id: data.id };
}

export async function updatePlannerEntryStatus(
  entryId: string,
  status: "penciled_in" | "locked_in" | "cancelled"
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("planner_entries")
    .update({ status: "cancelled" })
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) {
    console.error("removePlannerEntry error:", error);
    return { error: "Failed to remove entry" };
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
  childId?: string;
  weekStart?: string; // YYYY-MM-DD Monday
}

export async function submitCamp(
  input: string,
  context: SubmitCampContext,
  consentShare: boolean
): Promise<{
  error?: string;
  jobId?: string;
  userCampId?: string;
  plannerEntryId?: string | null;
  activityId?: string;
}> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = input.trim();
  if (!trimmed) return { error: "Enter a camp name or URL" };

  // Try to match existing activity by exact name or by URL fuzzy match.
  let activityId: string | null = null;

  const isURL = /^https?:\/\//i.test(trimmed);

  if (isURL) {
    try {
      const origin = new URL(trimmed).origin;
      const { data: existing } = await supabase
        .from("activities")
        .select("id")
        .ilike("registration_url", `${origin}%`)
        .limit(1)
        .maybeSingle();
      if (existing) activityId = existing.id;
    } catch {
      // Invalid URL; fall through to name match
    }
  } else {
    const { data: existing } = await supabase
      .from("activities")
      .select("id")
      .ilike("name", `%${trimmed}%`)
      .limit(1)
      .maybeSingle();
    if (existing) activityId = existing.id;
  }

  // If no match, create a stub activity.
  if (!activityId) {
    let orgId: string | null = null;
    const { data: stubOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("name", "User-submitted")
      .maybeSingle();
    if (stubOrg) {
      orgId = stubOrg.id;
    } else {
      const { data: newOrg } = await supabase
        .from("organizations")
        .insert({ name: "User-submitted", is_active: true })
        .select("id")
        .single();
      orgId = newOrg?.id ?? null;
    }

    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) + "-" + Date.now().toString(36);
    const { data: stub, error: stubErr } = await supabase
      .from("activities")
      .insert({
        organization_id: orgId,
        name: trimmed,
        slug,
        is_active: true,
        verified: false,
        registration_url: isURL ? trimmed : null,
        categories: [],
      })
      .select("id")
      .single();

    if (stubErr || !stub) {
      console.error("submitCamp stub insert error:", stubErr);
      return { error: "Failed to create camp entry" };
    }
    activityId = stub.id;
  }

  // Upsert user_camps (family shortlist).
  const { data: userCamp, error: ucErr } = await supabase
    .from("user_camps")
    .upsert(
      { user_id: user.id, activity_id: activityId },
      { onConflict: "user_id,activity_id", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (ucErr || !userCamp) {
    console.error("submitCamp user_camps error:", ucErr);
    return { error: "Failed to save camp to shortlist" };
  }

  // Optionally create a planner entry if scoped to week + kid.
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
      const { data: newSession, error: sessErr } = await supabase
        .from("sessions")
        .insert({
          activity_id: activityId,
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
        child_id: context.childId,
        session_id: sessionId,
        status: "considering",
        sort_order: 0,
      })
      .select("id")
      .single();

    if (!entryErr && entry) plannerEntryId = entry.id;
  }

  // Enqueue scrape job.
  const { data: job } = await supabase
    .from("scrape_jobs")
    .insert({
      user_id: user.id,
      input: trimmed,
      context: {
        child_id: context.childId ?? null,
        week_start: context.weekStart ?? null,
        activity_id: activityId,
      },
      consent_share: consentShare,
      status: "queued",
    })
    .select("id")
    .single();

  revalidatePath("/planner");

  return {
    jobId: job?.id,
    userCampId: userCamp.id,
    plannerEntryId,
    activityId: activityId ?? undefined,
  };
}

export async function assignCampToWeek(
  userCampId: string,
  childId: string,
  weekStart: string
): Promise<{ error?: string; entryId?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

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
    const { data: newSession } = await supabase
      .from("sessions")
      .insert({
        activity_id: uc.activity_id,
        starts_at: weekStart,
        ends_at: weekEnd.toISOString().split("T")[0],
        time_slot: "full_day",
        is_sold_out: false,
      })
      .select("id")
      .single();
    sessionId = newSession?.id;
  }

  if (!sessionId) return { error: "Could not create session" };

  const { data: entry, error } = await supabase
    .from("planner_entries")
    .insert({
      user_id: user.id,
      child_id: childId,
      session_id: sessionId,
      status: "considering",
      sort_order: 0,
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
