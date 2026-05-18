/** A single friend-kid's enrollment that matches one of YOUR planner cells. */
export interface FriendOverlap {
  /** shared_schedules.id of the share the friend-kid comes from. */
  shareId: string;
  /** The share's URL token, for the "View Sarah's full planner →" link. */
  shareToken: string;
  /** Owner's display name (the parent who shared). Falls back to "a friend"
   *  upstream if null — this helper does NOT apply the fallback. */
  ownerName: string | null;
  /** Friend-kid's first name. */
  kidName: string;
  /** Friend-kid's identity color (from children.color), used to tint the dot. */
  kidColor: string;
}

/** A friend planner payload, as returned by get_shared_planner_by_token via the
 *  RPC mapper. We only need the subset of fields required for overlap matching;
 *  the matcher does NOT need the full SharedByTokenResult shape. */
export interface FriendPlannerForOverlap {
  shareId: string;
  shareToken: string;
  ownerName: string | null;
  kids: { id: string; name: string; color: string }[];
  /** Entries flattened to {child_id, activity_id, canonical_fingerprint?, week_key}.
   *  The caller projects the raw entries into this minimal shape using the same
   *  getWeekKey() the user-planner code already uses. canonical_fingerprint is
   *  the new primary match key (PR 3); activity_id is the rollout fallback for
   *  rows that haven't been fingerprinted yet (pre-backfill). */
  entries: {
    child_id: string;
    activity_id: string;
    canonical_fingerprint: string | null;
    week_key: string;
  }[];
}

/** One of YOUR planner entries (your kid, your activity, your week). */
export interface UserPlannerEntry {
  /** Your kid's id — used as the FIRST key in the output map. */
  child_id: string;
  /** The activity to match on. Used as the fallback key when canonical
   *  fingerprint is null on either side. */
  activity_id: string;
  /** Server-derived join key. When both sides have it, two activities with
   *  the same fingerprint match even if their activity_ids differ — this is
   *  how the Rachel/Lions Park bug gets fixed. Null until PR 2's pipeline has
   *  run on the row or PR 6's backfill has filled it in. */
  canonical_fingerprint: string | null;
  /** Week-key string from getWeekKey(). Used as the SECOND key. */
  week_key: string;
}

/** Map key shape: `${userKidId}::${weekKey}`. One entry per cell that has at
 *  least one matching friend-kid. Cells with zero overlaps are absent from the
 *  map (not present-with-empty-array) so the UI can do a simple lookup. */
export type OverlapMap = Record<string, FriendOverlap[]>;

const KEY_SEP = "::";

/** Compose a stable cell-lookup key from (userKidId, weekKey). Exported so
 *  callers can build the same key when reading the map. */
export function overlapKey(userKidId: string, weekKey: string): string {
  return `${userKidId}${KEY_SEP}${weekKey}`;
}

/** Pure overlap matcher. For each of YOUR planner cells (kid + week +
 *  activity), find all friend-kids enrolled in the SAME activity the SAME
 *  week. Returns a map keyed by `${userKidId}::${weekKey}` → list of friend
 *  overlaps, sorted by ownerName then kidName for stable rendering.
 *
 *  Two-tier matching: canonical_fingerprint is the primary key (groups
 *  rows that refer to the same real-world activity across users), with
 *  activity_id as the rollout fallback for rows that haven't been
 *  fingerprinted yet. The fallback gets retired in PR 8 after backfill. */
export function computeFriendOverlaps(
  userEntries: UserPlannerEntry[],
  friendPlanners: FriendPlannerForOverlap[],
): OverlapMap {
  // Build two indices in one pass: one keyed on canonical_fingerprint (the
  // new path) and one on activity_id (the rollout fallback). A friend entry
  // is registered in BOTH so a user entry can find it via whichever key the
  // user side has. We dedup by (shareId, kidName, child_id) when inserting
  // a user entry's matches so a row that hits both indices isn't counted
  // twice.
  const fpIndex = new Map<string, FriendOverlap[]>();
  const idIndex = new Map<string, FriendOverlap[]>();
  for (const fp of friendPlanners) {
    const kidById = new Map(fp.kids.map((k) => [k.id, k]));
    for (const e of fp.entries) {
      const kid = kidById.get(e.child_id);
      if (!kid) continue;
      const overlap: FriendOverlap = {
        shareId: fp.shareId,
        shareToken: fp.shareToken,
        ownerName: fp.ownerName,
        kidName: kid.name,
        kidColor: kid.color,
      };
      if (e.canonical_fingerprint) {
        const k = `${e.canonical_fingerprint}${KEY_SEP}${e.week_key}`;
        const list = fpIndex.get(k) ?? [];
        list.push(overlap);
        fpIndex.set(k, list);
      }
      const idKey = `${e.activity_id}${KEY_SEP}${e.week_key}`;
      const idList = idIndex.get(idKey) ?? [];
      idList.push(overlap);
      idIndex.set(idKey, idList);
    }
  }

  const out: OverlapMap = {};
  for (const ue of userEntries) {
    // Look up via canonical_fingerprint first; only fall back to activity_id
    // when the user side has no fingerprint yet (pre-backfill row).
    const matches: FriendOverlap[] = [];
    if (ue.canonical_fingerprint) {
      const fpKey = `${ue.canonical_fingerprint}${KEY_SEP}${ue.week_key}`;
      const found = fpIndex.get(fpKey);
      if (found) matches.push(...found);
    } else {
      const idKey = `${ue.activity_id}${KEY_SEP}${ue.week_key}`;
      const found = idIndex.get(idKey);
      if (found) matches.push(...found);
    }
    if (matches.length === 0) continue;
    const cellKey = overlapKey(ue.child_id, ue.week_key);
    const existing = out[cellKey] ?? [];
    // De-dupe by (shareId, kidName) in case the user has the same activity
    // twice in the same cell (unusual but possible with multi-session weeks).
    for (const m of matches) {
      const dup = existing.some(
        (x) => x.shareId === m.shareId && x.kidName === m.kidName,
      );
      if (!dup) existing.push(m);
    }
    out[cellKey] = existing;
  }

  // Stable sort each cell's overlaps for consistent render order.
  for (const k of Object.keys(out)) {
    out[k].sort((a, b) => {
      const ao = (a.ownerName ?? "").localeCompare(b.ownerName ?? "");
      if (ao !== 0) return ao;
      return a.kidName.localeCompare(b.kidName);
    });
  }
  return out;
}
