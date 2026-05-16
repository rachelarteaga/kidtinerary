import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  fetchChildren,
  fetchPlannerEntries,
  fetchUserActivities,
  fetchPlannerBlocks,
  fetchPlannerById,
  fetchUserPlannerIds,
  fetchPlannerKids,
} from "@/lib/queries";
import { fetchSavedShares, fetchSharedPlannerByToken } from "@/lib/queries";
import { computeFriendOverlaps, type FriendPlannerForOverlap, type UserPlannerEntry } from "@/lib/overlap";
import { getWeekKey } from "@/lib/format";
import { PlannerClient } from "./client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ id?: string }>;
}

export default async function PlannerPage({ searchParams }: PageProps) {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { id: requestedId } = await searchParams;

  // Requested-id path: load that planner if the user owns it.
  let planner = requestedId ? await fetchPlannerById(requestedId, user.id) : null;

  // No id (or bad id): smart redirect — drive first-timers straight into the
  // new-planner flow, open the sole planner for single-planner users, and send
  // multi-planner users to the catalog to pick.
  if (!planner) {
    const ids = await fetchUserPlannerIds(user.id);
    if (ids.length === 0) redirect("/account/planners?new=1");
    if (ids.length > 1) redirect("/account/planners");
    planner = await fetchPlannerById(ids[0], user.id);
    if (!planner) redirect("/account/planners?new=1");
  }

  // Existing planner share, if any. Used to seed the share modal's "Which
  // kids?" / include-cost / include-blocks fields from the live share rather
  // than from defaults — otherwise re-opening the modal silently drops any
  // prior settings.
  const { data: existingShare } = await supabase
    .from("shared_schedules")
    .select("id, kid_ids, include_cost, include_personal_block_details")
    .eq("planner_id", planner.id)
    .eq("user_id", user.id)
    .eq("scope", "planner")
    .maybeSingle();
  const sharesActiveCount = existingShare ? 1 : 0;

  // Kids on THIS planner (may be empty — user can add via the header).
  const children = await fetchPlannerKids(planner.id, user.id);

  // All the user's kids from their profile — used by the "+ Add kid" menu.
  const allUserKids = await fetchChildren(user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("share_camps_default")
    .eq("id", user.id)
    .maybeSingle();

  const allEntries = (
    await Promise.all(children.map((c: any) => fetchPlannerEntries(user.id, c.id, planner.id)))
  ).flat();

  const userCamps = await fetchUserActivities(user.id);
  const blocks = await fetchPlannerBlocks(user.id, planner.id);

  const ownerDisplayName = (user.user_metadata?.full_name as string | undefined) ?? null;

  // Phase 2 overlap: fetch each saved friend's planner payload to compute
  // cell-level matches (same activity, same week as the user's own entries).
  // Pure derivation — no schema involved. Tombstoned saves are skipped
  // (token === null means the share was revoked).
  const savedShares = await fetchSavedShares(user.id);
  const friendPayloads = await Promise.all(
    savedShares
      .filter((s) => !s.isTombstone && s.token)
      .map(async (s) => {
        const result = await fetchSharedPlannerByToken(s.token!);
        if (result.type !== "planner") return null;
        const planner: FriendPlannerForOverlap = {
          shareId: result.shareId,
          shareToken: result.token,
          ownerName: result.ownerDisplayName,
          kids: result.kids.map((k) => ({
            id: k.id,
            name: k.name,
            color: k.color,
          })),
          entries: result.entries.map((e) => ({
            child_id: e.child_id,
            activity_id: e.session.activity.id,
            week_key: getWeekKey(new Date(e.session.starts_at + "T00:00:00")),
          })),
        };
        return planner;
      }),
  );
  const friendPlanners = friendPayloads.filter(
    (p): p is FriendPlannerForOverlap => p !== null,
  );

  // Project the user's own entries down to the minimal shape the matcher
  // needs, then compute the overlap map keyed by `${kidId}::${weekKey}`.
  const userEntriesForOverlap: UserPlannerEntry[] = allEntries.map((e) => ({
    child_id: e.child_id,
    activity_id: e.session.activity.id,
    week_key: getWeekKey(new Date(e.session.starts_at + "T00:00:00")),
  }));
  const overlapMap = computeFriendOverlaps(userEntriesForOverlap, friendPlanners);

  // Pass the saved-shares list to the client as well — the new "Friends'
  // Plans" tab in the rail renders this passively (owner name + kids + remove).
  const friendsForRail = savedShares.map((s) => ({
    savedShareId: s.savedShareId,
    shareId: s.shareId,
    token: s.token,
    isTombstone: s.isTombstone,
    plannerName: s.plannerName ?? s.plannerNameAtSave,
    ownerDisplayName: s.ownerDisplayName,
    kids: friendPlanners
      .find((p) => p.shareId === s.shareId)?.kids ?? [],
  }));

  return (
    <PlannerClient
      kids={children}
      allUserKids={allUserKids}
      entries={allEntries}
      userActivities={userCamps}
      blocks={blocks}
      shareCampsDefault={profile?.share_camps_default ?? true}
      planner={planner}
      sharesActiveCount={sharesActiveCount}
      ownerDisplayName={ownerDisplayName}
      existingShareKidIds={existingShare?.kid_ids ?? null}
      existingShareIncludeCost={existingShare?.include_cost ?? null}
      existingShareIncludePersonalBlockDetails={
        existingShare?.include_personal_block_details ?? null
      }
      overlapMap={overlapMap}
      friendsForRail={friendsForRail}
    />
  );
}
