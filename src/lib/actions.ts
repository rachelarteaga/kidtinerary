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
